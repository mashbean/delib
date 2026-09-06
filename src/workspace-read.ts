/** Read one known service result. Never accept a URL, log a key, or follow redirects. */
export async function handleWorkspaceRead(request: Request, origins: Record<string, string>, upstreamFetch: typeof fetch = fetch): Promise<Response> {
  const send = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
  if (request.method !== 'POST') return send({ error: 'POST required' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return send({ error: 'Origin not allowed' }, 403);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return send({ error: 'JSON required' }, 415);
  // This endpoint only receives an ID and an optional Form management key.
  const reader = request.body?.getReader();
  if (!reader) return send({ error: 'Body required' }, 400);
  let text = ''; let size = 0; const decoder = new TextDecoder();
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2048) { await reader.cancel(); return send({ error: 'Request too large' }, 413); } text += decoder.decode(value, { stream: true }); }
  text += decoder.decode();
  let body: { tool?: string; id?: string; token?: string };
  try { body = JSON.parse(text); } catch { return send({ error: 'Invalid JSON' }, 400); }
  if (!body || !['form', 'tttc', 'reply'].includes(body.tool || '') || !/^[a-z0-9]{10}$/.test(body.id || '')) return send({ error: 'Invalid tool or activity ID' }, 400);
  const tool = body.tool as string;
  if (tool === 'form' && !/^[a-f0-9]{32}$/.test(body.token || '')) return send({ error: 'Form management key required' }, 400);
  let origin: URL;
  try { origin = new URL(origins[tool] || ''); } catch { return send({ error: 'Service unavailable' }, 503); }
  if (origin.protocol !== 'https:' || origin.username || origin.password) return send({ error: 'Invalid service configuration' }, 503);
  const path = tool === 'form' ? `/api/forms/${body.id}/export/tttc.csv` : tool === 'tttc' ? `/api/reports/${body.id}` : `/api/loops/${body.id}`;
  try {
    const response = await upstreamFetch(new URL(path, origin.origin), { headers: tool === 'form' ? { 'X-Form-Admin': body.token as string } : {}, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) return send({ error: 'Service could not return this activity. Check the link and access, or try again later.', upstreamStatus: response.status }, [401,403,404,410,429].includes(response.status) ? response.status : 502);
    const stream = response.body?.getReader(); if (!stream) return send({ error: 'Empty service result' }, 502);
    const chunks: Uint8Array[] = []; let bytes = 0;
    for (;;) { const { value, done } = await stream.read(); if (done) break; bytes += value.byteLength; if (bytes > 5 * 1024 * 1024) { await stream.cancel(); return send({ error: 'Result exceeds 5 MiB; use the service export instead' }, 413); } chunks.push(value); }
    const buffer = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const content = new TextDecoder().decode(buffer);
    return send(tool === 'form' ? { tool, id: body.id, csv: content } : { tool, id: body.id, result: JSON.parse(content) });
  } catch { return send({ error: 'Unable to read the service. Your local work is unchanged; retry reading later.' }, 502); }
}

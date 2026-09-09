import { describe, it, expect } from 'vitest';
import { handleWorkspaceRead } from './workspace-read';

describe('service readback in the Worker runtime', () => {
  it('constructs the outgoing request with runtime-supported options', async () => {
    const request = new Request('https://delib.example/api/workspace/read', { method: 'POST', headers: { Origin: 'https://delib.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: 'form', id: 'abcdefghij', token: 'a'.repeat(32) }) });
    let failure: unknown;
    const outgoing: typeof fetch = async (url, options) => {
      try { new Request(url, options); } catch (error) { failure = error; throw error; }
      return new Response('id,interview,comment\n1,,hello');
    };
    const response = await handleWorkspaceRead(request, { form: 'https://form.example' }, outgoing);
    expect(failure).toBeUndefined();
    expect(response.status).toBe(200);
  });
});

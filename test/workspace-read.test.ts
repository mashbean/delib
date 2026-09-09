import {describe,it,expect,vi} from 'vitest';
import {handleWorkspaceRead} from '../src/workspace-read';
const origins={form:'https://form.example',tttc:'https://tttc.example',reply:'https://reply.example'};
const req=(body:unknown,origin='https://delib.example')=>new Request('https://delib.example/api/workspace/read',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
describe('bounded service readback',()=>{
 it('sends a Form key only to the configured Form export and never returns it',async()=>{
  const fake=vi.fn(async()=>new Response('id,interview,comment\na,,hello'));
  const response=await handleWorkspaceRead(req({tool:'form',id:'abcdefghij',token:'a'.repeat(32)}),origins,fake as typeof fetch);
  expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');
  const [url,options]=fake.mock.calls[0] as unknown as [URL,RequestInit];expect(String(url)).toBe('https://form.example/api/forms/abcdefghij/export/tttc.csv');expect(options.headers).toEqual({'X-Form-Admin':'a'.repeat(32)});expect(options.redirect).toBe('manual');expect(await response.text()).not.toContain('a'.repeat(32));
 });
 it('never forwards a supplied credential to public TTTC or Reply reads',async()=>{
  for(const tool of ['tttc','reply']){const fake=vi.fn(async()=>Response.json({progress:{status:'queued'}}));expect((await handleWorkspaceRead(req({tool,id:'abcdefghij',token:'a'.repeat(32),url:'https://evil.example'}),origins,fake as typeof fetch)).status).toBe(200);expect((fake.mock.calls[0] as unknown as [unknown,RequestInit])[1].headers).toEqual({});}
 });
 it('refuses redirects without forwarding credentials or returning the destination',async()=>{
  const fake=vi.fn(async()=>new Response(null,{status:302,headers:{Location:'https://outside.example/secret'}}));
  const r=await handleWorkspaceRead(req({tool:'form',id:'abcdefghij',token:'a'.repeat(32)}),origins,fake as typeof fetch);
  expect(r.status).toBe(502);expect(fake).toHaveBeenCalledTimes(1);expect(await r.text()).not.toContain('outside.example');
 });
 it('rejects cross-origin reads, unknown tools and path injection before calling upstream',async()=>{
  const fake=vi.fn();expect((await handleWorkspaceRead(req({tool:'form',id:'abcdefghij'},'https://evil.example'),origins,fake)).status).toBe(403);
  for(const body of [{tool:'other',id:'abcdefghij'},{tool:'tttc',id:'../private'},{tool:'form',id:'abcdefghij'}])expect((await handleWorkspaceRead(req(body),origins,fake)).status).toBe(400);expect(fake).not.toHaveBeenCalled();
 });
 it('bounds request/result size and returns safe errors without service bodies',async()=>{
  expect((await handleWorkspaceRead(req({tool:'tttc',id:'abcdefghij',padding:'x'.repeat(3000)}),origins)).status).toBe(413);
  const large=async()=>new Response('x'.repeat(5*1024*1024+1));expect((await handleWorkspaceRead(req({tool:'tttc',id:'abcdefghij'}),origins,large as typeof fetch)).status).toBe(413);
  const denied=async()=>new Response('private details',{status:403});const r=await handleWorkspaceRead(req({tool:'form',id:'abcdefghij',token:'a'.repeat(32)}),origins,denied as typeof fetch);expect(r.status).toBe(403);expect(await r.text()).not.toContain('private details');
 });
});

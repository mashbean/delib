import {describe,it,expect,vi} from 'vitest';
import {createPersistence} from '../public/workspace-persistence.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
describe('local draft persistence',()=>{
 it('rejects a failed save, retains a dirty issue and can retry the same draft',async()=>{
  const write=vi.fn().mockRejectedValueOnce(new Error('QuotaExceededError')).mockResolvedValueOnce(undefined),store=createPersistence(write);
  const draft={id:'a',records:[{text:'Preserve this contribution'}]};
  await expect(store.save(draft)).rejects.toThrow('QuotaExceededError');
  expect(store.get('a').status).toBe('error');expect(store.dirty()).toEqual(['a']);
  await store.save(draft);expect(store.get('a').status).toBe('stored');expect(store.dirty()).toEqual([]);expect(write.mock.calls[1][0]).toEqual(draft);
 });
 it('writes an immutable snapshot even if the UI draft changes before the write starts',async()=>{
  const write=vi.fn(),store=createPersistence(write),draft={id:'a',records:[{text:'original'}]};
  const pending=store.save(draft);draft.records[0].text='later';await pending;
  expect(write.mock.calls[0][0].records[0].text).toBe('original');
 });
 it('serializes writes so an older completion cannot mark a newer revision saved',async()=>{
  const first=deferred(),second=deferred(),write=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),store=createPersistence(write);
  const a=store.save({id:'a',text:'old'}),b=store.save({id:'a',text:'new'});
  await Promise.resolve();expect(write).toHaveBeenCalledTimes(1);
  first.resolve();await a;expect(store.get('a')).toMatchObject({status:'saving',revision:2,savedRevision:1});expect(store.dirty()).toEqual(['a']);
  second.resolve();await b;expect(store.get('a')).toMatchObject({status:'stored',revision:2,savedRevision:2});
  expect(write.mock.calls.map(([x])=>x.text)).toEqual(['old','new']);
 });
 it('continues a queued write after a rejection and reports the latest revision',async()=>{
  const first=deferred(),write=vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined),store=createPersistence(write);
  const a=store.save({id:'a',text:'old'}),failure=expect(a).rejects.toThrow('offline');const b=store.save({id:'a',text:'new'});
  first.reject(new Error('offline'));await failure;await b;
  expect(store.get('a')).toMatchObject({status:'stored',savedRevision:2});expect(store.dirty()).toEqual([]);
 });
 it('does not let saving another issue hide an unsaved draft',async()=>{
  const store=createPersistence(vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined));
  await expect(store.save({id:'a'})).rejects.toThrow();await store.save({id:'b'});
  expect(store.dirty()).toEqual(['a']);expect(store.get('a').status).toBe('error');expect(store.get('b').status).toBe('stored');
  store.forget('a');expect(store.dirty()).toEqual([]);
 });
 it('lets removal wait until queued writes have settled',async()=>{
  const pending=deferred(),store=createPersistence(()=>pending.promise),write=store.save({id:'a'});let settled=false;
  const barrier=store.settle().then(()=>{settled=true;});await Promise.resolve();expect(settled).toBe(false);
  pending.resolve();await write;await barrier;expect(settled).toBe(true);store.forget('a');expect(store.dirty()).toEqual([]);
 });
 it('notifies the UI of saving, failure and successful retry without swallowing rejection',async()=>{
  const observed=[],write=vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined);
  const store=createPersistence(write,()=>observed.push(store.get('a').status));
  await expect(store.save({id:'a'})).rejects.toThrow();await store.save({id:'a'});
  expect(observed).toEqual(['saving','error','saving','stored']);
 });
});

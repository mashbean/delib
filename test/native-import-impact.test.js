import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {nativeAdapters,importExchange,withdrawExchange} from '../public/exchange-core.js';
import {createProject,nextRound} from '../public/workspace-core.js';
import {planNativeImport,applyNativeImport} from '../public/workspace-import-core.js';
import {nativeImportImpact,nativeImportDisposition} from '../public/native-import-impact-core.js';
import {nativeImportPreview} from '../public/workspace-import-view.js';
const fixture=t=>JSON.parse(readFileSync(new URL(`../public/data/exchange-examples/${t}.json`,import.meta.url)));
const project=()=>({...createProject({title:'School access',audience:'Families',goal:'Safe arrival',deadline:'2026-12-01'}),simulated:true});
const input=t=>({fileSha256:'a'.repeat(64),bundle:importExchange(fixture(t),{tool:t,simulated:true,sha256:'a'.repeat(64)})});
describe('native import usage preview',()=>{
 it.each(nativeAdapters)('%s accounts for each projected record once without changing the import',tool=>{
  const p=project(),plan=planNativeImport(p,input(tool)),before=JSON.stringify(plan),a=nativeImportImpact(plan);
  expect(Object.values(a.counts).reduce((x,y)=>x+y,0)).toBe(plan.records.length);
  expect(a.mappings.reduce((n,r)=>n+r.count,0)).toBe(plan.records.length);
  expect(a.counts.source).toBe(plan.records.filter(r=>r.eligible&&!r.quarantined).length);
  for(const lang of ['zh','en'])expect(nativeImportPreview(p,plan,lang)).toContain(lang==='zh'?'匯入之後，怎麼用？':'How can these records be used?');
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('separates Polis counts from source voices',()=>{const a=nativeImportImpact(planNativeImport(project(),input('delib-data')));expect(a.counts).toEqual({source:1,context:2,restricted:0});});
 it('explains unresolved TTTC chains without treating them as reusable context',()=>{const p=project(),plan=planNativeImport(p,input('tttc')),a=nativeImportImpact(plan);expect(a.counts.restricted).toBe(plan.records.length);expect(a.unresolvedSources).toBeGreaterThan(0);expect(nativeImportPreview(p,plan,'en')).toContain('external references remain unresolved');});
 it('keeps Sensemaker output as method data and does not invent external sources',()=>{const a=nativeImportImpact(planNativeImport(project(),input('sensemaker')));expect(a.counts.source).toBe(0);expect(a.counts.context).toBeGreaterThan(0);expect(a.unresolvedSources).toBe(0);});
 it('prioritizes restrictions including a withdrawal remembered from an earlier round',()=>{
  const p=project(),data=input('form');applyNativeImport(p,planNativeImport(p,data));
  const withdrawn=withdrawExchange(data.bundle,data.bundle.records[0].id,{by:'Host',reason:'Withdrawal'});
  applyNativeImport(p,planNativeImport(p,{...data,bundle:withdrawn}));
  nextRound(p,{reason:'Review withdrawal',owner:'Host',date:'2026-12-01',phase:'learn'});
  const plan=planNativeImport(p,data);expect(nativeImportImpact(plan).counts.restricted).toBeGreaterThan(0);
  expect(nativeImportDisposition({eligible:true,quarantined:true})).toBe('restricted');
 });
 it('counts loss notes separately from records and never copies their paths or reasons into the summary',()=>{
  const plan=planNativeImport(project(),input('form'));plan.entry.bundle.losses.push({action:'blocked',path:'/PRIVATE-ID',reason:'PRIVATE-TEXT'});
  const a=nativeImportImpact(plan);expect(a.losses.blocked).toBe(plan.entry.bundle.losses.filter(l=>l.action==='blocked').length);
  expect(JSON.stringify(a)).not.toMatch(/PRIVATE-ID|PRIVATE-TEXT/);
 });
});

import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {importExchange,exchangeToCsv} from '../public/exchange-core.js';
import {createProject,validateProject,allRecords,roundSources,reviewRecord} from '../public/workspace-core.js';
import {planNativeImport,applyNativeImport} from '../public/workspace-import-core.js';
import {transferCandidates} from '../public/workspace-transfer-core.js';
const fixture=t=>JSON.parse(readFileSync(new URL(`../public/data/exchange-examples/${t}.json`,import.meta.url)));
const convert=(data=fixture('proposals-archive'),tool='proposals')=>importExchange(data,{tool,sha256:'a'.repeat(64),simulated:true});
describe('full proposal history',()=>{
 it('preserves version and amendment lineage without turning historical drafts into separate voices',()=>{
  const b=convert(),byId=id=>b.records.find(r=>r.originalId===id);
  expect(b.records).toHaveLength(5);
  expect(byId('amendment-1').relations).toEqual([{ref:byId('version-1-1').id,type:'revises'}]);
  expect(byId('version-1-2').relations).toContainEqual({ref:byId('amendment-1').id,type:'derived'});
  expect(byId('1').relations).toEqual([{ref:byId('version-1-2').id,type:'derived'}]);
  expect(byId('response-1').fields.versionAtResponse).toBe('unknown');
  const csv=exchangeToCsv(b,{reviewed:true}).csv;
  expect(csv).toContain(fixture('proposals-archive').proposals[0].body);
  expect(csv).not.toContain('Can wheelchair users');
  expect(b.records.filter(r=>r.transferEligible)).toHaveLength(1);
 });
 it.each([
  p=>p.versions.pop(),
  p=>p.versions[1].source='amendment-999',
  p=>p.versions[1].body='Fabricated version',
  p=>p.amendments[0].baseVersion=2,
  p=>p.amendments[0].state='open',
  p=>p.responses[0].proposalId=999,
  p=>p.responses.push(p.responses[0]),
  p=>p.version=3,
 ])('rejects incomplete or contradictory history',mutate=>{
  const data=fixture('proposals-archive');mutate(data.proposals[0]);expect(()=>convert(data)).toThrow(/archive|lineage/);
 });
 it('rejects unrecognized archive versions while keeping space.json compatible',()=>{
  const data=fixture('proposals-archive');data.schema='pocket-proposals-archive/v2';expect(()=>convert(data)).toThrow();
  expect(convert(fixture('proposals')).records).toHaveLength(1);
 });
 it('loads the full graph in the workspace and keeps only a reviewed current proposal as context',()=>{
  const p={...createProject({title:'Fictional bay',audience:'Families',goal:'Review access',deadline:'2026-12-01'}),simulated:true};
  applyNativeImport(p,planNativeImport(p,{bundle:convert(),fileSha256:'a'.repeat(64)}));
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  expect(allRecords(p)).toHaveLength(5);expect(roundSources(p)).toHaveLength(0);
  allRecords(p).forEach(a=>reviewRecord(p,a.id,{reviewer:'Facilitator'}));
  expect(transferCandidates(p).context.map(a=>a.kind)).toEqual(['proposal']);
 });
});
describe('Sensemaker result contract',()=>{
 it('keeps Markdown as unlinked model output, never as participant evidence or reviewed context',()=>{
  const b=convert(fixture('sensemaker'),'sensemaker');
  expect(b.records[0]).toMatchObject({kind:'method-result',origin:'model',status:'draft',relations:[],transferEligible:false});
  expect(()=>exchangeToCsv(b,{reviewed:true})).toThrow(/eligible/);
  const p={...createProject({title:'Fictional bay',audience:'Families',goal:'Review access',deadline:'2026-12-01'}),simulated:true};
  applyNativeImport(p,planNativeImport(p,{bundle:b,fileSha256:'a'.repeat(64)}));
  allRecords(p).forEach(a=>reviewRecord(p,a.id,{reviewer:'Facilitator'}));
  expect(transferCandidates(p).context).toHaveLength(0);expect(roundSources(p)).toHaveLength(0);
 });
 it('refuses running, failed or malformed result files',()=>{
  for(const change of [{status:'processing'},{success:false},{commentsProcessed:1.5},{summary:''},{completedAt:'yesterday'}])expect(()=>convert({...fixture('sensemaker'),...change},'sensemaker')).toThrow();
 });
});

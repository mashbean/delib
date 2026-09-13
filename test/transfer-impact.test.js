import {describe,it,expect} from 'vitest';
import {createProject,addSources,currentRound,allRecords,record,reviewRecord} from '../public/workspace-core.js';
import {planTransfer,transferCsv,addTransfer,exportTransfer} from '../public/workspace-transfer-core.js';
import {transferImpact,transferGuidance} from '../public/transfer-impact-core.js';
import {transferImpactView} from '../public/transfer-impact-view.js';
import {parseCsvWithHeaders} from '../public/pocket-polis-data-core.js';
const setup=()=>{const p=createProject({title:'Private issue',audience:'Private audience',goal:'Preserve access',deadline:'2026-12-01',language:'en'});addSources(p,'id,interview,comment\na,private-person,Keep the ramp open\nb,,Leave deliveries possible','source');return p;};
describe('outgoing field impact',()=>{
 it('describes actual CSV and companion boundaries without changing project data',()=>{
  const p=setup(),before=JSON.stringify(p),plan=planTransfer(p),impact=transferImpact(plan);
  const csv=parseCsvWithHeaders(transferCsv(plan),['id','interview','comment'],'test');
  expect(impact.counts.sources).toBe(csv.length);expect(csv.every(r=>r.interview==='')).toBe(true);
  expect(impact.fields.find(r=>r.field==='context')).toEqual({field:'context',destination:'absent',companion:'not-selected'});
  expect(impact.counts.unchecked).toBe(2);expect(impact.counts.protectedText).toBe(0);expect(JSON.stringify(p)).toBe(before);
 });
 it('makes the Reply context flattening explicit while preserving relations in its companion',()=>{
  const p=setup(),theme=record('theme','Keep accessible access',{tool:'facilitator',id:'private-theme'},[allRecords(p)[0].id]);currentRound(p).artifacts.push(theme);reviewRecord(p,theme.id,{reviewer:'Private reviewer'});
  const plan=planTransfer(p,{tool:'reply'}),impact=transferImpact(plan),out=exportTransfer(addTransfer(p,plan));
  expect(impact.counts.context).toBe(1);expect(out.destinationPayload.positions).toBe(theme.text);expect(out.transfer.annotations[0].relations).toEqual(theme.relations);
  expect(impact.fields.find(r=>r.field==='context').destination).toBe('joined-positions');expect(impact.counts.relations).toBe(theme.relations.length);
 });
 it('reports actual formula escaping rather than claiming exact text preservation',()=>{
  const p=setup();allRecords(p)[0].text='=SUM(1,2)';const a=transferImpact(planTransfer(p));
  expect(a.counts.protectedText).toBe(1);expect(a.counts.protectedIds).toBe(0);
  expect(transferImpactView(planTransfer(p),'en')).toContain('CSV safety escaping changes 1 texts');
 });
 it('does not mistake ordinary quoting, commas or multiline CSV for text loss',()=>{
  const p=setup();allRecords(p)[0].text='Keep "access",\nincluding deliveries';expect(transferImpact(planTransfer(p)).counts.protectedText).toBe(0);
 });
 it('keeps downloadable diagnostics free of issue text, identifiers and people',()=>{
  const p=setup(),plan=planTransfer(p),raw=JSON.stringify(transferImpact(plan));
  for(const s of [p.title,p.audience,p.goal,'private-person',...plan.inputs.flatMap(a=>[a.id,a.text,a.source.id])])expect(raw).not.toContain(s);
 });
 it('recomputes review guidance from the selected records, not all issue content',()=>{
  const p=setup(),ids=allRecords(p).map(a=>a.id);reviewRecord(p,ids[0],{reviewer:'Host'});
  expect(transferGuidance(p,planTransfer(p,{refs:[ids[0]]})).unchecked).toEqual([]);
  expect(transferGuidance(p,planTransfer(p,{refs:[ids[1]]})).unchecked).toEqual([ids[1]]);
  expect(transferImpact(planTransfer(p,{refs:[ids[1]]})).counts.sources).toBe(1);
 });
 it('makes identifier warnings visible without including matching text in the report',()=>{
  const p=setup();allRecords(p)[0].text='Contact someone@example.com';const a=transferImpact(planTransfer(p));
  expect(a.counts.identifierWarnings).toBe(1);expect(JSON.stringify(a)).not.toContain('someone@example.com');
 });
 it('keeps dialog advice read-only and distinguishes full backups from companions in both languages',()=>{
  const p=setup(),plan=planTransfer(p),en=transferImpactView(plan,'en',{project:p}),zh=transferImpactView(plan,'zh',{project:p,actions:true});
  expect(en).toContain('full issue backup');expect(en).not.toContain('data-record=');expect(en).not.toContain('data-action=');
  expect(zh).toContain('完整議題備份');expect(zh).toContain('data-record=');expect(zh).toContain('data-action="download-impact"');
  expect(en).toContain('Omitting participant fields does not anonymize the text');
 });
});

import {describe,it,expect} from 'vitest';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectWorkspaceText,inspectWorkspaceContract,partitionWorkspaceBackups,CONTRACT_FILE_LIMIT} from '../public/workspace-contract-core.js';
import {createProject,nextRound,validateProject,projectFromDemo} from '../public/workspace-core.js';
import {buildPublicReplaySequence} from '../public/public-replay-core.js';
import validateShape from '../public/vendor/workspace-validator.js';

const fixture=name=>JSON.parse(readFileSync(`public/fixtures/contracts/workspace-${name}.json`,'utf8'));
const linked=()=>fixture('linked');
describe('workspace contracts used by the workspace, local checker and CLI',()=>{
  it('keeps all source and revision links while validating a public two-round fixture',()=>{
    const p=linked(),before=JSON.stringify(p),r=inspectWorkspaceContract(p);
    expect(r).toMatchObject({valid:true,missingContext:[],counts:{rounds:2,records:6,transfers:0,imports:0},externalAcceptance:false,workspaceModified:false});
    expect(p.rounds[0].artifacts[2].derivedFrom).toEqual(['voice-a','voice-b']);
    expect(p.rounds[0].artifacts[4].supersedes).toBe('reply');expect(JSON.stringify(p)).toBe(before);
  });
  it('reports legacy omissions without inventing goals, audiences, times or success',()=>{
    const p=fixture('legacy');p.rounds[0].connections.form={id:'abcdefghij',inputRefs:[],contextRefs:[]};
    const before=JSON.stringify(p),r=inspectWorkspaceContract(p);
    expect(r).toMatchObject({valid:true,missingContext:['goal','audience','deadline']});expect(JSON.stringify(p)).toBe(before);
  });
  it('retains the precision of a legacy date-only review',()=>{
    const p=linked();p.rounds[0].artifacts[0].review={checked:true,reviewer:'Fixture host',at:'2026-09-23',quoteConfirmed:false};
    expect(inspectWorkspaceContract(p).valid).toBe(true);expect(p.rounds[0].artifacts[0].review.at).toBe('2026-09-23');
  });
  it.each([
    ['goal',{}],['goal',''],['audience',false],['deadline','2026-02-30'],['deadline','2026-09-23T10:00:00Z'],['updatedAt','invalid'],
  ])('rejects malformed %s in both the checker and the workspace', (key,value)=>{
    const p=linked();p[key]=value;expect(inspectWorkspaceContract(p)).toMatchObject({valid:false,code:'schema-invalid'});expect(()=>validateProject(p)).toThrow();
  });
  it('rejects impossible new-project and next-round dates before any mutation',()=>{
    expect(()=>createProject({title:'Fixture',audience:'Fictional',goal:'Practice',deadline:'2026-02-30'})).toThrow();
    const p=linked(),before=JSON.stringify(p);expect(()=>nextRound(p,{reason:'Practice',owner:'Host',date:'2026-02-30',phase:'learn'})).toThrow();expect(JSON.stringify(p)).toBe(before);
  });
  it('schema validity alone cannot validate provenance or unique IDs',()=>{
    for(const mutate of [p=>p.rounds[0].artifacts[2].derivedFrom.push('missing'),p=>p.rounds[0].artifacts[1].id='voice-a']){
      const p=linked();mutate(p);expect(validateShape(p)).toBe(true);expect(inspectWorkspaceContract(p)).toMatchObject({valid:false,code:'semantics-invalid'});
    }
  });
  it('rejects malformed record extensions, next-round fields and events',()=>{
    for(const mutate of [p=>p.rounds[0].artifacts[0].context={},p=>p.rounds[0].artifacts[0].methodData=0,p=>p.rounds[0].next.date='2026-13-01',p=>p.events.push({type:'review',recordId:'voice-a',by:{name:'Host'},at:'2026-09-23T00:00:00Z'})]){
      const p=linked();mutate(p);expect(inspectWorkspaceContract(p)).toMatchObject({valid:false,code:'schema-invalid'});
    }
  });
  it('does not silently discard incompatible stored projects',()=>{
    const a=linked(),b=linked();b.goal={private:'keep original'};const before=JSON.stringify([a,b]);const result=partitionWorkspaceBackups([a,b]);
    expect(result.valid).toEqual([a]);expect(result.recovery).toEqual([b]);expect(result.recovery[0]).toBe(b);expect(JSON.stringify([a,b])).toBe(before);
  });
  it('preserves allowed extensions without treating them as interoperable fields',()=>{
    const p=linked();p.extension={localNote:'Synthetic future field'};const before=JSON.stringify(p);expect(inspectWorkspaceContract(p).valid).toBe(true);expect(JSON.stringify(p)).toBe(before);
  });
  it('never echoes source text, IDs, context, credentials or JSON parser excerpts',()=>{
    const p=linked();p.title='PRIVATE-TITLE';p.rounds[0].artifacts[0].text='PRIVATE-VOICE';p.extension={token:'SECRET-CREDENTIAL'};
    const r=inspectWorkspaceText(JSON.stringify(p));expect(r).toMatchObject({valid:false,code:'semantics-invalid',externalAcceptance:false});
    for(const text of ['PRIVATE-TITLE','PRIVATE-VOICE','SECRET-CREDENTIAL','voice-a','fixture-access'])expect(JSON.stringify(r)).not.toContain(text);
    expect(JSON.stringify(inspectWorkspaceText('{"secret":"PRIVATE-PARSER-EXCERPT"'))).not.toContain('PRIVATE-PARSER-EXCERPT');
  });
  it('accepts only bounded workspace files, not tool exports or arrays',()=>{
    expect(inspectWorkspaceText('[]').code).toBe('unsupported-schema');
    expect(inspectWorkspaceText('{"schema":"delib-data/v1"}').code).toBe('unsupported-schema');
    expect(inspectWorkspaceText('界'.repeat(Math.floor(CONTRACT_FILE_LIMIT/3)+1)).code).toBe('size-limit');
  });
  it('validates actual demo and public replay snapshots in both languages',async()=>{
    const demo=JSON.parse(readFileSync('public/data/flow-demo.json','utf8')),data=JSON.parse(readFileSync('public/data/uberx-replay.json','utf8'));
    for(const lang of ['zh','en']){
      expect(inspectWorkspaceContract(projectFromDemo(demo,lang)).valid).toBe(true);
      const sequence=await buildPublicReplaySequence(data,lang);
      for(const stage of sequence)expect(inspectWorkspaceContract(stage.project).valid).toBe(true);
      expect(inspectWorkspaceContract(sequence[5].project).counts).toMatchObject({rounds:2,records:34,imports:2});
    }
  });
  it('rejects a native derived record relabeled as participant testimony',async()=>{
    const data=JSON.parse(readFileSync('public/data/uberx-replay.json','utf8')),sequence=await buildPublicReplaySequence(data,'zh');
    const p=sequence[2].project,record=p.rounds[0].artifacts.find(a=>a.nativeRef);record.kind='statement';
    expect(inspectWorkspaceContract(p)).toMatchObject({valid:false,code:'semantics-invalid'});
  });
  it('CLI is offline/read-only with stable exit codes and content-free errors',()=>{
    const dir=mkdtempSync(join(tmpdir(),'delib-contract-'));
    try{
      const path=join(dir,'private.json'),run=(args)=>spawnSync(process.execPath,['scripts/validate-workspace.mjs',...args],{encoding:'utf8'});
      const original=JSON.stringify(linked());writeFileSync(path,original);const good=run([path]);expect(good.status).toBe(0);expect(JSON.parse(good.stdout).valid).toBe(true);expect(readFileSync(path,'utf8')).toBe(original);
      writeFileSync(path,'{"secret":"PRIVATE-CLI-EXCERPT"');const bad=run([path]);expect(bad.status).toBe(1);expect(bad.stdout).not.toContain('PRIVATE-CLI-EXCERPT');
      const missing=run([join(dir,'not-present.json')]);expect(missing.status).toBe(2);expect(missing.stderr).not.toContain(dir);expect(run([]).status).toBe(2);
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
});

describe('implementation roadmap boundaries',()=>{
  it('covers all 12 paper tools and keeps external acceptance separate with resolvable dependencies',()=>{
    const r=JSON.parse(readFileSync('public/data/implementation-roadmap.json','utf8'));
    expect(r.services).toHaveLength(12);expect(new Set(r.services.map(s=>s.name)).size).toBe(12);expect(r.externalAcceptance).toBe(false);
    const done=new Set();for(const p of r.phases){expect(p.dependsOn.every(id=>done.has(id))).toBe(true);done.add(p.id);for(const lang of ['zh','en']){expect(p.title[lang]).toBeTruthy();expect(p.acceptance[lang]).toBeTruthy();}}
    expect(r.phases.filter(p=>p.status==='implemented').map(p=>p.id)).toEqual(['P1','P2','P4','P5','P6']);expect(r.services.every(s=>done.has(s.phase))).toBe(true);
    expect(r.services.find(s=>s.name==='Swarmcheck').status).toBe('functional-overlap');
  });
});

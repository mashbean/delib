import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {createProject,currentRound,nextRound,validateProject,record} from '../public/workspace-core.js';
import {guidePhases,chooseGuidePhase,guidePhase,saveGuideNote,guideState,guideAgentPrompt} from '../public/facilitator-guide-core.js';
import {facilitatorGuideView} from '../public/facilitator-guide-view.js';
import {rememberWorkspace,rememberedWorkspace} from '../public/workspace-position.js';
import {snapshotWriter} from '../public/workspace-snapshot-writer.js';
const create=()=>createProject({title:'PRIVATE_TITLE',goal:'PRIVATE_GOAL',audience:'PRIVATE_AUDIENCE',deadline:'2026-12-01'});
const guide=JSON.parse(readFileSync(new URL('../public/data/workflow-guide.json',import.meta.url))),stations=JSON.parse(readFileSync(new URL('../public/data/tool-stations.json',import.meta.url)));
afterEach(()=>vi.unstubAllGlobals());
it.each(guidePhases)('persists stage %s without marking records reviewed or changing evidence',phase=>{
 const p=create(),a=record('statement','PRIVATE_SOURCE',{tool:'manual',id:'PRIVATE_ID'});currentRound(p).artifacts.push(a);const before=JSON.stringify(a);
 chooseGuidePhase(p,phase);saveGuideNote(p,'PRIVATE_NOTE');const restored=validateProject(JSON.parse(JSON.stringify(p)));
 expect(guidePhase(restored)).toBe(phase);expect(currentRound(restored).facilitator.note).toBe('PRIVATE_NOTE');expect(JSON.stringify(currentRound(restored).artifacts[0])).toBe(before);
});
it('keeps notes separate across rounds, accepts older workspaces and rejects unknown phases',()=>{
 const p=create();saveGuideNote(p,'First round');nextRound(p,{reason:'Learn more',owner:'Host',date:'2026-12-01',phase:'learn'});saveGuideNote(p,'Second round');
 expect(p.rounds[0].facilitator.note).toBe('First round');expect(p.rounds[1].facilitator.note).toBe('Second round');
 delete currentRound(p).facilitator;currentRound(p).step=2;expect(guidePhase(p)).toBe('respond');expect(()=>validateProject(p)).not.toThrow();
 expect(()=>chooseGuidePhase(p,'complete')).toThrow();currentRound(p).facilitator={phase:'complete',note:''};expect(()=>validateProject(p)).toThrow();
 expect(()=>saveGuideNote(p,'x'.repeat(1001))).toThrow();
});
it.each(['zh','en'])('builds a counts-only AI preview and escaped, linked guidance in %s',lang=>{
 const p=create();saveGuideNote(p,'PRIVATE_NOTE');currentRound(p).artifacts.push(record('statement','PRIVATE_SOURCE',{tool:'manual',id:'PRIVATE_ID'}));
 const before=JSON.stringify(p),prompt=guideAgentPrompt(p,'How do I continue?',lang);
 for(const secret of ['PRIVATE_TITLE','PRIVATE_GOAL','PRIVATE_AUDIENCE','PRIVATE_NOTE','PRIVATE_SOURCE','PRIVATE_ID',p.id,currentRound(p).id])expect(prompt).not.toContain(secret);
 expect(prompt).toContain('Records in scope: 1');expect(prompt).toContain('Unreviewed: 1');expect(prompt).toContain('How do I continue?');expect(JSON.stringify(p)).toBe(before);
 for(const phase of guidePhases){chooseGuidePhase(p,phase);const html=facilitatorGuideView(p,lang,guide,stations);expect(html.match(/data-guide-phase=/g)).toHaveLength(8);expect(html).toContain('IN ·');expect(html).toContain('OUT ·');for(const id of guide.stages.find(x=>x.id===phase).tools)expect(stations.some(t=>t.slug===id)).toBe(true);}
 saveGuideNote(p,'<script>bad</script>');expect(facilitatorGuideView(p,lang,guide,stations)).toContain('&lt;script&gt;bad&lt;/script&gt;');
 expect(()=>guideAgentPrompt(p,'')).toThrow();expect(()=>guideAgentPrompt(p,'x'.repeat(1201))).toThrow();
});
it('resumes from persistent selection if session storage is empty or unavailable',()=>{
 const map=new Map(),local={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};vi.stubGlobal('localStorage',local);vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
 rememberWorkspace('issue-123');expect(rememberedWorkspace()).toBe('issue-123');vi.stubGlobal('localStorage',undefined);expect(rememberedWorkspace()).toBe(null);
});
it('rejects an intervening edit to any project field and retains the confirmed snapshot for retries',async()=>{
 let stored=create();const original=JSON.stringify(stored),store=vi.fn(async(action,{expected,next})=>{expect(action).toBe('compare-save');if(JSON.stringify(stored)!==expected)throw Error('Conflict');stored=structuredClone(next);});const writer=snapshotWriter(store);writer.remember(stored);
 const draft=structuredClone(stored);saveGuideNote(draft,'My note');stored.audience='Updated in another tab';await expect(writer.save(draft)).rejects.toThrow('Conflict');expect(stored.audience).toBe('Updated in another tab');expect(store.mock.calls[0][1].expected).toBe(original);
 stored=JSON.parse(original);await writer.save(draft);expect(stored.rounds[0].facilitator.note).toBe('My note');draft.goal='Next update';await writer.save(draft);expect(stored.goal).toBe('Next update');
});
it('starts a new project only if its id is absent',async()=>{const store=vi.fn(async(a,v)=>{expect(v.expected).toBeUndefined();});await snapshotWriter(store).save(create());expect(store).toHaveBeenCalledOnce();});

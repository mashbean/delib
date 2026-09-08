import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {participantJourney} from '../public/persona-core.js';
import {personalizedJourney,renderPersonaView} from '../public/persona-view.js';
const read=name=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url)));
const bundle=read('flow-demo'),{profiles}=read('persona-profiles');
describe('authored persona journeys retain their evidence boundary',()=>{
 it('covers each fictional identity with distinct bilingual motives, actions and round contexts',()=>{
  expect(profiles.map(p=>p.id).sort()).toEqual(bundle.participants.map(p=>p.id).sort());
  for(const lang of ['zh','en']){
   for(const field of ['motivation','incentive','desiredOutcome'])expect(new Set(profiles.map(p=>p[field][lang])).size).toBe(14);
   for(const p of profiles){expect(p.authored).toBe(true);expect(p.stageActions).toHaveLength(8);expect(p.roundFocus).toHaveLength(3);expect([...p.stageActions,...p.roundFocus].every(v=>typeof v[lang]==='string'&&v[lang].length>5)).toBe(true);}
  }
 });
 it('adds authored prompts without changing any of the 336 attendance or lineage records',()=>{
  const before=JSON.stringify(bundle);
  for(const profile of profiles){const actual=participantJourney(bundle,profile.id),personal=personalizedJourney(bundle,profile.id,profile);expect(personal.map(({authoredFocus,...r})=>({...r,steps:r.steps.map(({authoredPrompt,...s})=>s)}))).toEqual(actual);}
  expect(JSON.stringify(bundle)).toBe(before);
 });
 it('keeps late recruits absent in the first round despite their complete authored prompts',()=>{
  for(const id of ['p13','p14']){const route=personalizedJourney(bundle,id,profiles.find(p=>p.id===id));expect(route[0].steps.every(s=>s.mode==='absent'&&s.sourceRefs.length===0)).toBe(true);expect(route[1].steps.some(s=>s.mode!=='absent')).toBe(true);
   for(const language of ['zh','en']){const view=renderPersonaView({bundle,personId:id,profiles,roundIndex:0,phaseIndex:4,language});expect(view.html).toContain(language==='zh'?'本人此步未出席':'This person is absent');expect(view.html).toContain(language==='zh'?'留給主持人的補接建議':'Facilitator follow-up prompt');}
  }
 });
 it('does not infer motives or participation when profile enrichment is unavailable',()=>{
  const route=personalizedJourney(bundle,'p01');expect(route[0].authoredFocus).toBeUndefined();expect(route[0].steps[0].authoredPrompt).toBeUndefined();
  expect(()=>personalizedJourney({...bundle,simulated:false},'p01',profiles[0])).toThrow(/fictional/);
 });
});

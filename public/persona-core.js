import {personJourney,traceArtifact} from './pipeline-core.js';
// Only fictional fixtures may produce persona journeys. No inferred real identities or emotions.
export function participantJourney(bundle,participantId){
 if(bundle.simulated!==true)throw new Error('Persona journeys require a fictional fixture');
 const person=bundle.participants.find(p=>p.id===participantId);
 if(!person?.simulated)throw new Error('Unknown fictional participant');
 return bundle.rounds.map((round,roundIndex)=>({roundId:round.id,title:round.title,steps:personJourney(bundle,roundIndex,participantId).map((step,index)=>{
 const sources=round.artifacts.filter(a=>a.participantRef===participantId&&a.phaseId===step.phaseId);
 const earlier=bundle.rounds.slice(0,roundIndex+1).flatMap(r=>r.artifacts).filter(a=>a.participantRef===participantId);
 const descendants=new Set(earlier.flatMap(a=>traceArtifact(bundle,a.id).descendants));
 return {...step,index,sourceRefs:sources.map(a=>a.id),resultRefs:round.artifacts.filter(a=>a.phaseId===step.phaseId&&descendants.has(a.id)).map(a=>a.id)};
 })}));
}

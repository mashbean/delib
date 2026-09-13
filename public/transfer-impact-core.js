// Describes the existing workspace-text/1 boundary; it does not infer receiver support.
import {transferCsv,sourceWarnings} from './workspace-transfer-core.js';
import {parseCsvWithHeaders} from './pocket-polis-data-core.js';
import {openParticipation} from './facilitation-core.js';
export function transferImpact(plan) {
  const rows=parseCsvWithHeaders(transferCsv(plan),['id','interview','comment'],'handoff');
  let identifierWarnings=0,validationBlocked=false;
  try {identifierWarnings=sourceWarnings(plan).length;} catch {validationBlocked=true;}
  return {
    schema:'delib-transfer-impact/v1',mappingVersion:plan.mappingVersion,tool:plan.tool,
    counts:{sources:plan.inputs.length,context:plan.annotations.length,
      protectedText:rows.filter((r,i)=>r.comment!==plan.inputs[i].text).length,
      protectedIds:rows.filter((r,i)=>r.id!==plan.inputs[i].id).length,
      relations:[...plan.inputs,...plan.annotations].reduce((n,a)=>n+a.relations.length,0),
      unchecked:plan.inputs.filter(a=>!a.reviewed).length,identifierWarnings},
    validationBlocked,
    fields:[
      {field:'text',destination:'csv-comment',companion:'snapshot'},
      {field:'record-id',destination:'csv-id',companion:'snapshot'},
      {field:'context',destination:plan.tool==='reply'?'joined-positions':'absent',companion:plan.tool==='reply'?'snapshot':'not-selected'},
      {field:'kind-relations-review',destination:'absent',companion:'snapshot'},
      {field:'issue',destination:'service-metadata-only',companion:'snapshot'},
      {field:'identity-votes',destination:'absent',companion:'absent'},
      {field:'commitments-gaps',destination:'absent',companion:'absent'},
    ],
    notice:'This report describes the outgoing mapping, not delivery or receiver acceptance. Free text may contain identifiers. The full project backup retains more context than the transfer companion.'
  };
}
export function transferGuidance(project,plan) {
  const r=project.rounds.find(r=>r.id===plan.roundId),gaps=openParticipation(r);
  return {unchecked:plan.inputs.filter(a=>!a.reviewed).map(a=>a.id),gapCount:gaps.length};
}

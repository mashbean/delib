// Optional v1 extensions. Human review, commitment and disposition are independent records.
export const commitmentStates = ['draft','confirmed','committed','piloting','review-due','closed'];
export const dispositionStates = ['pending','adopted','deferred','not-adopted'];
export const participationStates = ['missing','invited','heard','follow-up'];
export const commitmentKinds = ['proposal','reply','decision'];
export const dispositionKinds = ['statement','question','proposal','feedback'];
export const latest = entries => entries?.at(-1) || null;
const all = p => p.rounds.flatMap(r => r.artifacts);
const round = p => p.rounds.find(r => r.id === p.view.roundId) || p.rounds.at(-1);
const validText = (value,max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const stamp = () => ({id:crypto.randomUUID(),at:new Date().toISOString()});
const attribution = entry => validText(entry.id,120) && validText(entry.by,100) && validText(entry.at,50) && !Number.isNaN(Date.parse(entry.at));
const responsibility = entry => validText(entry.owner,100) && validDate(entry.reviewOn);
const fail = (zh,en) => { throw new Error(`${zh} / ${en}`); };
export function allowedCommitments(status = 'draft') {
  return {draft:['draft','confirmed'],confirmed:['draft','confirmed','committed'],committed:['draft','committed','piloting','review-due'],piloting:['draft','piloting','review-due'],'review-due':['draft','confirmed','review-due','closed'],closed:['draft','confirmed','closed']}[status] || [];
}
function validateHistory(entries,validate) {
  if(!Array.isArray(entries) || !entries.length || entries.length > 60) throw new Error('Invalid history size');
  const ids = new Set();let previous;
  for(const entry of entries) {
    if(!entry || !attribution(entry) || ids.has(entry.id) || (previous && Date.parse(entry.at) < Date.parse(previous.at))) throw new Error('Invalid history attribution');
    validate(entry,previous);ids.add(entry.id);previous = entry;
  }
}
export function validateRecordFollowup(record) {
  if(record.commitments !== undefined) {
    if(!commitmentKinds.includes(record.kind)) throw new Error('Commitment needs a proposal, reply or decision');
    validateHistory(record.commitments,(entry,previous) => {
      if(!allowedCommitments(previous?.status).includes(entry.status) || !responsibility(entry) || !validText(entry.note,2000) || typeof entry.authorityConfirmed !== 'boolean' || (entry.status !== 'draft' && (!entry.authorityConfirmed || !record.review?.checked))) throw new Error('Invalid commitment or transition');
    });
  }
  if(record.dispositions !== undefined) {
    if(!dispositionKinds.includes(record.kind)) throw new Error('Disposition needs a voice, proposal or open question');
    validateHistory(record.dispositions,entry => {
      if(!dispositionStates.includes(entry.status) || !responsibility(entry) || !validText(entry.reason,2000)) throw new Error('Invalid disposition');
    });
  }
  return record;
}
export function validateFacilitation(project) {
  if(project.view.mode !== undefined && !['focus','overview'].includes(project.view.mode)) throw new Error('Invalid workspace mode');
  const priorGapIds = new Set();
  for(const r of project.rounds) {
    if(r.participation !== undefined) {
      if(!Array.isArray(r.participation) || r.participation.length > 100) throw new Error('Invalid participation register');
      const ids = new Set();
      for(const gap of r.participation) {
        if(!validText(gap.id,120) || ids.has(gap.id) || priorGapIds.has(gap.id) || (gap.carriedFrom !== undefined && !priorGapIds.has(gap.carriedFrom))) throw new Error('Invalid participation lineage');
        validateHistory(gap.history,entry => {
          if(!participationStates.includes(entry.status) || !validText(entry.group,200) || !validText(entry.barrier,1000) || !validText(entry.action,1000) || !validText(entry.note,2000) || !responsibility(entry)) throw new Error('Invalid participation entry');
        });
        ids.add(gap.id);
      }
      ids.forEach(id => priorGapIds.add(id));
    }
    r.artifacts.forEach(validateRecordFollowup);
  }
  return project;
}
export function setCommitment(project,recordId,input) {
  const target = all(project).find(a => a.id === recordId);
  if(!target || !commitmentKinds.includes(target.kind)) fail('請選擇方案或回覆','Choose a proposal or reply');
  if(all(project).some(a => a.supersedes === recordId)) fail('請在最新修訂記錄承諾','Use the latest revision');
  if(input.status !== 'draft' && (!target.review.checked || input.authorityConfirmed !== true)) fail('先檢查文字，並取得責任人的確認','Review the wording and obtain the owner’s confirmation first');
  const entry = {...input,...stamp()};
  const candidate = {...target,commitments:[...(target.commitments || []),entry]};
  validateRecordFollowup(candidate);target.commitments = candidate.commitments;return entry;
}
export function setDisposition(project,recordId,input) {
  const target = all(project).find(a => a.id === recordId);
  if(!target || !dispositionKinds.includes(target.kind)) fail('請選擇原話、方案或未解問題','Choose a voice, proposal or open question');
  if(all(project).some(a => a.supersedes === recordId)) fail('請在最新修訂記錄去向','Use the latest revision');
  const entry = {...input,...stamp()};
  const candidate = {...target,dispositions:[...(target.dispositions || []),entry]};
  validateRecordFollowup(candidate);target.dispositions = candidate.dispositions;return entry;
}
export function saveParticipation(project,gapId,input) {
  const r = round(project),entries = r.participation || [],previous = entries.find(g => g.id === gapId);
  if(gapId && !previous) fail('找不到這筆參與缺口','Participation entry not found');
  const gap = {...(previous || {id:crypto.randomUUID()}),history:[...(previous?.history || []),{...input,...stamp()}]};
  const next = previous ? entries.map(g => g.id === gapId ? gap : g) : [...entries,gap];
  validateFacilitation({...project,rounds:project.rounds.map(x => x === r ? {...r,participation:next} : x)});
  r.participation = next;return gap;
}
export const openParticipation = r => (r.participation || []).filter(g => latest(g.history)?.status !== 'heard');
export function carryParticipation(r) {
  return openParticipation(r).map(g => ({id:crypto.randomUUID(),carriedFrom:g.id,history:structuredClone(g.history)}));
}
export function needsFollowup(record) {
  const disposition = latest(record.dispositions),commitment = latest(record.commitments);
  return !record.review.checked || record.kind === 'feedback' ||
    (dispositionKinds.includes(record.kind) && (!disposition || ['pending','deferred'].includes(disposition.status))) ||
    (commitmentKinds.includes(record.kind) && disposition?.status !== 'not-adopted' && commitment?.status !== 'closed');
}
export function roundFollowups(project,r = round(project)) {
  const ids = new Set([...r.inputs,...r.artifacts.map(a => a.id)]),records = all(project),superseded = new Set(records.map(a => a.supersedes).filter(Boolean));
  return records.filter(a => ids.has(a.id) && !superseded.has(a.id) && needsFollowup(a));
}
export function voiceTrailExport(project,records) {
  // Project-level gap notes and management context never enter a participant's receipt.
  return {schema:'delib-voice-trail/v1',simulated:project.simulated,private:true,issue:project.title,exportedAt:new Date().toISOString(),records:structuredClone(records)};
}

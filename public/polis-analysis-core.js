// Aggregate-only analysis bridge. No personal coordinates or participant mappings.
export const POLIS_ANALYSIS_SCHEMA='delib-polis-analysis/v1';
export const POLIS_SOURCE_REVISION='f7ec343b6ec7ee39a7586f4eba49771f0009738c';
const fail=()=>{throw new Error('Polis analysis fields or source references do not match / Polis 分析欄位或來源不符');};
const count=v=>Number.isSafeInteger(v)&&v>=0;
const list=v=>Array.isArray(v)&&v.length<=5000;
const text=v=>typeof v==='string'&&v.trim()&&v.length<=12000;
const optionalCount=v=>v===null||count(v);
const rate=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const unique=values=>new Set(values).size===values.length;

export function buildPolisAnalysis({conversationId,statements,result=null,synthesis=null,sourceRevision=null,sourceFormat='pocket-polis',evidence=null}) {
  if(!text(conversationId)||conversationId.length>200||!['pocket-polis','polis-open-data'].includes(sourceFormat)||!list(statements)||!statements.length)fail();
  if(sourceRevision!==null&&!/^[a-f0-9]{40}$/.test(sourceRevision))fail();
  const sources=statements.map(s=>{
    if(!count(s.statementId)||!text(s.text)||!['approved','pending','rejected'].includes(s.status)||![true,false,null].includes(s.isSeed)||!count(s.agrees)||!count(s.disagrees)||!optionalCount(s.passes))fail();
    return {statementId:s.statementId,text:s.text,status:s.status,isSeed:s.isSeed,agrees:s.agrees,disagrees:s.disagrees,passes:s.passes};
  });
  if(!unique(sources.map(s=>s.statementId)))fail();
  const approved=new Map(sources.filter(s=>s.status==='approved').map(s=>[s.statementId,s]));
  let analysis=null,summary=null;
  if(result!==null){
    const r=result.result||result;
    if(!count(r.computedAt)||!Number.isFinite(new Date(r.computedAt).valueOf())||!['nParticipantsTotal','nParticipantsClustered','nVotes','nStatements','inclusionThreshold','k'].every(k=>count(r[k]))||r.nParticipantsClustered>r.nParticipantsTotal||r.nStatements!==approved.size||!list(r.groups)||!list(r.statementStats)||!list(r.consensus?.agree)||!list(r.consensus?.disagree)||r.k!==r.groups.length)fail();
    const stat=(s,max)=>{if(!approved.has(s.sid)||!['agrees','disagrees','passes','seen'].every(k=>count(s[k]))||s.agrees+s.disagrees+s.passes!==s.seen||s.seen>max)fail();return {sid:s.sid,agrees:s.agrees,disagrees:s.disagrees,passes:s.passes,seen:s.seen};};
    const stats=r.statementStats.map(s=>stat(s,r.nParticipantsTotal));
    if(!unique(stats.map(s=>s.sid))||stats.length!==approved.size||stats.reduce((n,s)=>n+s.seen,0)!==r.nVotes)fail();
    const mismatch=stats.filter(s=>{const a=approved.get(s.sid);return a.agrees!==s.agrees||a.disagrees!==s.disagrees||(a.passes!==null&&a.passes!==s.passes);}).map(s=>s.sid);
    if(mismatch.length)throw new Error('Snapshots differ; download matching statements and results / 快照票數不同，請取得同一狀態的陳述與結果');
    const representative=s=>{if(!approved.has(s.sid)||!['agree','disagree'].includes(s.direction)||!rate(s.prob)||!['probTest','repness','repnessTest','metric'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))||!count(s.nSuccess)||!count(s.nSeen)||s.nSuccess>s.nSeen)fail();return Object.fromEntries(['sid','direction','prob','probTest','repness','repnessTest','metric','nSuccess','nSeen'].map(k=>[k,s[k]]));};
    const groups=r.groups.map(g=>{if(!count(g.id)||!text(g.label)||!count(g.size)||!list(g.representative)||!list(g.statementStats)||!(g.statsRedacted===undefined||typeof g.statsRedacted==='boolean'))fail();const gs=g.statementStats.map(s=>stat(s,g.size));if(!unique(gs.map(s=>s.sid))||(g.statsRedacted&&(gs.length||g.representative.length)))fail();const reps=g.representative.map(representative);if(reps.some(s=>s.nSeen>g.size))fail();return {id:g.id,label:g.label,size:g.size,statsRedacted:g.statsRedacted===true,statementStats:gs,representative:reps};});
    if(!unique(groups.map(g=>g.id))||groups.reduce((n,g)=>n+g.size,0)>r.nParticipantsClustered)fail();
    const consensus=Object.fromEntries(['agree','disagree'].map(direction=>[direction,r.consensus[direction].map(s=>{if(!approved.has(s.sid)||s.direction!==direction||!rate(s.prob)||!['probTest','metric'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])))fail();return {sid:s.sid,direction,prob:s.prob,probTest:s.probTest,metric:s.metric};})]));
    let bridging=null;if(r.bridging!=null){const b=r.bridging;if(b.method!=='matrix-factorization-1d'||!['nParticipants','minSeen','iterations'].every(k=>count(b[k]))||!list(b.statements))fail();bridging={method:b.method,nParticipants:b.nParticipants,minSeen:b.minSeen,iterations:b.iterations,statements:b.statements.map(s=>{if(!approved.has(s.sid)||!Number.isFinite(s.score)||!rate(s.polarity)||!['seen','agrees','disagrees'].every(k=>count(s[k]))||s.agrees+s.disagrees>s.seen)fail();return {sid:s.sid,score:s.score,polarity:s.polarity,seen:s.seen,agrees:s.agrees,disagrees:s.disagrees};})};}
    analysis={computedAt:r.computedAt,nParticipantsTotal:r.nParticipantsTotal,nParticipantsClustered:r.nParticipantsClustered,nVotes:r.nVotes,nStatements:r.nStatements,inclusionThreshold:r.inclusionThreshold,k:r.k,groups,statementStats:stats,consensus,bridging,coverage:{voteMatrix:r.nParticipantsTotal*r.nStatements?r.nVotes/(r.nParticipantsTotal*r.nStatements):null,clusteredShare:r.nParticipantsTotal?r.nParticipantsClustered/r.nParticipantsTotal:null}};
    if(synthesis!==null){
      const s=synthesis;if(s.status!=='ready'||s.version!=='v1'||!['ai','deterministic'].includes(s.generationMode)||!text(s.model)||!count(s.generatedAt)||!count(s.mathRevision)||!count(s.privacyVersion)||!['zh','en'].includes(s.lang)||!s.provenance)fail();
      const p=s.provenance;if(!['generatedAt','mathRevision','participantCount','clusteredCount','statementCount','voteCount','groupCount'].every(k=>count(p[k])))fail();
      if(p.mathRevision!==s.mathRevision||p.generatedAt!==s.generatedAt||p.participantCount!==r.nParticipantsTotal||p.clusteredCount!==r.nParticipantsClustered||p.statementCount!==r.nStatements||p.voteCount!==r.nVotes||p.groupCount!==r.groups.length||s.isStale===true)throw new Error('Synthesis is stale or from another analysis / 綜整過期或來自不同分析');
      const citations=ids=>{if(!list(ids)||!ids.length||!unique(ids)||ids.some(id=>!approved.has(id)))fail();return [...ids];};
      const joined=(...values)=>{if(values.some(v=>!text(v)))fail();return values.join('\n');};
      const passages=[];const add=(id,value,ids)=>{if(!text(value))fail();passages.push({id,text:value,citedStatementIds:citations(ids)});};
      add('overview',s.overview?.summary,s.overview?.citedStatementIds);
      if(!list(s.themes)||!list(s.commonGround?.keyPoints)||!list(s.groupPortraits)||!list(s.tensions))fail();
      s.themes.forEach((t,i)=>add(`theme-${i}`,joined(t.title,t.description),t.statementIds));
      s.commonGround.keyPoints.forEach((t,i)=>add(`common-${i}`,joined(t.title,t.description),t.citedStatementIds));
      s.groupPortraits.forEach((t,i)=>{if(!groups.some(g=>g.id===t.groupId&&g.size===t.size))fail();add(`portrait-${i}`,joined(t.title,t.summary),t.citedStatementIds);});
      s.tensions.forEach((t,i)=>{if(!groups.some(g=>g.id===t.groupAId)||!groups.some(g=>g.id===t.groupBId))fail();add(`tension-${i}`,joined(t.topic,t.tensions,t.bridgingQuestion),t.citedStatementIds);});
      summary={version:s.version,privacyVersion:s.privacyVersion,generationMode:s.generationMode,model:s.model,generatedAt:s.generatedAt,mathRevision:s.mathRevision,lang:s.lang,provenance:Object.fromEntries(['generatedAt','mathRevision','participantCount','clusteredCount','statementCount','voteCount','groupCount'].map(k=>[k,p[k]])),alignment:'counts-only; results API omits revision',passages};
    }
  }else if(synthesis!==null)fail();
  return {schema:POLIS_ANALYSIS_SCHEMA,conversationId,sourceFormat,sourceRevision,statements:sources,analysis,synthesis:summary,evidence};
}

export function normalizePolisAnalysis(input){
  if(input?.schema!==POLIS_ANALYSIS_SCHEMA)fail();
  // Reconstruct original-shaped inputs and revalidate every normalized package on import.
  let synthesis=null;if(input.synthesis){const s=input.synthesis;if(!list(s.passages)||!s.passages.length||!unique(s.passages.map(p=>p.id))||s.passages.some(p=>!text(p.id)||!text(p.text)))fail();synthesis={...s,status:'ready',overview:{summary:s.passages[0].text,citedStatementIds:s.passages[0].citedStatementIds},themes:s.passages.slice(1).map(p=>({title:p.id,description:p.text,statementIds:p.citedStatementIds})),commonGround:{keyPoints:[]},groupPortraits:[],tensions:[]};}
  const validated=buildPolisAnalysis({...input,result:input.analysis,synthesis});
  validated.synthesis=input.synthesis?{...validated.synthesis,passages:input.synthesis.passages.map(p=>({id:p.id,text:p.text,citedStatementIds:[...p.citedStatementIds]}))}:null;
  return validated;
}
export function polisAnalysisRecords(input){
  const validated=normalizePolisAnalysis(input);
  const entries=validated.statements.map(s=>({id:`statement-${s.statementId}`,kind:'statement',text:s.text,origin:s.isSeed===false?'participant':s.isSeed===true?'organizer':'source-excerpt',relations:[],fields:{...s},eligible:s.status==='approved'&&s.isSeed===false}));
  if(validated.analysis){const a=validated.analysis;entries.push({id:'analysis',kind:'method-result',text:'Polis · aggregate analysis / 彙整分析',origin:'calculated',relations:validated.statements.filter(s=>s.status==='approved').map(s=>({ref:`statement-${s.statementId}`,type:'derived'})),fields:{...a,sourceRevision:validated.sourceRevision},eligible:false});}
  // Keep original passage IDs/text after validation; never promote summaries to source voices.
  for(const p of input.synthesis?.passages||[])entries.push({id:`synthesis-${p.id}`,kind:'theme',text:p.text,origin:input.synthesis.generationMode==='ai'?'model':'calculated',relations:p.citedStatementIds.map(id=>({ref:`statement-${id}`,type:'derived'})),fields:{model:input.synthesis.model,generationMode:input.synthesis.generationMode,mathRevision:input.synthesis.mathRevision,privacyVersion:input.synthesis.privacyVersion},eligible:false});
  return entries;
}

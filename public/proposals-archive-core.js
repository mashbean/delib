// A typed content archive, not a transcript or an endorsement-to-consensus conversion.
export function proposalArchiveRecords(input) {
  const fail=()=>{throw new Error('Invalid proposal archive or version lineage / 提案歷程或版本關係不完整');};
  const list=v=>Array.isArray(v)&&v.length<=5000?v:fail();
  const positive=v=>Number.isSafeInteger(v)&&v>0;
  const count=v=>Number.isSafeInteger(v)&&v>=0;
  const body=v=>typeof v==='string'&&v.trim()&&v.length<=12000;
  if(input.schema!=='pocket-proposals-archive/v1'||!Number.isFinite(Date.parse(input.exportedAt)))fail();
  const output=[],ids=new Set();
  const add=(id,kind,text,relations,fields,eligible=false)=>{
    if(ids.has(String(id))||!body(text))fail();ids.add(String(id));
    output.push({id,kind,text,relations,fields,eligible});
  };
  for(const p of list(input.proposals)) {
    if(!positive(p.id)||!positive(p.version)||!body(p.title)||!count(p.endorsements))fail();
    const versions=list(p.versions),amendments=list(p.amendments),responses=list(p.responses);
    if(versions.length!==p.version)fail();
    const versionId=v=>`version-${p.id}-${v}`;
    for(const a of amendments) {
      if(!positive(a.id)||a.proposalId!==p.id||!positive(a.baseVersion)||a.baseVersion>p.version||!['open','accepted','declined'].includes(a.state)||!body(a.rationale)||!count(a.endorsements)||!count(a.added)||!count(a.removed))fail();
      const {alias,endorsed,...fields}=a;
      add(`amendment-${a.id}`,'proposal-amendment',a.body,[{ref:versionId(a.baseVersion),type:'revises'}],fields);
    }
    for(let i=0;i<versions.length;i++) {
      const v=versions[i];if(v.version!==i+1)fail();
      const edges=i?[{ref:versionId(i),type:'revises'}]:[];
      if(i===0) { if(v.source!=='original')fail(); }
      else {
        const amendment=amendments.find(a=>`amendment-${a.id}`===v.source);
        if(!amendment||amendment.state!=='accepted'||amendment.baseVersion>=v.version||amendment.body!==v.body)fail();
        edges.push({ref:v.source,type:'derived'});
      }
      add(versionId(v.version),'proposal-version',v.body,edges,{...v,proposalId:p.id});
    }
    if(versions.at(-1)?.body!==p.body)fail();
    for(const a of amendments)if(a.state==='accepted'&&versions.filter(v=>v.source===`amendment-${a.id}`).length!==1)fail();
    const {alias,mine,endorsed,versions:ignoredVersions,amendments:ignoredAmendments,responses:ignoredResponses,...fields}=p;
    add(p.id,'proposal',p.body,[{ref:versionId(p.version),type:'derived'}],fields,true);
    for(const r of responses) {
      if(!positive(r.id)||r.proposalId!==p.id)fail();
      const {alias,...fields}=r;
      // The native API records the proposal, but not its version at response time.
      add(`response-${r.id}`,'proposal-response',r.text,[{ref:String(p.id),type:'context'}],{...fields,versionAtResponse:'unknown'});
    }
  }
  return output;
}

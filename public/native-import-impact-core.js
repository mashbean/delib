// Describe the validated import plan; never decide eligibility a second time.
export function nativeImportDisposition(record) {
 return record.quarantined ? 'restricted' : record.eligible ? 'source' : 'context';
}
export function nativeImportImpact(plan) {
 const counts={source:0,context:0,restricted:0}, mappings=new Map();
 const originals=new Map(plan.entry.bundle.records.map(r=>[r.id,r]));
 for(const record of plan.records){
  const disposition=nativeImportDisposition(record),native=originals.get(record.nativeRef.recordId);
  counts[disposition]++;
  const key=JSON.stringify([native.kind,record.kind,disposition]);
  const row=mappings.get(key)||{from:native.kind,to:record.kind,disposition,count:0};
  row.count++;mappings.set(key,row);
 }
 const losses={};
 // Fixed action names only. Paths and reasons can contain imported private text.
 for(const action of ['preserved','transformed','aggregated','blocked','unavailable','review','dropped'])
  losses[action]=plan.entry.bundle.losses.filter(l=>l.action===action).length;
 const matched=new Set(plan.entry.sourceLinks.map(l=>l.recordId));
 return {counts,mappings:[...mappings.values()],losses,matchedSources:matched.size,
  unresolvedSources:plan.entry.bundle.externalSources.filter(s=>!matched.has(s.id)).length};
}

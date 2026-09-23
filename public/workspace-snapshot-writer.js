// Keep the last confirmed snapshot separate from the mutable UI draft.
// Called serially by createPersistence; a conflict never advances the expected value.
export function snapshotWriter(store){
  const snapshots=new Map();
  return {remember:p=>snapshots.set(p.id,JSON.stringify(p)),async save(next){
    const serialized=JSON.stringify(next);
    await store('compare-save',{expected:snapshots.get(next.id),next});
    snapshots.set(next.id,serialized);
  }};
}

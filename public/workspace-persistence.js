// Immutable snapshots and serial writes prevent an older completion from saving over a newer draft.
export function createPersistence(write, onChange = () => {}) {
  const states = new Map();
  let tail = Promise.resolve();
  const get = id => states.get(id) || {status: 'stored', revision: 0, savedRevision: 0, at: null};
  return {
    get,
    dirty: () => [...states].filter(([, state]) => state.revision > state.savedRevision).map(([id]) => id),
    save(value) {
      const snapshot = structuredClone(value), id = snapshot.id, prior = get(id), revision = prior.revision + 1;
      states.set(id, {...prior, revision, status: 'saving'});
      onChange();
      const task = tail.then(() => write(snapshot));
      tail = task.catch(() => {}); // A failure must not block the next attempt.
      return task.then(() => {
        const current = get(id);
        states.set(id, {...current, savedRevision: revision,
          ...(current.revision === revision ? {status: 'stored', at: new Date().toISOString()} : {})});
        onChange();
      }, error => {
        const current = get(id);
        if (current.revision === revision) states.set(id, {...current, status: 'error'});
        onChange();
        throw error; // Callers must not announce success or continue a handoff after a failed write.
      });
    },
    settle: () => tail,
    forget(id) { states.delete(id); onChange(); }
  };
}

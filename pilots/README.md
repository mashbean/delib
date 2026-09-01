# Reproducible pilots

Pilots exercise Delib against public or explicitly authorized synthetic data.
They are evidence for Delib's own adapters and handoff boundaries, not proof
that a hosted downstream service accepted an import.

## Fictional defense-budget Pocket Polis pilot

`defense-budget.json` points to the open-data Pocket Polis demo and records the
organizer-authored interpretation, missing voices, accountability fields and
eight statements selected for the public receipt. Every claim remains labelled
as fictional and non-representative.

Run from the Delib repository:

```bash
npm run pilot:pocket-polis
```

The default output is
`/Users/mashbean/Developer/output/delib-pocket-polis-defense-pilot`. Override it
with `npm run pilot:pocket-polis -- --out /absolute/output/path`.

The runner only reads a conversation's public information, public result and
open-data CSV endpoints. It stops if the activity does not expose anonymous
CSV data and never asks for or attempts to recover an admin token.

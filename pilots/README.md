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

### 工具整理層

`defense-budget.json` 的 `toolSynthesis` 會挑選 Pocket Polis 綜整（Workers AI Gemma 或
無模型的統計摘要）的概述、前幾個跨群共同點與張力放進收據，並保留模型名稱、產生時間與
是否過期。綜整尚未就緒時，pilot 會照常完成，只在報告註明未納入。

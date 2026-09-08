> Historical snapshot. The 2026-09-08 adapters supersede the missing-adapter findings below. See [iteration five](iteration-five-2026-09-08.md) and `/data/adapter-matrix.json`; `npm run audit:interop` inspects executable adapter exports.

# Delib interoperability audit

Date: 2026-09-07

This audit is generated from the checked-in registries and local adapter code.
It does not create activities, call upstream APIs or claim semantic equivalence.
Run `npm run audit:interop` to refresh the machine-readable check.

## Coverage

- 38 tools: 20 integrated, 18 catalog-only.
- Integration registry: 20 entries plus 18 catalog-only entries.
- Registry coverage is complete: every tool ID appears exactly once in the
  integration audit.
- Hosting routes currently include direct, component, shared-host, connected,
  unverified, research and blocked states. A route is not an interoperability
  claim.

## Canonical contract surfaces

| Contract | Required role |
| --- | --- |
| `delib-data/v1` | Cross-tool phases, items, responses, outcomes, provenance and privacy card |
| `delib-rounds/v1` | Multi-round issue, participants, attendance mode, derivation and handoff context |
| `delib-workspace/v1` | Private local organizer workspace, review state and view position |

The three contracts complement each other. None alone currently guarantees
withdrawal propagation, activity-scoped identity consent or semantic equality
between methods.

## Adapter boundary

| Surface | Local path | Current interpretation |
| --- | --- | --- |
| Pocket Polis | `pocketPolisBundleToDelibData()` | Implemented local conversion; participant-aware and private |
| Power Ranker | `rankingBundleToDelibData()` | Implemented local conversion; aggregate and individual modes remain distinct |
| TTTC CSV | `parseTttcCsv()` / `tttcRowsToCsv()` | Compatibility bridge for `id,interview,comment` |
| Form native JSON | None detected | Next adapter gate |
| Harmonica native JSON | None detected | Next adapter gate |
| Pocket TTTC report JSON | None detected | Next adapter gate |
| Pocket Reply native JSON | None detected | Next adapter gate |

The existing CSV bridge preserves source IDs and warnings but cannot carry all
method semantics such as votes, consent, revision history, responsibility or
withdrawal state. A successful CSV parse is therefore only syntax
compatibility.

## Ordered implementation queue

1. Add native JSON adapters and fixtures for Form, Harmonica, Pocket TTTC and
   Pocket Reply.
2. Make every adapter emit preserved, transformed, aggregated, dropped,
   consent-blocked and human-review fields.
3. Add withdrawal tombstones and typed derivation links to the canonical
   envelope.
4. Verify the exact current Civic Talk/Sensemaking product and export contract
   before accepting it as an adapter target.
5. Keep upstream writes behind the existing human confirmation boundary.

# Iteration six: an inspectable deliberation handoff

2026-09-09. Based on Hughes et al., [Towards Interoperability](https://doi.org/10.1145/3737609.3747119), especially §§2–5. These are Delib contracts, not a claim to implement a released Metagov ontology.

## Delivery sequence

| Stage | Work | Acceptance | Status |
| --- | --- | --- | --- |
| 0 | Plan and inspect current workspace, exchange, facilitation and service contracts | Identify existing behavior, data boundaries and migration requirements | Complete |
| 1 | Optional, versioned workspace transfer records; immutable input snapshots; explicit mapping and lifecycle | Old backups load; invalid/stale inputs rejected; no participant IDs or credentials in transfer exports; downloaded files never imply delivery | Complete |
| 2 | Bilingual “Prepare next step” workspace tab with source selection, IN/OUT preview, private companion and history | One place to inspect sources, what the destination reads, what stays local, and observed service progress; mobile/light/dark/reduced-motion usable | Complete |
| 3 | Connect transfer provenance to voice trails; evidence-based next-round suggestions and four-operation/eight-method-step mapping | A voice links to its transfer; unresolved work and participation gaps explain a proposed next step; facilitator retains control | Complete |
| 4 | Regression checks, synthetic two-round service loop, browser review, production deployment and read-only verification | Unit and Worker suites, prior workspace flows, export/reload, failure handling, public build verified | Released as 6398113; CI deploy and production smoke passed |
| 5a | Native exchange and tool-file import into workspace; file round trips; compare versions | Typed method fields preserved, file provenance reconnects by exact IDs/text, old backups load | Implemented; see stage-five-native-import.md for acceptance |
| 5b | Expanded remote round trips and Sensemaker result contract | Verify current production exports and destination support separately for each edge | Pending; no new upstream writes or Sensemaker conformance claimed |
| 6 | Connect the 3D view to observed workspace transfers and selectable voice paths | Same records power 2D/3D; online/offline events use recorded context; no invented delivery animations | Follow-on |
| 7 | Metagov crosswalk and external-team acceptance | Obtain current ontology and translated flatfiles from authors; publish tested mappings with agreed vocabulary | External input needed |

Stages 1–4 form the first independently useful release. They extend the existing Form → TTTC → Reply route. They do not require rewriting every Pocket service or adding a central participant database. Stage 5 must preserve typed votes, amendments and method data rather than flattening everything into source text.

## Structure

- `workspace-transfer-core.js`: transfer plan, snapshots, lifecycle, validation and next-step guidance. Optional `project.transfers` extends workspace v1 without invalidating old backups.
- `workspace-transfer-view.js` / `.css`: shared preview, transfer history and method-step bridge. The same IN/OUT explanation is used before service sends and manual export.
- `workspace.js`: source selection, downloads, service receipt observations and links back to voice records.
- Existing `workspace-core.js`, `facilitation-core.js`: remain the owners of records, review, disposition and commitments. Review is not consent or authority.

## Contract boundaries

The private companion preserves the project context and immutable selected record snapshots; the destination CSV carries record IDs and source text. Reply receives reviewed synthesis as context. Identity, vote data, commitment history and local reviews are not silently promoted into destination input. Exports list these limitations. Local companions are not publicly published.

Lifecycle: prepared → exported (manual file only), or submitted → received → completed → reconnected. Uncertain creation must be recorded and never retried automatically. An old connection without a receipt remains a legacy connection, not retroactive evidence of a successful transfer. Simulation is explicitly marked and cannot send to remote services.

Validation covers snapshot staleness, activity scope, revisions, mixed-purpose context, forged/missing references, duplicate receipt IDs, invalid transitions, failed/unknown remote outcomes and backup compatibility. A linked result remains subject to human review. Actual cross-service deletion, identity linkage, a participant authentication service and Metagov conformance remain outside this release.

## Implementation evidence

- Source snapshot and lifecycle logic, private companion export, and interrupted-submit recovery implemented as optional workspace v1 fields.
- Bilingual source selection and shared IN → CHECK → OUT preview implemented. Manual CSV downloads remain distinct from observed API receipt and source reconnection. Connected tools expose their read/result controls in transfer history.
- Voice trails exclude edges that are only background context, preventing a shared theme from pulling another participant’s reply into a direct response path. Private voice exports include scoped transfer progress without exporting other transfer input snapshots.
- Next-round suggestions use participation gaps, pending reviews, commitments and unresolved records. The facilitator explicitly applies and edits a suggestion.
- Four workspace operations now link to the corresponding eight-method-step ranges.
- `scripts/dev-workspace-fixtures.mjs` is a loopback-only UI acceptance server with no outbound requests. It supports the normal form/analysis/reply lifecycle and an explicit uncertain-send fixture.

### Browser acceptance (local)

2026-09-09: tested with the in-app browser. Chinese and English, light and dark themes, 390 × 844 viewport without horizontal overflow, fictional CSV + companion download, persistent history, source selection and reviewed Reply context. A separate fixture origin completed Form → TTTC → Reply; both transfers reached `reconnected` based on returned IDs. Reload retained the records. After checking the theme, one source traced to its theme and its own reply, excluding the other reply’s context-only edge. Next-step suggestion populated an editable form, Round 2 was created and survived reload. The downloaded private backup contained 2 rounds, 2 transfer records and no management credential. These checks do not establish a new live upstream round trip.

Validation: `npm run check` passed (172 unit tests + 56 Worker tests, type checks, scene build and deploy dry run). Export-companion schema uses `delib-workspace-transfer-export/v1` around a validated `delib-workspace-transfer/v1` snapshot. Release uses the existing main → check → deploy → smoke workflow.

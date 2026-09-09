# Stage 5a: bring native tool data into a working issue

2026-09-09. Extends iteration six's inspectable handoff. Scope is local file exchange; it does not claim Metagov conformance, a shared participant identity, or new verified upstream service delivery.

## Delivered behavior

“Bring tool data back” is available from the current step and Prepare next step. The home exchange panel links to the workspace after downloading a private companion. Choose a format and file, inspect IN → CHECK → OUT, then confirm local import.

Accepted paths reuse the existing exchange adapters: Form, Harmonica, TTTC, Reply, Values, Budget, Check, Proposals, Argument, Maple, Civic Talk, `delib-data` (Pocket Polis / Power Ranker), TTTC CSV and `delib-exchange/v1`. This is adapter/fixture coverage, not a statement that all current production export shapes were downloaded during this release. Polis's current local CSV → bundle → delib-data adapter is also exercised by an integration test.

Optional `project.imports` stores `delib-workspace-import/v1`: file SHA-256, import date/round, complete normalized exchange snapshot, native-to-workspace ID map, and explicit source links. It retains the adapter's method data and loss report, with its identity/credential exclusions. It does not preserve a byte-identical original upload; keep the original file separately. SHA-256 identifies the uploaded file, not a signature or authenticity proof. No new central storage or remote write endpoint was added.

- Eligible participant text enters source selection. Votes, consent answers, scales and calculated results remain typed method data, never fabricated voices. Locally reviewing text does not confer destination permission or turn it into a commitment.
- A TTTC result can be matched to a selected workspace handoff only when quoted source IDs and original text match. Reply requires the original question ID and exact wording. File reconnect observations remain separate from API receipt states; an `exported` handoff is not retroactively marked delivered.
- Unresolved external links are retained in the snapshot. Their descendants appear as restricted method data and cannot become Reply context through a simple review click. Reimport with the correct handoff can create a separately inspectable linked observation.
- Every import starts unreviewed, preserves native relationships and retains its source mapping. Revisions are explicit new workspace records. Linked question copies appear as excerpts, avoiding duplicate participant source rows.
- Same-activity files can be compared by native record ID: added, changed, absent and unchanged. Changed method fields have a Before / After table. Full fields and relationships remain expandable. Missing records do not prove withdrawal; changed counts do not prove opinion change. Latest-imported IDs are selected for onward handoff, with older snapshots still inspectable; timestamps are not authenticated version ordering.
- Explicit withdrawal/review restrictions persist across imported versions and propagate to local derivatives for onward handoff. Old private snapshots are retained for inspection, so this is not deletion or erasure. Remote copies and manually downloaded old snapshots require separate handling.
- Duplicate packages in the same round are rejected. Stale previews, mismatched simulation state, forged source links, changed snapshots and capacity limits fail before applying an import. Limits: 3 MiB incoming file, 6 MiB workspace with native snapshots, 5,000 workspace records and 150 import entries. Old v1 backups without imports still load.

## Acceptance

Unit coverage includes all 12 existing native adapters, a Form → TTTC → Reply manual-file loop, the current Pocket Polis adapter chain, preserved votes/seed statements, proposal count/version comparisons, unresolved sources, mismatched quotes and Reply wording, withdrawal persistence, stale preview rejection, unchanged-package detection and backup validation.

Local browser acceptance used only synthetic data at the loopback fixture server. Confirmed Chinese and English import dialogs, a three-record Polis file yielding one eligible voice and two method records, two file versions surviving a fresh page load, count changes shown as 1 → 2, retained history, dark/light appearance, and 390 × 844 mobile layout with document scroll width 390. No console errors were observed. Browser testing did not create upstream service activities.

Release validation uses `npm run check` and main → CI check → deploy → production smoke. Production completion must be confirmed from the workflow and public page, separately from local checks.

## Remaining stages

5b: verify current real production exports and service round trips for each new edge; obtain and validate the Sensemaker result contract and Proposals amendment/response bodies. Current Proposals snapshots have counts/current proposals only; absent amendment content is not synthesized. Sensemaker's previously verified backend input shape is not proof that its web picker accepts JSON or that a report round trip works.

6: make observed workspace events and voice paths drive the shared 2D/3D view. This release creates no invented delivery or attendance events.

7: obtain the current Metagov ontology and translated platform examples before external vocabulary/conformance claims.

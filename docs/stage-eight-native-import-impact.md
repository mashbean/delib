# Stage 8c — Explain how imported native data can be used

An import preview previously exposed individual fields but left facilitators to infer which records could be reused. It now groups the validated projection into source candidates, method/context, and restricted records before confirmation, with expandable native-to-workspace type counts and a disposition label on each record.

## Behavior

- Classification reads the existing plan's `eligible` and `quarantined` flags. Restrictions take precedence, including withdrawals remembered across rounds. It does not introduce an alternate eligibility policy.
- Format handling counts describe loss/handling notes, not people or affected records. Existing detailed paths and reasons remain available locally below the summary.
- Unmatched external references prompt handoff selection and exact quotation checks. Method results prompt source checking, preservation of dissent, and accountable review of model drafts. Import confirmation does not mark individual records reviewed or grant reuse permission.
- Snapshot wording now explicitly covers supported fields; the original export still needs separate preservation. Native fields and provenance are not necessarily interpreted by destination tools.
- Bilingual, theme-aware cards collapse into a single column on narrow screens; type mappings use the existing responsive field table.

## Validation

- 18 new tests: all 13 current native adapters, Polis source/count separation, unresolved TTTC chains, Sensemaker summaries, remembered withdrawals, and handling-note scope. Preview generation does not mutate import plans.
- `npm run check`: 283 unit tests and 57 Worker tests passed; syntax, types, builds, and deployment dry run passed.
- CUA on loopback-only QA server: fictional TTTC file produced 0 source candidates and 2 restricted records with 1 unresolved reference; fictional Sensemaker result produced 0 source candidates and 1 method/context record. Checked desktop Chinese dark mode and 390px English light mode with expanded mappings. Region scroll width equals client width (310px); no browser console errors observed.
- CI and production verification follow the main-branch deployment workflow; see the release run for the deployed commit.

## Scope and next increment

This is import transparency for existing adapters. It does not prove upstream export completeness, automatic remote delivery/deletion, or acceptance by Metagov. Next: make unresolved source references actionable at record level, with explicit source selection and exact evidence checks, while keeping withdrawal restrictions intact.

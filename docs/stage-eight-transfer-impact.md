# Stage 8b — Explain what survives a text handoff

2026-09-13. Extends the existing `workspace-text/1` mapping for Pocket TTTC and Pocket Reply. No new adapter, schema migration or receiver-acceptance claim.

## Behavior

The workspace and final service preview show the outgoing boundary: CSV source text and IDs, Reply context flattened into `positions`, provenance retained in the transfer companion, and data retained only in the full project backup. Manual CSV and in-site metadata are distinguished. Participant fields are omitted but free text is not claimed anonymous.

Counts derive from the current selection and serialized CSV. Spreadsheet formula escaping is reported as a text/ID change; ordinary quoting and multiline CSV are not called data loss. Local identifier warnings remain visible and existing permission/validation gates still apply.

Facilitator guidance changes with the tool: TTTC asks for checking quotations, dissent and speaker corrections; Reply asks for accountable review, owners, dates and non-adoption reasons. Selected unchecked sources and current participation gaps have direct workspace actions. The final service dialog is read-only except for its existing consent/send controls.

A downloadable `delib-transfer-impact/v1` diagnostic contains field descriptors and counts, without issue title, source text, participant or record IDs. It is generated from the current selection and is not a receipt. The full private project and transfer companion remain distinct exports.

## Validation

- Full `npm run check`: 265 unit tests and 57 Worker tests, syntax/type/binding checks, scene/schema builds and deploy dry run.
- Eight new tests compare the report with actual CSV and companion structures, cover formula escaping versus ordinary quoting, verify selected-only review guidance, detect identifiers without copying them into diagnostics, and verify read-only dialog rendering.
- Browser QA on loopback fixture: TTTC/Reply switching; Reply's eight context records and twenty provenance edges; source selection 16 → 15; participation action reaches the current gap; Chinese and English rendering; 390px light/dark layouts without horizontal document overflow. Mobile field rows use paired cards rather than narrow table columns. No upstream activities were created.
- Browser console had no errors during this flow. Downloaded diagnostic content is covered by unit assertions; browser disk completion is not claimed.

## Limits and next steps

Only these two workspace text handoffs are described. Other Pocket/native formats retain their existing import/export behavior. Field loss reports for those formats need adapter-specific fixtures. Neither a schema check nor this field map proves remote delivery, result quality, consent, consensus or representativeness.

# Stage 7b1 — locally validated Statement export

Delib can now prepare selected workspace records as Metagov `Statement` objects, with explicit creator and classifier attribution. This is a local component export, not an accepted Metagov transport integration. `externalAcceptance` remains `false`.

## Use

Open `/workspace?lang=zh&view=transfer&export=metagov` (English: `lang=en`), or **Prepare next step → External format check · Metagov → Prepare a Statement export**.

1. Register the known Participant, Host or Algorithm and the evidence for that attribution. Algorithm requires an explicit kind. Codes are random UUIDs scoped to this issue; labels never identify people across tools.
2. Choose a record, explicitly assign its content role, creator and classifier, and record the confirmation evidence. No role is selected by default. This attestation changes neither quotation confirmation nor facilitator review, consent, commitments or consensus.
3. Select records (none preselected), inspect both files, then download locally. Nothing is posted to another service.

The Statement file carries the selected text, UUIDs, role and attribution. The private companion carries selected records, their full mapping histories, source relationships, original-ID mappings and relevant actor evidence. It excludes unselected source text and native archives. Preserve the full private workspace backup for the complete activity and cross-round history. Browsers may require allowing the second download; the UI asks users to check that both files were saved.

## Exact upstream evidence

- Source: https://github.com/metagov/ontology/tree/e5d3312aa0da481429ef4545ac172b668ead5f55
- Revision: `e5d3312aa0da481429ef4545ac172b668ead5f55`.
- The unchanged Rust `data_model` executable was run with its locked dependencies: `cargo run --locked -p data_model`.
- Its 10,119-byte output is saved at `public/schemas/metagov/e5d3312/all-types.json`. SHA-256 checksums for the schema, Cargo.lock and both Rust source files are in the neighboring `provenance.json`. Upstream source and license notices are in `NOTICE.txt`.
- Delib selects `#/definitions/Statement` from that generated schema. It does not fabricate a Collection or Reaction to satisfy the demonstration `AllTypes` root.
- Ajv 8.20.0 with ajv-formats 3.0.1 compiles a standalone browser validator (`npm run build:metagov`). It needs no runtime eval. Each object is checked before export.
- The surrounding JSON array is **Delib's batch container**, not a receiver-approved envelope. RDF and ATProto representations are not claimed compatible.

To reproduce: check out the pinned upstream revision **inside the Developer workspace**, run the command above, compare output hashes, then run `npm run build:metagov` and `npm run check`. Do not silently regenerate against upstream main.

## Mapping rules and boundaries

| Concern | Implemented behavior |
| --- | --- |
| Original IDs | Deterministic, issue-scoped UUIDv8 from SHA-256 of namespace, entity type and original ID. Private map retains original IDs. Stable after backup/reload; not an upstream-agreed namespace. |
| Creator and classifier | Explicit, separate references to locally registered Participant, Host or Algorithm. Historical actor references survive changed mappings. Manual evidence is not authenticated identity. |
| Content role | Explicit choice among the eight upstream roles. No default Belief/Fact, and no claim that schema-valid Decision establishes agreement. |
| Multiple sources | All source and typed links remain in the private companion. `in_response_to` is populated only for exactly one explicit `responds` link whose target is also selected. No arbitrary first-parent mapping. |
| Stale records | Changed text, source, participant reference or source relationships invalidate the current attestation. A changed project invalidates an open preview. |
| Withdrawal / revision | Withdrawn native records and their affected descendants, superseded versions and unresolved imports cannot export. |
| Method records | `method-result` and `inclusion-check` remain native; selecting a semantic role cannot turn them into exportable Statements. |
| Other model types | Project/Phase/Event/Location/Reaction/Collection are not exported in this stage. Phase dates, location coordinates and vote semantics are never invented. |
| Privacy | Selected original text is inspectable before download. The companion contains private actor labels, review and attestation history; keep it private. |

Bounds: up to 200 records per export, 1,000 registered actors, 20 attestations per record. The existing 6 MiB workspace limit still applies. History and evidence consume that space.

## File verification

```sh
node scripts/verify-metagov-export.mjs statements.json private-companion.json
```

This reads both files locally, checks the native file hash, validates each Statement against the generated schema, recomputes UUID mappings, and compares content, roles, actor references and response links with the companion. Output contains only validation counts and the revision, not source text. Native-byte changes (including whitespace) require a newly matching companion. This is a consistency check, not a signature or authenticity proof, and does not reconstruct a full workspace.

## Verification and next stage

Automated cases cover independent compilation of the upstream schema and all Generator variants, stable IDs after backup reload, multiple-source preservation, unselected text exclusion, changed attribution histories, withdrawal propagation, method-data exclusion, stale previews and paired-file tampering. Browser checks use only a local fictional school-street issue; no real service receives its records.

Stage 7b2 requires agreement with the receiving team on envelope, namespace, actor identity boundary, multi-parent relationships, events and method-data fixtures. An accepted receiving fixture is separate evidence from the structural checks implemented here. No outreach or external acceptance has been performed by this release.

Local release checks: `npm run check` passed 240 unit and 57 Worker tests, type checks and deployment dry run. The paired-file CLI passed a saved synthetic fixture. Desktop Chinese/light and 390 px mobile English/dark flows were inspected; the mobile page and preview had no horizontal overflow. Browser download requests and persisted attribution after reload were observed; no assertion is made about an external receiver.

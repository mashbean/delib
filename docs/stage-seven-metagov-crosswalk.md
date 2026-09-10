# Stage 7a: inspect the public model before converting

> Stage 7b1 update: selected Statement export is now implemented with pinned upstream schema validation. See [stage-seven-statement-export.md](stage-seven-statement-export.md). External acceptance is still pending. The text below records the earlier Stage 7a audit.

2026-09-10. Metagov's public source is available, so source inspection and a draft crosswalk no longer depend on receiving private files from the authors.

## Pinned evidence

Inspected [`ontology/data/src/lib.rs` at e5d3312](https://github.com/metagov/ontology/blob/e5d3312aa0da481429ef4545ac172b668ead5f55/ontology/data/src/lib.rs), retrieved through GitHub's API. `/data/metagov-crosswalk.json` records the complete revision and source SHA-256, the representation inspected, field candidates and limitations.

The target for this draft is the Rust structs deriving JsonSchema. RDF and ATProto shapes are different: attributes skip some fields and add format-specific constraints. This work does not generate or validate against a complete upstream JSON Schema.

Key source findings and Delib implications:

- Statement requires UUID, content, role, made_by and role_classified_by. A local source ID, alias or review entry cannot supply verified Generator attribution. Question / theme / proposal / decision supply role candidates only; arbitrary statements do not become Fact or Belief.
- Statement.in_response_to is one optional UUID. Delib can preserve multiple parents and typed context/revision relationships. No arbitrary first-parent conversion is implemented.
- Phase needs start/end times and a description. A review deadline is insufficient. Event and Location also require data that a simple online/in-person annotation does not contain.
- Reaction has entity_type but no explicit target entity ID in this source revision. Native vote semantics and target linkage require a separate contract; native archives remain intact.
- The [namespace alignment issue](https://github.com/metagov/ontology/issues/2) is an open proposal. It does not establish an agreed namespace, joint specification or W3C standard.

## Shipped behavior

- Home navigation, mobile menu and hero link directly to the 3D workspace. All workspace links retain the chosen language, including both existing Start a round buttons.
- Handoff has an above-the-fold 3D entry that opens a separate tab, preserving files held only in handoff memory. Copy explicitly says files do not move automatically.
- Entering with `view=flow` and choosing the fictional demo opens the flow tab directly.
- Prepare next step has a collapsed Metagov format check for the whole issue. The report counts candidate text, missing UUIDs, generator/classifier gaps, multi-parent and typed relationships, missing phase intervals, setting observations and retained native/transfer archives.
- Download produces `delib-metagov-readiness/v1`: aggregate counts and candidate mappings only. It contains no source text, titles, record IDs, participant identifiers or native payloads. It is neither a native Metagov export nor evidence of destination acceptance. Nothing is sent to Metagov.

## Acceptance and remaining work

Focused tests cover the pinned target, missing attribution despite review, ID and multi-parent gaps, event/time boundaries, non-mutation, invalid backups and content-free diagnostics. Local browser checks cover bilingual diagnostics, download controls and 390 px mobile layout without horizontal overflow. `npm run check` passed: 228 unit tests, 57 Worker tests, type/script checks, scene builds and deploy dry run. Home links and mobile menu retained English; the flow entry followed by the demo button opened Data flow and reload kept the same project count. Production checks accompany the release.

Stage 7b needs agreement on the actual receiving format and authoritative actor/role classification, reversible IDs, preservation of multi-parent relationships, method-data fixtures, and external round-trip acceptance. This does not require inferring global participant identities. Until that contract is agreed, keep complete private Delib backups and native archives.

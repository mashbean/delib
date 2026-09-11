# Stage 7b2a — handoff inspector and local comparison

A browser at `/interop?lang=zh` (or `lang=en`) can now inspect the two files exported in Stage 7b1. It reads files locally, verifies their consistency, displays attribution and provenance, and compares them with a selected local issue. It does not import or merge their contents into a workspace, send data to Metagov, or record external acceptance.

## Workflow

1. Select `statements.json` and its `private-companion.json`, up to 20 MiB per file. Selecting a replacement clears any previous successful inspection before checking again.
2. Check the pair. The existing pinned upstream Statement validator, native-byte SHA-256, deterministic UUID map, content/role/actor consistency and source links must agree. Malformed or mismatched files show no successful result or report-download control.
3. Open a record to inspect the creator, classifier, attestation history and source links. A source excluded from the batch is explicitly shown as ID-only. Links never imply that absent source text has been checked. The first 100 source links per record are rendered; all are retained in the original companion.
4. Select a local issue to compare. This explicitly reads valid workspaces stored in this browser. No external service is queried. Classification separates unchanged content, content/source changes, attribution changes, follow-up changes, withdrawal, superseded versions, unresolved sources and missing records. Direct newer revisions are displayed alongside the exported content.
5. Download an aggregate inspection report. The selected local issue is reread before downloading, so a previously displayed comparison is not silently reused after local changes. The report contains check categories, counts, scope, timestamps and the pinned revision, without original text, names, IDs or file hashes. It is a diagnostic, not an authenticated receipt.

The inspector is linked from **Prepare next step → External format check · Metagov** and from the Statement export panel.

## Restored backup copies

The existing workspace importer assigns a new project ID when restoring a private backup. The importer retains its Metagov namespace and original record IDs. The inspector therefore accepts an explicitly selected copy with the same private namespace and simulation flag, while marking `projectCopy: true`. A namespace mismatch blocks comparison; similar names or text never establish a match. Matching a namespace checks consistency, not authorship or identity.

## Fictional walkthrough

**Try a fictional handoff** runs the same pair validator on generated in-memory files:

- A question asks how wheelchair drop-off reaches the school gate.
- A proposal draws on that question and a delivery concern. The concern's text is intentionally outside the exported batch, so the inspector shows its ID-only boundary.
- A later local proposal revision asks for an accessible-route survey and discussion with shopkeepers. The question still matches; the older proposal is visibly superseded.

The later issue snapshot stays in memory. It is not saved to IndexedDB and does not read the user's workspaces until **Choose a local issue** is selected. Reports label this comparison basis `fictional-memory`.

## Validation changes

Paired-file validation additionally rejects invalid project/round metadata, surplus ID mappings or actors unrelated to the selected records' mapping histories, malformed source relations, unsupported record kinds and unexpected Statement fields. The exact needed ID set is bounded to 5,000. This validates Delib's current paired-file envelope; it does not add requirements to Metagov's general schema or claim interoperability with other transport formats.

File parsing and comparisons remain local. Clear/reload removes the inspector's in-memory data; existing files and saved workspace issues are retained. All imported text is escaped when displayed. Pending file operations are invalidated on replacement or clearing.

## Reproducible verification

- Unit tests: `npx vitest run --config vitest.config.ts test/interop.test.js test/metagov-export.test.js`
- Full release checks: `npm run check`
- Isolated browser QA: `DELIB_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qa-interop.mjs http://127.0.0.1:8797`
- Serve `public/` locally on that port for this QA. The script rejects non-local hostnames.

Browser QA imports a synthetic private backup through the actual workspace file input, inspects real file-input buffers, compares the restored copy, reads a downloaded report from disk, checks mismatch invalidation, clear/reload, and bilingual mobile dark-mode rendering. It asserts that no non-GET requests or page errors occur. It does not run against production user data.

## Remaining Stage 7b2 work

External acceptance still requires a receiving team and an agreed transport/envelope, namespace interpretation, actor trust boundary and representative fixtures. Event/Phase/Location and method-data/Reaction mappings remain separate pending work; this release does not fabricate them. The next integration step can use the inspector and paired-file diagnostics to identify concrete mismatches before deciding how to merge externally revised records. No outreach, external acceptance or automatic merge is included in this release.

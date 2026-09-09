# Stage 5b — observed handoffs and complete proposal history

2026-09-09. Extends [the native import release](stage-five-native-import.md). The scope is per edge and per format, not universal or Metagov-certified interoperability.

## Implemented

- Fixed Form / TTTC / Reply readback in the Worker runtime. `redirect: 'error'` throws before sending a request in the installed runtime; a Node-only mocked test did not catch it. `manual` now refuses 3xx without forwarding management credentials. A Worker regression test constructs the actual outgoing Request.
- Pocket Proposals `524eb61` adds authenticated `archive.json`, preserving full version bodies, amendment body/rationale/base version/state/endorsement total and responses. Aliases, actor hashes and removed proposals are excluded. Existing space.json and CSV contracts remain supported. The host download uses header authentication.
- Delib validates the complete graph: contiguous versions, matching current body, accepted amendment source/body/base-version, proposal-scoped responses and unique IDs. Current proposal IDs remain compatible with legacy imports. Historical versions, amendments and responses remain typed method records, not duplicate voices. A response's historical version is explicitly unknown; the source service stores only its proposal ID. Author acceptance does not mean collective consensus.
- Bilingual version history and expandable, dated verification status appear in the exchange and workspace import flows. Raw fields and full relations remain inspectable.
- Sensemaker completed result JSON can be retained as unreviewed model Markdown. It cannot become participant evidence or reviewed Reply context automatically. Summary text is escaped in the UI, not rendered as arbitrary HTML.

## Production acceptance

Sanitized evidence, hashes and counts: [interop-evidence.json](../public/data/interop-evidence.json).

1. `run-workspace-pilot.mjs --live-synthetic`: initially failed at Form readback (502); its owned activity was deleted and checked. After release `f1befd9`, 3 fictional Form responses passed through TTTC (3 source-linked claims) and Reply (3 source-linked drafts), retained their original lineage in round 2, and all three owned activities were deleted and checked. This validates handoff mechanics, not model quality or consensus.
2. `verify-proposal-archive.mjs --live-synthetic`: creates one fictional proposal, exports the initial state, adds/endorses/accepts an amendment, adds a response, and exports again. Five typed records, two versions, three additions and one changed current proposal survive workspace import and backup reload. Legacy space.json still returns numeric counts. Test space deleted; GET returns 404/410. An initial attempt found the old deployment and was likewise cleaned up.
3. `verify-polis-readonly.mjs --public-read-only`: checks openData and exact pilot title before reading existing public CSVs. Converted statements/votes through delib-data, exchange and a reloadable workspace: 2,973 records, including 2,923 typed vote responses. No write, synthesis request or re-clustering. The issue is fictional but may include visitor responses, so the resulting test project is not falsely marked entirely simulated.
4. Delib full check: 213 unit tests + 57 Worker tests, script/type checks, scene build and production dry run passed. Pocket Proposals full check passed (2 scenario tests, types and both dry runs). Two pre-existing assertions were corrected to match documented ID tie sorting and quoted multiline CSV records; product sorting and CSV behavior were unchanged.

Pocket Proposals GitHub CI passed checks but skipped deployment because repository credentials are absent. Published through the existing local Wrangler account instead: Cloudflare version `3b452b9a-07ae-4238-8918-b9b4e60eaef0`, build `524eb61`. Do not treat a green skipped deploy job as publication evidence.

Browser acceptance: local exchange example selected Proposals and displayed V1, V2, the accepted amendment rationale/base version and endorsement total in Chinese and English. Light and dark modes checked. At 390 × 844, document width remained 390px. Sensemaker's fictional result displayed `model / draft`, no structured source links, and a disabled text-export button with an explanation; its private companion remained downloadable. No real participant data was uploaded during UI checks.

## Sensemaker evidence and remaining boundary

Inspected [upstream commit 164a712](https://github.com/bestian/sensemaker-backend/blob/164a712434cc074648b5203c2c6e8bf527db3660/src/index.ts#L700). The backend removes TopicSummary content, serializes the remaining summary to Markdown, and returns it from [GET /api/sensemake/result/:taskId](https://github.com/bestian/sensemaker-backend/blob/164a712434cc074648b5203c2c6e8bf527db3660/src/index.ts#L946). The envelope includes taskId, status, completedAt, model, commentsProcessed, additionalContext, outputLanguage and summary. It does not provide a machine-readable comment-to-claim graph or vote table. `commentsProcessed` is a comment count, not a participant count. No third-party activity or analysis was run; the result adapter was tested against a fictional fixture derived from that contract. No upstream implementation is vendored.

The existing backend-input JSON adapter remains separate from the web picker's CSV entry gap. This release does not claim a complete remote Sensemaker round trip. A future upstream result contract should include immutable input references, typed claims with source IDs, vote semantics, exclusions and version provenance before automatic reconnection is possible.

## Limits and next stage

- Workspace imports still enforce 3 MiB native files and 5,000 normalized records. Large archives are rejected explicitly, never silently truncated. Full source-service capacity may exceed these import limits; bounded multi-part archives are follow-on work.
- Historical response versions, remote withdrawal receipts, cross-service identity/consent and reverse import are not invented.
- Other adapters retain their earlier format-test status unless specifically listed above.
- Stage 6 connects the 3D view to these same observed workspace records and selectable voice paths. The animation must distinguish manual download, service receipt, completion and local reconnection; it must not invent delivery or treat online and physical participation as simultaneous parallel tracks.

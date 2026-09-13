# Stage 8a — Keep the current issue safe and make handoffs easier to resume

Date: 2026-09-13. Scope: the first segment of the next optimization round.

## Shipped behavior

- IndexedDB write failures reject instead of being swallowed. Callers stop before a success notice or dependent service handoff. The validated draft stays in memory and in the issue picker, with retry and private-backup controls available.
- A visible save indicator distinguishes saving, stored and failed states. Dirty issues are tracked independently; saving issue B cannot hide an unsaved issue A. Writes use immutable snapshots and a serial queue. Local removal waits for queued writes before deleting.
- A `beforeunload` handler requests a browser warning while any issue is dirty. Browser support and user activation govern whether a warning appears; this is not a crash recovery system.
- Backup timestamps describe a **download request**, never confirmed disk persistence. Neither local saving nor a download request is a cloud backup. Downloading does not clear dirty state.
- Desktop save status and issue management share a row. Round goals, management actions, graph legend and import history are expandable. Mobile views use six tabs in two rows. The 3D graph and equivalent record list remain available.
- Handoff actions are grouped as prepare, bring back results and inspect. Changing workspace tabs retains the selected transfer sources in the current session. Switching issues or rounds clears those selections.
- The inspector can explicitly compare against the saved issue the user came from. The issue/round IDs remain in sessionStorage, not in URLs. Returning restores that issue and round. A missing or incompatible issue still fails closed through the existing comparison checks.
- Active view URLs follow navigation and next-round changes, so reload does not force an obsolete view. The return marker is consumed once, avoiding a later unwanted project switch.

## Validation

- `npm run check`: syntax, generated scene/schema artifacts, Worker bindings/types, TypeScript, unit tests, Worker tests, deploy dry run.
- Seven persistence tests cover rejected writes, retry, immutable snapshots, queued ordering, independent dirty issues, removal ordering and UI state notifications.
- Browser QA on a loopback-only fixture server: first save fails deliberately; retry succeeds; reload preserves the fictional issue; the backup action remains available while dirty; moving from round 2 to inspector and back preserves round 2; incompatible demo export is shown as incompatible.
- Visual QA: 1280px desktop, 390px mobile, Chinese/English, light/dark. Mobile document width equals the viewport; the graph remains rendered with its equivalent accessible list. Small screens still need scrolling for the full graph and record list.
- Backup click triggered the download-request UI in both in-app browser and Chrome. Disk completion was not verified: the in-app download event timed out, and browser policy blocks the Chrome downloads page. Product copy deliberately avoids claiming completion.
- Public verification is performed by the existing deployment smoke workflow, including the new persistence/shell assets. This segment does not establish external Metagov acceptance or change remote tool data.

## Reproduce storage-failure QA

```sh
node scripts/qa-workspace-server.mjs 8791 --fail-first-save
```

Open `http://127.0.0.1:8791/workspace?lang=en&demo=1&view=flow` in a browser. Each page instance rejects its first save, then delegates to real IndexedDB. APIs are blocked by the fixture server; the failure switch is not shipped in public code. Reloading intentionally starts a fresh first-save failure fixture.

## Subsequent segments

- Make field losses and preserved provenance visible at each tool boundary; expand adapter fixtures before claiming interchangeability.
- Improve facilitator guidance around unresolved questions, missing participants and conditions for the next round.
- Extend transfer receipts and native tool integration evidence. Keep format compatibility, actual receipt, processing completion and source reconnection distinct.

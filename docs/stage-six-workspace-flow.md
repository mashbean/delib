# Stage 6: observed workspace flow

2026-09-10. Extends the existing local issue workspace at `/workspace?view=flow`.

## Behavior

- A new bilingual Data flow tab renders the same workspace records as a selectable 3D graph and a keyboard-accessible record list. Selecting a source traces its recorded descendants across rounds, excluding context-only response paths.
- Four columns group record types into collection, synthesis, response and continuation. They are not timestamps or proof that all eight deliberation methods occurred. Method-step guidance remains in the round-work and transfer views.
- Service nodes show the stored transfer lifecycle. Downloads, uncertain outcomes and legacy service links cannot establish remote receipt. Output links appear only after recorded reconnection. The five-second, stoppable replay illustrates recorded relationships, not live network traffic or consensus.
- Online / unrecorded / in-person placement uses the latest attributed observation on each record. Tools and file imports do not establish setting. Corrections retain earlier observations. These are record annotations, not a participant travel history or an identity service.
- Setting observations are optional workspace v1 fields, preserving existing backups. They include an ID, timestamp, recorder, setting and evidence/reason, with validation and bounded history. Original text, review, consent and commitments are unchanged by a setting observation.
- WebGL is lazy-loaded only in the flow tab. Rendering is event-driven at rest; replay stops offscreen, in a hidden document, on reduced-motion preference, or at view teardown. The record list remains available if 3D cannot initialize.
- The graph shows at most 160 source records and 400 edges, with explicit truncation notices and a source selector to narrow the scope. Handoff histories report whole-transfer IN/OUT totals, even when a voice view displays a subset. Mobile keeps native vertical scrolling; the graph is an overview and the list provides readable detail.
- `demo=1` is removed from the URL after creation so reloading does not repeatedly create new fictional projects. It can combine with `view=flow`.

## Validation

- Full `npm run check`: 222 unit tests and 57 Worker tests, script/type checks, both scene builds and deployment dry run passed again after final UI polish.
- New cases cover direct source lineage, exclusion of another speaker's contextual reply, exported/uncertain/reconnected lifecycle distinctions, legacy links, cross-round carry, truncation, render purity, attributed setting corrections and backup reload.
- Local browser: selected the wheelchair-access source in the fictional school-street project and observed its 9-record path across two rounds. Saved one attributed in-person annotation; reload retained the selected voice and exactly one annotated record. Replay start/stop, English/Chinese and dark/light switching worked. At 390 × 844, page scroll width equalled 390 px and cards remained readable. The graph uses a light background in light mode.
- This stage does not rerun the live Form → TTTC → Reply experiment; that evidence remains in Stage 5b. WebGL failure and reduced-motion branches are implemented but were not separately browser-emulated in this acceptance pass.

## Remaining external work

Stage 7 needs the authors' current Metagov ontology / translated flatfiles and an agreed external test case. This release does not claim Metagov conformance, participant authentication, or cross-service deletion.

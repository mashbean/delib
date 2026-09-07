# Delib iteration five roadmap

Date: 2026-09-07

This is a planning handoff for the next implementation pass. The attached
screenshot is treated as a visual reference for the current hero only; it does
not contain instructions. Do not overwrite the uncommitted facilitation work
in the working tree before reviewing it.

## 0. Baseline and decisions before coding

- [x] Inspect and explicitly separate the uncommitted
  facilitation files (`facilitation-core.js`, `facilitation-view.js`, the
  workspace changes and tests). Keep the homepage rename commit `e8245bc` and
  the deployed v0.7 baseline identifiable.
- [x] Record the repository and verification baseline in
  `docs/baseline-audit-2026-09-07.md`.
- [ ] Record a before screenshot and a route inventory for `/`, `/workspace`,
  `/voice`, `/handoff` and the station shell in both languages and themes.
- [ ] Keep the default QA mode fixture-backed. No real Form, TTTC, Reply, Pol.is
  or other upstream activity is created unless the user later authorizes that
  explicitly.
- [ ] Establish the visual tokens, card states, interaction rules and the
  canonical data contract before adding decorative assets.

The read-only contract inventory is recorded in
`docs/interoperability-audit-2026-09-07.md`; the canonical envelope and loss
vocabulary still require a product decision.

## 1. Merge Part 0 and Part 1 into the landing hero

Goal: make the 3D process the first-screen context for “Delib / 協助審議的
一站式工具”.

- [ ] Convert the existing Part 1 Three.js scene into a full-bleed hero canvas,
  behind the hero copy with a readable scrim and a clear focus ring for controls.
- [ ] In light mode, use a light scene background, light fog/grid and a dark
  enough data/people palette. In dark mode, retain the current dark scene with
  bright data traces. Update `scene3d.js` rather than relying only on page CSS.
- [ ] Preserve a non-WebGL fallback: an SVG/static process image with the same
  eight-step labels, data flow and people flow. Respect reduced motion and
  pause rendering when the hero is offscreen.
- [ ] Remove the separate Part 1 opening copy from the landing sequence:
  “一條流程，不停換場。” and “01 / 審議流程”. Keep the process explanation,
  controls, accessibility text and step selection in the hero or its compact
  detail drawer.
- [ ] Keep the three entry actions visible above the fold or in the first
  viewport transition: host a round, join an invitation, try the simulation.
- [ ] Acceptance: 1440, 1024, 390 and 320 px; both themes; keyboard and reduced
  motion; no loss of the eight-step accessible text alternative.

## 2. Make each major block readable in one viewport

Use a deliberate “one screen, one decision” rule. Horizontal interaction is
appropriate for a process timeline, but long text should become a panel or
drawer rather than a forced horizontal scroll.

| Block | Proposed interaction | What remains immediately visible |
| --- | --- | --- |
| Hero / process | Full-bleed scene plus compact step rail; click or scroll selects a step | Delib title, one-line purpose, primary action, current step |
| Eight-step detail | Desktop pinned two-column scene + detail panel; mobile stacked card and next/previous controls | IN, OUT, tool, gate and next move |
| Simulation | Pipeline stays in a bounded viewport; round/people/data are tabs; inspector opens beside or below the selected item | Current round, current phase, selected record/person |
| Planner | One form and one result card; advanced explanation in disclosure | Gap, recommended start, why to move on |
| Tool set | Three to six contextual cards first; complete 38-tool index in a full-screen drawer/search view | Tool purpose, in-site availability, next action |
| Data handoff | Three-panel inspector: source, transformation/loss, destination; schema details in tabs | What enters, what changes, what leaves |
| Agent | Prompt editor with copy/download and a short safety boundary; long guidance in disclosure | Issue input, generated plan scope, human decision boundary |
| Voice / workspace | Focus view by default; overview is explicit | Current record, status, owner/date, next action |

- [ ] Prototype the desktop pinned layout with CSS/GSAP ScrollTrigger only after
  the information hierarchy is stable. Use a normal vertical fallback for
  touch, keyboard and reduced motion.
- [ ] Keep a persistent “目前位置 / current position” indicator so a user can
  return to the same step after opening an inspector.
- [ ] Avoid nested scroll containers except the intentionally bounded pipeline
  and long record lists. Test wheel, trackpad, touch and keyboard separately.

## 3. Turn the eight stages into a polished card system

- [ ] Derive eight cards from the existing `stages` + `workflow-playbook` data;
  do not duplicate labels in HTML or create a second source of truth.
- [ ] Every card has the same reading order: number, stage title, online/in-person
  setting, purpose, `IN`, `OUT`, preferred native tools, review gate, and reason
  to change setting.
- [ ] Add clear states: current, completed/reviewed, blocked by a gate, optional
  (sortition), and carried from the previous round. Do not treat “viewed” as
  “completed”.
- [ ] Design a compact card deck and an expanded focus card. The active card
  should be visually unmistakable without depending on colour alone.
- [ ] Keep icons as the default visual language. Consider ImageGen only for
  optional abstract card textures or step illustrations after performance,
  licensing, alt text and light/dark variants are specified; do not generate
  portraits or decorative assets before the card information architecture is
  approved.
- [ ] Acceptance: each card can answer “where am I?”, “what can I use?”, “what
  enters?”, “what leaves?” and “what must be checked?” without another page.

## 4. Turn fictional participants into persona cards and journey maps

- [ ] Extend only the synthetic demo participant model first. Keep real
  participant identity separate and never infer cross-tool identity.
- [ ] Add structured, fictional fields for perspective, needs, access barrier,
  preferred mode, stage events, friction moments, positive moments, support
  offered, and unresolved need. Keep a source/reference ID for every event.
- [ ] Build a card for each demo person with a compact summary: perspective,
  current mode, current stage, what helps, and what is still difficult.
- [ ] Clicking a card opens that person’s journey map across all three rounds:
  stage, online/in-person mode, presence, data contributed, friction/positive
  moment, facilitator response, and next opportunity.
- [ ] Add filters for round, stage, mode and unresolved need. The existing people
  flow remains the overview; cards provide the explanation layer.
- [ ] Use symbolic, non-identifying visuals by default. If ImageGen is used
  later, generate abstract persona tokens with explicit alt text rather than
  realistic faces.
- [ ] Acceptance: every fictional card can be traced to the fixed demo fixture;
  no card implies real attendance, identity, sentiment or representation.

## 5. Rebuild the data handoff as a real interoperability layer

The current repository has `delib-data/v1`, `delib-rounds/v1`,
`delib-workspace/v1`, CSV adapters and several tool-specific contracts. The
next pass must reconcile their semantics before changing the UI.

### 5.1 Canonical envelope and loss accounting

- [ ] Publish one versioned canonical envelope for an activity, round, phase,
  record, participant reference, source, relation, review, consent, visibility,
  withdrawal and next-round handoff.
- [ ] Preserve original text and source IDs. Derived records must point to
  parents with typed relations (`derived`, `responds`, `revises`, `supports`,
  `opposes`, `context`).
- [ ] Add explicit withdrawal tombstones and supersession rules so a source
  correction or withdrawal can be carried forward without pretending every
  destination deleted its copy.
- [ ] Separate participant linking permission from content consent. Never send
  aliases, admin tokens, raw votes or private contact fields by default.
- [ ] Every adapter emits a machine-readable loss report: fields preserved,
  transformed, aggregated, dropped, blocked by consent, and requiring human
  review.
- [ ] Add schema negotiation (`schema`, `version`, `capabilities`) and fixture
  validation. A successful parse is not proof that the destination method is
  semantically equivalent.

### 5.2 Adapter matrix to research and implement

- [ ] Pocket Form → canonical source voices/questions.
- [ ] Pocket Harmonica → canonical interview turns/transcripts with speaker
  consent and source timestamps.
- [ ] Pocket Polis / Pol.is → statements, themes, aggregate votes and dissent;
  preserve the fact that aggregate votes are not raw deliberative reasoning.
- [ ] Call-in → questions, reactions, transcript/source references and event
  context, with an explicit transcript-quality field.
- [ ] Pocket TTTC / Talk to the City → themes, claims, quotes and source IDs;
  keep model synthesis distinct from facilitator review.
- [ ] Pocket Reply / Uncommon Ground → question → draft response → owner/date;
  never turn an AI draft into a participant voice.
- [ ] Pocket Values, Budget, Proposals, Argument and Maple → normalize values,
  options, amendments, arguments, testimony and decisions while retaining each
  method’s special fields and aggregation limits.
- [ ] Power Ranker → pairwise aggregate results plus interpretation, missing
  voices and responsibility; do not export raw participant identity.
- [ ] vTaiwan / Civic Talk → research the current public schema and repository,
  then map its shared-information base, prompt/response and update cycle into
  canonical evidence, response and revision records. Do not assume the old
  vTaiwan format is current.
- [ ] Sensemaking integration → first identify the exact Civic Talk/Sensemaking
  product and its current export contract. Only add an adapter when the source,
  licence, authentication, retention and semantic fields are verified.

### 5.3 Replace the exchange desk UI

- [ ] Show a source → transform → destination pipeline with field-level diff and
  loss report, not only a download button.
- [ ] Offer named packages such as `source voices`, `reviewed themes`, `options +
  reasons`, `response brief` and `next-round brief`, each with allowed
  destinations and human review requirements.
- [ ] Add import preview, duplicate detection, broken-lineage errors, consent
  warnings and a downloadable manifest. Keep private and public packages
  visibly separate.
- [ ] Add compatibility states: native, lossless enough, aggregate-only,
  manual-review, catalog-only. Explain the reason next to each destination.
- [ ] Acceptance: Form → Harmonica/TTTC, TTTC → Reply, Polis/Power Ranker →
  reviewed aggregate/next brief, and Reply → next-round brief all pass fixture
  round trips with no broken source IDs and an explicit loss report.

## 6. Verification and handoff to the high-capability implementation pass

- [ ] Add contract tests for every canonical field and adapter fixture before
  wiring new UI.
- [ ] Add browser tests for hero scene fallback, section viewport behavior,
  eight-card focus, persona-card journey, theme/language parity, keyboard and
  reduced motion.
- [ ] Measure performance of the full-bleed 3D hero and card views; keep WebGL
  paused offscreen and preserve a fast first paint.
- [ ] Run accessibility checks for heading order, focus restoration, live region
  updates, colour contrast and non-colour status cues.
- [ ] Validate exports/imports in both languages and both themes; test 320, 390,
  1024 and 1440 px widths.
- [ ] Deploy only after fixture-backed QA, production smoke checks and a clean
  review of the current uncommitted work. Keep real upstream activity tests
  separate until explicit authorization exists.

## Recommended order

1. Baseline cleanup and canonical data contract.
2. Eight-card information architecture and focus view.
3. One-viewport section prototypes.
4. Full-bleed hero scene and light-theme scene renderer.
5. Fictional persona cards and journey maps.
6. Adapter matrix, loss reports and exchange desk rebuild.
7. Full browser/accessibility/performance QA and deployment.

# Roadmap and completion boundary

Updated: 2026-09-05

## Completed in the current release

### Cross-tool data layer

- Published `delib-data/v1` with source schema, phases, items, responses,
  outcomes, provenance, summary and privacy data card.
- Added browser-only Pocket Polis and Power Ranker individual／aggregate
  adapters and download controls.
- Added the generic bundle to the reproducible Pocket Polis fictional pilot.

### One-click deployment

- Published a deployment registry and `/deploy` center.
- Delib, Pocket Polis and Call-in ship reproducible Cloudflare recipes whose
  configuration passes `wrangler deploy --dry-run` and matches production.
  The Deploy button itself has not yet been exercised from a third-party
  account; `deployments.json` records this under `verification`.
- Power Ranker is included in the Delib deployment rather than presented as a
  fourth repository.
- Pol.is, Agora, TTTC, HeyForm, Harmonica and Parti DemosX show their current
  operator or connected path without a false one-click button.

### Developer feedback loop

- Published `delib-feedback/v1` and a local preview builder.
- Feedback is never sent automatically; the user explicitly downloads JSON or
  opens a prefilled GitHub issue.
- Added a privacy-safe GitHub issue form and least-privilege CI for pull
  requests and main.

### Short public results

- Added `/r/<16 hex characters>` URLs for Pocket Polis and Power Ranker
  receipts.
- Stores only already-public, de-linked aggregate receipt fields for 30 days,
  one year or three years.
- Stores only a hash of the private delete token; the token remains after `#`
  in the organizer URL.
- Supports immediate verified deletion and alarm-based full storage deletion.
- Keeps the original no-storage fragment URL as a fallback.

### Operations and iteration loop (2026-09-03 takeover)

- Durable Objects no longer create storage on read; deletion also clears alarms.
- Upstream timeouts, an error boundary, full-sampling logs, a versioned
  `/api/health` (GET and HEAD), per-IP write limits in production and an
  operator takedown token for public receipts.
- Static pages bypass the Worker; `public/_headers` carries the CSP.
- `deploy.yml` (check → deploy → smoke test), `uptime.yml` (30-minute
  read-only probes), Dependabot, `scripts/smoke.mjs`, `CHANGELOG.md` and
  `docs/operations.md`.
- Homepage information architecture: choose a path first, results next to
  the launch cards, the process map as reference; path B is a real data
  handoff chooser; Power Ranker is launchable from recommendations.
- Feedback form prefills the GitHub issue form field by field; labels exist.

### Tool synthesis layer (2026-09-03, second pass)

- Pocket Polis receipts can carry an organizer-selected excerpt of the
  tool's own synthesis (Workers AI Gemma or deterministic) as a labelled
  "tool layer" with model, timestamp, staleness and cited statement ids.
- Ranking rooms can be closed by the organizer; public receipts get a
  slug registry for takedowns; receipt validation now checks arithmetic.
- Deliberately not done: Delib does not call Workers AI itself. The
  account's free neuron budget is already reserved by Pocket Polis
  (9,000 of 10,000 per day); a Delib-side model call needs its own ledger
  and a deterministic fallback before it is worth adding.

## Pocket-native rewrite roadmap (2026-09-05)

Pocket TTTC (ttt-city.mashbean.net) proved the pattern: one Cloudflare Worker,
one SQLite Durable Object per activity, alarm-driven pipelines that survive
restarts, Workers AI behind a two-level neuron ledger, tests that drive the
whole pipeline with `AI_MODE=fake`, a Deploy button with no secrets, and a
managed-create endpoint in Delib. Four catalog tools are now native
(Call-in, Pocket Polis, Pocket TTTC, Power Ranker). The remaining 24 were
assessed on three questions: is the algorithm or interaction small enough
for one Worker, can it be reimplemented clean-room under a permissive
license, and does it close a gap in the deliberation flow.

### Worth rewriting, in order

| # | Catalog tool | Native service | Why | Status |
|---|---|---|---|---|
| 1 | HeyForm | **Pocket Form**: sign-up, background survey and question intake forms whose exports are already `tttc.csv` and Pocket Polis seeds | The front of the flow still lacks a first-party entry; HeyForm needs MongoDB and Redis and Delib can only embed published forms. Scope is one form → one Durable Object → CSV, not a HeyForm clone. | done 2026-09-05 (pocket-form.mashbean.workers.dev) |
| 2 | Harmonica | **Pocket Harmonica**: one-to-one AI interviews (Workers AI as interviewer) whose transcripts feed Pocket TTTC | The last step that still needs a third-party credential, and the target of the receipt handoff "reach missing voices". AGPL upstream, so clean-room. One Durable Object per conversation; synthesis reuses the Pocket TTTC pipeline. Neuron budget is the hard limit: cap turns per participant and participants per day on the free tier, reuse `waiting-budget`. | done 2026-09-05 (pocket-harmonica.mashbean.workers.dev) |
| 3 | Uncommon Ground | **Pocket Reply**: takes a Call-in export, drafts a reply for every questioner, publishes the bilingual closed-loop receipt | Already CC0 and first-party as a CLI plus skill; as a Worker the Call-in → reply → receipt loop needs no terminal. | done 2026-09-05 (pocket-reply.mashbean.workers.dev) |
| 4 | Agora Citizen Network | Not a new service: add **bridging rank** (statements acceptable across opinion groups first) to Pocket Polis | Agora is a full platform (PostgreSQL, Valkey, several services); the reusable part is the ranking, and Pocket Polis already holds the vote matrix. | done 2026-09-05 (single-factor matrix factorization, axis anchored between camps; report section 橋接排序) |
| 5 | Ethelo + Stanford PB | **Pocket Budget**: cost-constrained multi-option voting with support and inequality scores | Both are "decide" tools; Ethelo ships only an engine and Stanford PB is a Rails site. One small tool covers both. Build when a participatory-budgeting case appears. | when needed |
| 6 | Moral Graph Elicitation | **Pocket Values**: value-elicitation dialogue → moral graph | Method is published; code has no license, so clean-room only. Shares the dialogue infrastructure with Pocket Harmonica, so it follows it. | done 2026-09-05 (values.mashbean.net; dialogue → values card → pairwise "wiser than" → Bradley–Terry moral graph; no card dedup yet) |

Shared step first: extract a `pocket-worker-template` from Pocket TTTC
(Durable Object SQLite, alarm pipeline, neuron ledger, fake-AI tests, Deploy
button, Delib activation endpoint) so each item above is roughly a day.

### Not worth rewriting (or already covered)

- Pol.is and Talk to the City: cores are covered by Pocket Polis and Pocket
  TTTC; the official apps stay as shared-host options for full features.
- Pairwise: Power Ranker is the native pairwise tool; mark as covered.
- Decidim, Go Vocal, Parti DemosX: whole participation platforms (accounts,
  proposals, meetings, votes), not an algorithm; keep as shared-host.
- Deliberative Canvas (alpha, needs a Deno sync server), PolicyCraft (research
  prototype without a license), Open Micropublishing (a data model, not a
  service), MAPLE (US legislative testimony specific), Global Brain Algorithm
  (Julia library tied to feed ranking): value below cost.
- OpenBook: data, not a service; keep as an evidence source.
- Evocracy, Iswe, Ize, Swarmcheck, Voice to Vision, Interoperable Co-op
  Governance: no verifiable source or site to reimplement from.

## Still intentionally incomplete

- `delib-data/v1` has two adapters, not coverage for all 28 catalog tools.
- TTTC and Agora outputs are format-tested but have not been declared imported
  until a real upstream login, upload, preview and export succeeds.
- Full official Pol.is, Agora, HeyForm, Decidim and Parti DemosX remain shared
  application/database operations, not free Cloudflare single-Worker recipes.
- There is no server-side participant data warehouse, automatic cross-tool
  participant identity matching or unattended AI publication.
- A real pilot with consenting deliberation workers and participant-facing
  comprehension checks remains separate from the fictional pipeline pilot.

## Next evidence gates

0. Press the Deploy button from a throwaway Cloudflare account for all three
   recipes and record `verification.verifiedAt`; add the GitHub secrets so
   `deploy.yml` performs production deploys.
1. Run a privacy-safe real upstream TTTC and Agora import/export round trip.
2. Add a third `delib-data/v1` adapter only after an actual source export and
   target import contract are both verified.
3. Test short-result comprehension, expiration language and private deletion
   recovery with 3–5 deliberation workers.
4. Use structured feedback to prioritize failures by blocked workflow, not by
   tool popularity.
5. Watch `uptime.yml` and Worker logs for two weeks; tune the per-IP limits
   (20 creates and 120 submissions per minute) against real workshop traffic.
6. Test whether readers mistake the labelled "tool layer" excerpt for endorsement or consensus.

# Direct integration audit

Last checked: 2026-09-03

This audit separates discovery from a usable integration. A tool is not called
“one click” merely because it has source code, an adaptor, an iframe, or a deploy
button.

## Readiness gates

| Gate | Meaning |
| --- | --- |
| Available | The in-app path exists, has a human confirmation gate and was tested. |
| Available with connection | Delib can embed or create after a one-time public identifier or account connection. |
| Available: existing only | A published participation surface can be embedded; project creation stays upstream. |
| Available with upstream login | Delib opens the current official flow in-app, while authentication and data remain upstream. |
| Available locally | The full interaction and export run in the browser without an account, API or server-side storage. |
| Available with ephemeral room | A deliberate write creates a bounded room with declared fields, disclosure threshold and verified deletion path. |
| Direct viewer | Useful inside the workflow but has no per-project instance. |
| Agent pipeline | Runs against a data handoff rather than as a hosted participation surface. |
| Next: credentialed | The upstream adaptor can perform the operation, but Delib still needs a tab-only credential flow and end-to-end test. |
| Catalog only | Discovery metadata only. No claim of deployment, API stability or security review. |

## First integration set

| Tool | Current path in Delib | Account / credential | Free / deployment boundary | Decision |
| --- | --- | --- | --- | --- |
| Call-in | Create a seven-day hosted event from a public deck URL; return audience, presenter, setup and moderation links. | None. Private setup and moderation links remain in the tab. | Hosted path needs no account. The source also supports Cloudflare Workers + SQLite Durable Objects, available within the Workers Free limits. | Available. |
| Pocket Polis／口袋審議 | Create a hosted conversation from a title, description and 5–15 seed statements; return separate participant, report and private admin links. After collection, validate `statements.csv` and `votes.csv` locally and prepare a participant-aware JSON, TTTC CSV or Agora three-file import. A thresholded aggregate can become a fragment-only result receipt with organizer interpretation, missing voices and next responsibility, then prepare a one-time draft for Call-in, Harmonica, TTTC or Pol.is. An Agent prompt and installable skill can prepare the brief, but creation, data download and publication still wait for human confirmation. | None. The admin token stays in the URL fragment and current browser tab; Delib does not persist it or accept it in the data workbench. CSVs remain in browser memory. A public receipt requires at least three participants with a vote and three responses for each selected statement; it excludes pseudonyms, raw votes, file hashes and admin tokens. | `polis.mashbean.net` is a managed free path. The MIT source is also a Cloudflare Worker + SQLite Durable Objects deployment with a Deploy button. It is a lightweight reimplementation, not official Pol.is, and has weaker sybil resistance. Local conversion does not prove a hosted TTTC or Agora import succeeded. | Available with local data handoff, result receipt and next-step draft. |
| Pol.is | Embed an existing conversation. A connected `site_id` plus deterministic `page_id` can create on first load. A personal Delib Deploy-button install can ask for `POLIS_SITE_ID` once. | A real Pol.is account creates and owns the Site ID. Cloudflare cannot manufacture one. Site ID is not a password. | Full self-hosting uses several containers and PostgreSQL. Cloudflare Containers are Workers Paid only and do not provide PostgreSQL, so this is not labelled a free Cloudflare-native deployment. | Available with connection. |
| Agora Citizen Network | Validate an official public conversation URL and embed ZKorum's maintained participant surface. Old `agoracitizen.network/feed/conversation/...` links are normalized to the current `www.agoracitizen.app/conversation/...` route. | Delib needs no credential. Any login remains inside Agora, and Delib does not receive opinions, comparisons or votes. | The active AGPL monorepo uses Quasar/Vue, Fastify, PostgreSQL, Valkey and TypeScript／Python workers. Its import worker accepts Pol.is URLs or CSV archives, but the hosted creation/import/export authorization contract has not been verified. | Available: existing only. |
| OpenBook | Use the public evidence page as an evidence gear. | None. | Public static site; there is no instance to create. | Direct viewer. |
| Uncommon Ground | Hand a complete question pool to a bounded agent; preserve withdrawn rows and verify the final receipt. | No service account. The execution environment supplies any model credential. | CC0 workflow; not a hosted participation service. | Agent pipeline. |
| HeyForm | Validate an existing public form URL and embed the published participant form in Delib. | No Delib credential. Creating and administering a form stays in HeyForm. Delib never asks for a password or cookie. | Self-hosting needs the application, MongoDB and Redis/KeyDB; official docs point to hosted/container platforms, not Cloudflare Workers. | Available: existing only. |
| Pocket Reply（口袋回覆） | Hand an id,interview,comment question pool to pocket-reply; Delib returns the public receipt URL and a one-time manage link. The Worker runs Uncommon Ground's method on Workers AI: 4–10 beats, an arc, one take per beat that may only cite the speaker's supplied positions, a reply for every questioner with a structurally assigned role, and a receipt with N/N, clone and grounding checks. | None. Delib stores neither the CSV nor the replies or the token. | MIT single-Worker reimplementation of Uncommon Ground (CC0); no reception-test or bilingual pass yet. | Available with managed create. |
| Pocket Values（口袋價值圖） | Hand a concrete choice situation to pocket-values; Delib returns the participant URL, the public moral-graph URL and a one-time host link. The Worker runs Moral Graph Elicitation on Workers AI: a short dialogue on what the participant attends to and why, a values card (title, attention items, story) drafted in their words and confirmed by them, pairwise "wiser than" judgments between other participants' cards (no model calls), and a public graph ranked by Bradley–Terry strength. | None. Delib stores neither the dialogues nor the cards or the token. | MIT clean-room reimplementation of the published method (upstream code has no license); no card deduplication into canonical values yet. | Available with managed create. |
| Pocket Budget（口袋預算） | Hand an option list (name, cost, description, category) and a total to pocket-budget; Delib returns the vote URL, the public results URL and a one-time host link. Knapsack ballots (picks within the cap) or approval ballots (at most k picks), one ballot per device with revision until close, an optional reason per ballot. Results give per-option votes and support, the most-voted bundle (Stanford PB knapsack tally) and a fairness-adjusted bundle (mean satisfaction × (1 − inequality), local search), plus tttc.csv of reasons. | None. Delib stores neither the ballots nor the token. | MIT single-Worker implementation; no model calls; no voter roll or identity verification, so deliberative use only. | Available with managed create. |
| Pocket Harmonica（口袋訪談） | Create a one-to-one AI interview session from the same fields as the Harmonica draft (topic, goal, context, critical voices, starter questions); Delib returns the participant link, a one-time host link and the tttc.csv export URL. Interviews run on Workers AI inside a per-session and daily neuron ledger; the host can hand transcripts to Pocket TTTC. | None. Delib does not store transcripts or the host token; no API key exists. | MIT clean-room reimplementation of the Harmonica flow on one Worker; Deploy button available. No voice, no cross-pollination. | Available with managed create. |
| Pocket Form（口袋表單） | Create a deliberation intake form (sign-up, background survey, question collection; up to 12 questions, six types) from a title and question list; Delib returns the participant link, a one-time host link and the export URLs (tttc.csv, Pocket Polis seeds). | None. Delib does not store the questions, responses or the host token. | MIT single-Worker form service written for this flow; Deploy button available. No email, uploads or branching logic. | Available with managed create. |
| Pocket TTTC（口袋議題樹） | Hand an id,interview,comment CSV (from the Pocket Polis report page, Call-in, or the data workbench merge) to ttt-city.mashbean.net; Delib returns the public report URL and a one-time manage link. The pipeline (clustering → claim extraction → grouping → summaries) runs on Workers AI inside the free-tier neuron ledger. | None. Delib does not store the CSV, the report or the admin token. | MIT reimplementation of Talk to the City on one Cloudflare Worker (Durable Objects + Workers AI); Deploy button available. No cruxes or video sources. | Available with managed create and data handoff. |
| Talk to the City | Pre-fill title and description, then embed the current official `/create` UI. Login, CSV upload, model processing and submission all remain inside TTTC. | The user logs in to TTTC in its own frame; Delib never receives the Firebase token. | Current source uses Next/Express, Firebase, Google Cloud Storage, Redis/PubSub and model services, not a Cloudflare-only stack. | Available with upstream login. |
| Harmonica | Create a conversational session through the official REST API, then return the participant workspace and official management page. The same task can be handed to `harmonica-mcp`. | A `hm_live_` key remains in the browser tab and is sent through the Worker only for the confirmed request. | Official hosted accounts offer a free starting path. Full AGPL self-hosting still needs PostgreSQL, Auth0, model/embedding and vector/file services. | Available with API key. |
| Power Ranker | Choose a fully local share link or a 24-hour／seven-day room. Room submissions are immediately reduced to pair counts; public aggregates appear at three sessions, and organizers can delete early. Aggregate results can become a fragment-only public receipt after the organizer states interpretation, missing voices, authority and next responsibility. The receipt can then prepare a one-time local draft for Call-in, Harmonica, TTTC or Pol.is without carrying aggregate records. | None. Local exports contain a random pseudonymous session ID. Rooms keep only its SHA-256 hash for deduplication; the private admin token stays after `#` and is stripped from receipts and next-step drafts. | Static mode, receipt rendering and same-tab handoff need no storage. Room mode uses one SQLite Durable Object per room and works within Workers Free limits; excess operations fail. | Available locally or with ephemeral room, result receipt and next-step draft. |
| Parti DemosX | Listed as a source-available full civic-participation platform, not an iframe or managed creator. | A self-host operator would own all accounts, retention and administration. Delib does not connect to a current hosted DemosX account. | MIT source builds a Java／Maven WAR; the supplied Docker Compose runs Tomcat, MySQL and Nginx and contains development defaults that must be replaced. The repository was last pushed in 2022, so dependency, security and export review comes before deployment. | Catalog only; shared-host candidate after maintenance review. |

The other eighteen gallery tools stay `catalog-only` until we have verified
their creation API, embed policy, export contract, authentication, retention,
free-tier and deploy target. Their identifiers are listed in
`public/data/integrations.json` so the UI and agents can state this boundary
deterministically.

## Source and hosting paths

`public/data/hosting.json` now records one decision for every one of the 28
tools. The useful groups are deliberately different:

`public/data/deployments.json` is the smaller executable subset shown at
`/deploy`. It has one-click buttons only for Delib, Pocket Polis and
Call-in, whose repositories have reproducible Cloudflare-native
configurations (dry-run verified, identical to production). Each recipe
carries a `verification` note saying how far it was actually exercised. Power Ranker ships inside Delib. A tool cannot enter this subset
from source availability alone: the recipe also needs a build, license, storage
model, deletion path and named operator responsibility.

- Direct or connected: Call-in, Pocket Polis, OpenBook, Pol.is, Agora, HeyForm, Talk to the City,
  Harmonica and Power Ranker already have an in-app path; Uncommon Ground is a data handoff.
- Shared host: Pol.is, Agora, Parti DemosX, Decidim, Go Vocal, MAPLE and Stanford PB are complete
  enough to operate, but require a maintained application/database service.
- Components and prototypes: Deliberative Canvas, Ethelo OS engine, Global
  Brain, Open Micropublishing and Pairwise have reusable code but
  still need a generic organizer and data layer.
- Blocked or unverified: a missing license, unavailable site, research-only
  artifact or missing official repository is shown as such instead of becoming
  an iframe guess.

Pairwise is a good example of why this distinction matters: the GPL source is
available, but the current public app is an ended Optimism RF6 flow with wallet
and campaign-specific services. Power Ranker was small enough to integrate: Delib
ports the MIT `rankCentrality` path to native browser arrays, adds a participant
UI, optional expiring rooms, a participant-aware ranking schema and a separate
aggregate-only result receipt. The receipt keeps tool calculation, organizer
interpretation and formal status as distinct layers; it does not treat spectral
weights as vote percentages or proof of consensus.

Pocket Polis now follows the same layered-result pattern without copying its
participant-aware bundle into the public page. The local workbench blocks a
receipt when export totals disagree, fewer than three participants with a vote appear, or
an included statement has fewer than three responses. It publishes only one to
eight organizer-reviewed statement texts with aggregate response counts, plus
separate interpretation, missing voices, decision authority, response date,
responsible actor and next action. Pseudonymous participant IDs, raw votes,
original-file hashes and the admin token remain outside the receipt.

The next-step draft is deliberately not a generic data pipe. For both result
types, Call-in receives
only a title and summary and still requires a separately verified public deck
URL. Harmonica receives a bounded follow-up brief but no API key. TTTC receives
an analysis title and de-identification reminder, not CSV or receipt data.
Pol.is receives new-conversation mode and a title, not seed statements or a
Site ID. The destination form remains the external-write boundary.

Official Pol.is requires an additional ownership gate. Its implicit creation flow sends
moderation and seed links to the Site ID owner. A shared operator Site ID would
therefore make every organizer depend on the operator. The proposed host keeps
one organizer account per steward and is documented in `docs/polis-hosting.md`.
This is separate from the live Pocket Polis managed host at `polis.mashbean.net`.

## UX contract adapted from Matters Lifeboat

1. Start from a human goal, not a product name.
2. Show only the smallest usable path first.
3. Explain account IDs and tokens in plain language.
4. Preview every external write before it happens.
5. Keep credentials in `sessionStorage`; never put them in URLs.
6. Return public links and private control links in visibly different groups.
7. Give every state a deterministic URL and JSON response for agents.
8. Report real retention, expected time, failure and recovery paths.

## Why the older MetaGov adaptors are not called direct APIs

- The HeyForm adaptor still points to `app.heyform.net` and email/password
  signup/login. The current hosted product is at `my.heyform.net`, and its
  current authentication documentation lists Google and Apple. The adaptor is
  useful historical design evidence, but its live contract must be refreshed.
- HeyForm's official repository currently publishes an unpatched stored-XSS
  advisory affecting form-builder schema updates. Delib therefore supports the
  official participant embed but does not proxy credentials or automate form
  creation.
- The TTTC adaptor points to `api.talktothe.city`, which is not the current
  public interface. The current source obtains a Firebase ID token in the
  official client and sends it to the internal pipeline. Delib embeds that
  maintained client instead of asking non-engineers to extract a token.

## Sources

- [Pocket Polis hosted service](https://polis.mashbean.net/)
- [Pocket Polis MIT source](https://github.com/mashbean/pocket-polis)
- [Pocket Polis Agent guide](https://github.com/mashbean/pocket-polis/blob/main/AGENT.md)
- [Talk to the City source and current CSV contract](https://github.com/AIObjectives/tttc-light-js)
- [Agora Pol.is CSV parser](https://github.com/zkorum/agora/blob/main/services/api/src/service/polisCsvParser.ts)
- [Polis repository and deployment notes](https://github.com/compdemocracy/polis)
- [Polis site integration source](https://github.com/compdemocracy/polis/blob/edge/client-admin/src/components/conversations-and-account/Integrate.js)
- [Cloudflare Containers](https://developers.cloudflare.com/containers/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [HeyForm embed documentation](https://docs.heyform.net/features/embed-your-form)
- [HeyForm self-hosting documentation](https://docs.heyform.net/open-source/self-hosting)
- [HeyForm authentication documentation](https://docs.heyform.net/open-source/configuration/authentication)
- [HeyForm security advisory GHSA-chmm-jqpm-3pwx](https://github.com/heyform/heyform/security/advisories/GHSA-chmm-jqpm-3pwx)
- [Current Talk to the City source](https://github.com/AIObjectives/tttc-light-js)
- [Harmonica REST API and application source](https://github.com/harmonicabot/harmonica-web-app)
- [Harmonica MCP source](https://github.com/harmonicabot/harmonica-mcp)
- [PowerRanker source at the ported revision](https://github.com/zaratanDotWorld/powerRanker/tree/4cc4f604022d0188bde1619fc47f05678c0bc0ad)
- [PDIS polis.tw fork](https://github.com/PDIS/polis2023)
- [Agora Citizen Network source](https://github.com/zkorum/agora)
- [Agora official embed documentation](https://github.com/zkorum/agora/blob/main/doc/embed.md)
- [Agora Pol.is／CSV import worker](https://github.com/zkorum/agora/tree/main/services/import-worker)
- [Parti Digital Democracy 100 builder](https://100-democracy.parti.coop/en/07-builder.html)
- [Parti DemosX source and deployment notes](https://github.com/parti-coop/demosx)
- [MetaGov ontology and adaptors](https://github.com/metagov/ontology)
- [Matters Lifeboat UX flow](https://github.com/thematters/matters-lifeboat/blob/main/docs/ux-flow.md)
- [Call-in hosted creator and self-host path](https://github.com/mashbean/call-in)
- [Uncommon Ground workflow](https://github.com/audreyt/uncommon-ground)
- [Cloudflare Deploy buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Durable Objects pricing and Free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Cloudflare SQLite storage and atomic deleteAll](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

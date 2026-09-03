# Architecture

## Current vertical slice

```text
fixed-choice needs wizard
        ↓
deterministic recommendation engine ← versioned tool registry
        ↓
human-readable result + offline gears + care checks
        ├──────────────────────────────┐
        ↓                              ↓ explicit preview + confirmation
share URL / JSON / Markdown       direct activation adapters
                                  ├─ Call-in managed creator
                                  ├─ Pocket Polis managed creator
                                  │          └─ browser-only CSV validation + delib-data / TTTC / Agora handoff
                                  │                         ↓ organizer review + privacy threshold
                                  │                  result receipt → optional short public URL
                                  │                         ↓ preview + one-time local draft
                                  │          Call-in / Harmonica / TTTC / Pol.is next-step form
                                  ├─ Pol.is connected workspace
                                  ├─ Agora public-conversation workspace
                                  ├─ HeyForm published-form workspace
                                  ├─ Talk to the City official create workspace
                                  ├─ Harmonica credentialed creator + workspace
                                  └─ Power Ranker local or ephemeral-room workspace
                                             ↓ organizer review
                                      result receipt → optional short public URL
                                             ↓ preview + one-time local draft
                             Call-in / Harmonica / TTTC / Pol.is next-step form
        ↓ optional
BYOK OpenAI request OR locally installed Delib skill
```

The planning plane has no participant-data database. Two explicit storage
features are separate from planning: an organizer can create a short-lived Power Ranker room whose
per-room SQLite Durable Object stores only the public question, pair counts and
hashed random session IDs; an organizer can also publish a de-linked result receipt
under a 16-character slug for 30 days, one year or three years. The second Durable
Object stores only the same aggregate public result already visible on the page,
plus organizer-authored interpretation and responsibility. Neither is a general
civic-data warehouse.

## Direct activation plane

`public/data/integrations.json` is a second registry beside the broad tool
catalog. It records whether Delib can actually create, embed or deploy a tool,
which account or credential is required, where data is retained, and which
human gate is mandatory.

- `POST /api/integrations/call-in` validates a small public-deck request,
  forwards it to the hosted Call-in creator, filters the response and returns
  public and private capability links. Delib does not persist the event.
- `POST /api/integrations/pocket-polis` validates a confirmed title,
  description, 5–15 unique seed statements and moderation/data booleans before
  forwarding one create request to `polis.mashbean.net`. It rebuilds the three
  returned URLs from a validated conversation ID and admin token. Public
  participation and report URLs are separated from the fragment-held private
  admin URL; Delib stores none of them server-side.
- `/integrations/pocket-polis-data` reads Pocket Polis `statements.csv`
  and `votes.csv` only in browser memory. It validates the exact export headers,
  foreign keys, pseudonymous participant codes, duplicate votes and aggregate
  count consistency, then hashes both originals. The participant-aware
  `delib-pocket-polis/v1` JSON preserves all rows plus provenance and a data
  card. The `delib-data/v1` adapter maps phases, statements, responses and
  outcomes into the shared envelope while retaining pseudonymous linkage and a
  private-only data-card warning; the TTTC adapter keeps approved statement text only; the Agora adapter
  emits summary, comments and votes CSVs while explicitly marking missing
  author linkage. No admin token is accepted or restored.
- If both Pocket Polis exports agree, at least three participants with a vote appear, and
  an approved statement has at least three responses, the organizer may select
  one to eight such statements for a `delib-pocket-polis-receipt/v1` result.
  The organizer must also state interpretation, missing voices, decision
  status and authority, response owner, response date and next action, and
  explicitly confirm that participant-authored text is suitable for public
  release. The receipt keeps selected statement text and aggregate
  agree/disagree/pass counts, but strips pseudonymous participant IDs, raw
  votes, original-file hashes and admin tokens. The public
  `/results/pocket-polis` page reads it after `#`; this default path is not stored.
- `POST /api/integrations/polis` validates an existing conversation or a
  public Site ID integration and returns a same-site workspace URL. Loading the
  Site ID workspace is the external write, so it remains a separate click.
- `GET /api/integrations/polis/status` reports whether the current deployment
  has a `POLIS_SITE_ID` connection without revealing its value.
- `POST /api/integrations/heyform` accepts only a canonical public form URL and
  returns a same-site participant workspace. Answers go directly to HeyForm.
- `POST /api/integrations/agora` accepts only an official Agora Citizen Network
  public conversation URL, normalizes the old `.network` route to the current
  `.app` route and returns a same-site embed workspace. Delib does not proxy
  login, opinions, comparisons or votes, and does not claim project creation.
- `POST /api/integrations/tttc` prepares a same-site wrapper around the current
  official create page. Authentication, CSV and report creation stay in TTTC.
- `POST /api/integrations/harmonica` validates a tab-only `hm_live_` key and a
  bounded, confirmed session brief; it forwards one create request to the
  official REST API and returns only the session ID, participant workspace and
  management URL. Neither the key nor upstream response body is stored.
- `/integrations/power-ranker` has two modes. Local mode encodes the
  question after `#`; judgments and imported files stay in page memory. Room
  mode creates one SQLite Durable Object per room. A submission is immediately
  reduced to pair counts; only the SHA-256 hash of its random session ID remains
  for duplicate suppression, and there is no raw-judgment table.
- `POST /api/integrations/power-ranker/rooms` creates a confirmed 24-hour or
  seven-day room and returns a public participant URL plus a private management
  URL whose token stays after `#`. GET returns public aggregates only at three
  sessions; DELETE requires that token. The Durable Object alarm calls atomic
  `deleteAll()` at expiry, and the management page can invoke the same cleanup.
- Once a local or room aggregate exists, the organizer can prepare a
  `delib-ranking-receipt/v1` result. The browser rebuilds the ranking from the
  pair counts, strips fragment-held admin capabilities, and requires separate
  fields for interpretation, missing voices, decision authority, response
  owner and next action. The public `/results/power-ranker` page reads the
  receipt after `#`; the fragment is not sent to or stored by the Worker. Both
  local and aggregate ranking bundles can additionally be exported through the
  same `delib-data/v1` envelope, with individual session linkage and aggregate
  pair counts kept semantically distinct.
- `POST /api/receipts` accepts only the two normalized public receipt kinds. It
  rejects direct identifiers, individual records, pseudonymous linkage, raw
  judgments, source files, credentials and unexpected fields. A new
  `PublicReceipt` SQLite Durable Object receives one randomly named slug, the
  public receipt, expiry, and a SHA-256 hash of a random delete token. `GET
  /api/receipts/:slug` returns the public copy; `DELETE` requires the token in a
  header. The private manage URL keeps that token after `#`, so it is never part
  of the page request. The alarm and verified deletion both call `deleteAll()`.
- Either result page can derive a `delib-handoff/v1` draft for Call-in,
  Harmonica, Talk to the City or Pol.is. The handoff excludes pair counts,
  statement texts and counts, raw judgments and votes, session IDs,
  participant pseudonyms, receipt URLs, admin capabilities and credentials.
  It is stored in same-tab `sessionStorage` for at most two hours, consumed on
  first load, and only pre-fills the destination form. Every destination keeps
  its existing preview, validation and explicit-confirmation gate.
- Private Call-in links stay in tab-scoped `sessionStorage` and never enter a
  plan URL or exported public receipt.
- The private Pocket Polis admin URL follows the same tab-scoped rule. The
  participant and report links are public capabilities; the admin fragment is
  never written to Delib logs, plan URLs or exports.

The remaining tools stay read-only recommendations until the credential,
retention, export and end-to-end creation paths have been verified. An embedded
upstream UI is labelled separately from a managed create API.

## Cross-tool data plane

`delib-data/v1` is the first shared envelope, implemented for Pocket Polis and
Power Ranker. It contains source identity and source schema, phases, items,
responses, outcomes, a compact summary, provenance and a machine-readable data
card. The adapter must not erase semantic differences: Pocket Polis retains
agree/disagree/pass and participant linkage; Power Ranker retains pair direction
and labels an individual session differently from de-linked aggregate counts.
All transformations run in the browser and downloads remain outside Worker
storage. This envelope is the handoff contract, not an authorization to publish.

The next larger archival package remains planned:

Future adapters should produce a versioned bundle:

```text
manifest.json
data-card.md
sources/
  original exports, unchanged
normalized/
  projects.ndjson
  phases.ndjson
  events.ndjson
  statements.ndjson
  reactions.ndjson
  collections.ndjson
  outcomes.ndjson
artifacts/
  reports, slides, evidence and result pages
provenance/
  checksums and transformation log
```

R2 is the likely home for immutable originals and artifacts. D1 can store
project, phase, permission and handoff metadata. Cloudflare Workflows or Queues
can perform explicit, restartable adapter handoffs. Public release must remain a
separate, human-approved step.

The source-specific ranking bundle is intentionally separate from `delib-bundle/v1`.
Planning bundles contain no participant data; `delib-ranking/v1` explicitly
marks pairwise judgments as participant data even when they contain no names.
`delib-ranking-receipt/v1` accepts aggregates only, preserves that participant-
data warning, excludes individual linkage, and adds explicitly human-authored
interpretation and responsibility fields.
`delib-pocket-polis-receipt/v1` applies the same layered result pattern to
selected approved statements. It enforces participant and response thresholds,
preserves the warning that public free text may self-identify, and excludes the
pseudonymous vote linkage present in the participant-aware source bundle.
`delib-handoff/v1` is smaller again: it carries only bounded organizer-authored
summary fields needed for one named destination. It is not an export of the
underlying receipt and cannot be treated as TTTC qualitative input or Pol.is
seed statements.

## Adapter contract

Each adapter should expose:

- `discover`: describe capabilities and deployment requirements;
- `export`: retrieve the original flat file without changing it;
- `normalize`: map tool-specific data to the shared bundle;
- `validate`: report coverage, omissions and privacy warnings;
- `import`: create the next tool's input only after human preview;
- `receipt`: record what happened, what did not, and the next responsible actor.

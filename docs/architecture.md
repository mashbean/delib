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
                                  ├─ Pol.is connected workspace
                                  ├─ HeyForm published-form workspace
                                  ├─ Talk to the City official create workspace
                                  ├─ Harmonica credentialed creator + workspace
                                  └─ Power Ranker local or ephemeral-room workspace
        ↓ optional
BYOK OpenAI request OR locally installed Delib skill
```

The planning plane has no participant-data database. Power Ranker adds one
bounded exception: an organizer can explicitly create a short-lived room whose
per-room SQLite Durable Object stores only the public question, pair counts and
hashed random session IDs. It is not a general civic-data warehouse.

## Direct activation plane

`public/data/integrations.json` is a second registry beside the broad tool
catalog. It records whether Delib can actually create, embed or deploy a tool,
which account or credential is required, where data is retained, and which
human gate is mandatory.

- `POST /api/integrations/call-in` validates a small public-deck request,
  forwards it to the hosted Call-in creator, filters the response and returns
  public and private capability links. Delib does not persist the event.
- `POST /api/integrations/polis` validates an existing conversation or a
  public Site ID integration and returns a same-site workspace URL. Loading the
  Site ID workspace is the external write, so it remains a separate click.
- `GET /api/integrations/polis/status` reports whether the current deployment
  has a `POLIS_SITE_ID` connection without revealing its value.
- `POST /api/integrations/heyform` accepts only a canonical public form URL and
  returns a same-site participant workspace. Answers go directly to HeyForm.
- `POST /api/integrations/tttc` prepares a same-site wrapper around the current
  official create page. Authentication, CSV and report creation stay in TTTC.
- `POST /api/integrations/harmonica` validates a tab-only `hm_live_` key and a
  bounded, confirmed session brief; it forwards one create request to the
  official REST API and returns only the session ID, participant workspace and
  management URL. Neither the key nor upstream response body is stored.
- `/integrations/power-ranker.html` has two modes. Local mode encodes the
  question after `#`; judgments and imported files stay in page memory. Room
  mode creates one SQLite Durable Object per room. A submission is immediately
  reduced to pair counts; only the SHA-256 hash of its random session ID remains
  for duplicate suppression, and there is no raw-judgment table.
- `POST /api/integrations/power-ranker/rooms` creates a confirmed 24-hour or
  seven-day room and returns a public participant URL plus a private management
  URL whose token stays after `#`. GET returns public aggregates only at three
  sessions; DELETE requires that token. The Durable Object alarm calls atomic
  `deleteAll()` at expiry, and the management page can invoke the same cleanup.
- Private Call-in links stay in tab-scoped `sessionStorage` and never enter a
  plan URL or exported public receipt.

The remaining tools stay read-only recommendations until the credential,
retention, export and end-to-end creation paths have been verified. An embedded
upstream UI is labelled separately from a managed create API.

## Planned data plane

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

The ranking bundle is intentionally separate from `delib-bundle/v1`.
Planning bundles contain no participant data; `delib-ranking/v1` explicitly
marks pairwise judgments as participant data even when they contain no names.

## Adapter contract

Each adapter should eventually expose:

- `discover`: describe capabilities and deployment requirements;
- `export`: retrieve the original flat file without changing it;
- `normalize`: map tool-specific data to the shared bundle;
- `validate`: report coverage, omissions and privacy warnings;
- `import`: create the next tool's input only after human preview;
- `receipt`: record what happened, what did not, and the next responsible actor.

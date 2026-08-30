# Architecture

## Current vertical slice

```text
fixed-choice needs wizard
        ↓
deterministic recommendation engine ← versioned tool registry
        ↓
human-readable result + offline gears + care checks
        ↓
share URL / delib-bundle JSON / Markdown runbook
        ↓ optional
BYOK OpenAI request OR locally installed Delib skill
```

The first release deliberately has no participant-data database. It proves the
recommendation, handoff and receipt UX before introducing persistent civic data.

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

## Adapter contract

Each adapter should eventually expose:

- `discover`: describe capabilities and deployment requirements;
- `export`: retrieve the original flat file without changing it;
- `normalize`: map tool-specific data to the shared bundle;
- `validate`: report coverage, omissions and privacy warnings;
- `import`: create the next tool's input only after human preview;
- `receipt`: record what happened, what did not, and the next responsible actor.


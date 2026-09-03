# Roadmap and completion boundary

Updated: 2026-09-03

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
6. Decide whether a slug index (KV) is needed for public-receipt takedowns.

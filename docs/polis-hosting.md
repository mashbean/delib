# Pocket Polis live host and official Pol.is hosting decision

Last checked: 2026-09-01

## Decision

`https://polis.mashbean.net/` is now the live host for **Pocket Polis／口袋審議**.
It is an MIT-licensed lightweight reimplementation built for one Cloudflare
Worker and SQLite Durable Objects. Delib can call its public create API without
an account and return participant, report and fragment-held admin links.

Pocket Polis is not a deployment of the official Pol.is source and must never
be labelled as one. Self-hosting official Pol.is remains viable, but it is not a
GitHub + Cloudflare Workers-only deployment. If official feature parity is
required, the practical product is one maintained shared service behind
Cloudflare, with one organizer account per steward, rather than a new Docker
stack for every deliberation.

Use `compdemocracy/polis` `edge` as the upstream baseline. Do not start from
`PDIS/polis2023`: it is useful evidence that PDIS operated a customized Docker
deployment, but its `pdis-prod` branch is far behind current upstream and
`https://polis.tw/` currently returns Cloudflare 523.

## Two deliberately separate shapes

```text
delib.mashbean.net (Cloudflare Worker)
        │ confirmed create API
        ▼
polis.mashbean.net (Pocket Polis Worker)
  └─ SQLite Durable Object per conversation

official Pol.is shared host (future, different hostname)
  │ Cloudflare DNS, TLS, WAF
  ▼
maintained Linux/container origin
  ├─ Node API and web clients
  ├─ Clojure math service
  ├─ file/export service
  └─ PostgreSQL with backups
```

Pocket Polis is Cloudflare-native and has a public one-click deploy path. The
official stack still needs a VM or managed container/database provider;
Cloudflare remains useful at its edge, but Containers does not replace
PostgreSQL.

## Pocket Polis managed-create contract

The Delib form accepts a bounded title, optional description, 5–15 unique seed
statements and explicit moderation/open-data booleans. After human confirmation
it calls `POST https://polis.mashbean.net/api/conversations` once. Delib validates
the returned conversation ID and admin token, constructs the three canonical
URLs, and does not persist them server-side.

- participant URL and report URL are public capabilities;
- the admin URL contains its token after `#` and stays in tab-scoped
  `sessionStorage`;
- statements, votes, clustering and CSV exports remain in Pocket Polis;
- weak sybil resistance is disclosed, so the tool is not the only ballot for a
  high-adversarial or legally binding decision;
- an Agent may draft seed statements and settings, but a person confirms before
  any external conversation is created.

## Pocket Polis post-collection handoff

The organizer downloads `statements.csv` and `votes.csv` from the Pocket Polis
admin page, then opens `/integrations/pocket-polis-data.html`. Delib reads both
files only in browser memory and never asks for the admin token. It verifies the
exact upstream columns, anonymous participant codes, statement references,
duplicate participant/statement votes and the agreement totals copied into the
statement export. SHA-256 for each original is recorded in the local bundle.

Three handoffs are available after an explicit participant-data confirmation:

- `delib-pocket-polis/v1` JSON keeps statements, pseudonymous votes, provenance,
  consistency warnings and an explicit data card;
- TTTC CSV uses `id,interview,comment` and includes approved statements only;
- Agora Pol.is CSV uses the upstream summary/comments/votes layout. Pocket Polis
  does not export statement authors, so `author-id` is `-1`, `commenters` is `0`
  and Agora must calculate groups again.

Potential spreadsheet formulas in free text receive a leading apostrophe. A
successful local conversion is not evidence that the hosted TTTC or Agora import
succeeded; that remains a separate upstream-account and preview check.

## Pocket Polis result receipt

The same local workbench can turn a validated aggregate into a public
`delib-pocket-polis-receipt/v1` result without uploading the two CSV files to
Delib. Publication is blocked unless both exports agree, at least three
participants with a vote appear, and every selected approved statement has at least three
responses. The organizer may select one to eight statements and must review
their text, then add a separate interpretation, missing voices, decision
status and authority, responsible actor, response date and next action.

The receipt includes only those selected statement texts and aggregate
agree/disagree/pass counts. It excludes participant pseudonyms, raw vote rows,
original-file hashes and the Pocket Polis admin token. The encoded receipt stays
after `#` in `/results/pocket-polis.html`; browsers do not send that fragment to
the Worker and Delib does not store it. The full link is still a public
capability, so anyone who receives it can read and reshare its participant-
authored text.

From the result page, the organizer can preview a minimized
`delib-handoff/v1` draft for Call-in, Harmonica, TTTC or Pol.is. It contains
accountability fields but no statement text or counts. It remains in the same
tab's `sessionStorage`, expires after two hours and is deleted on first read;
the destination still requires its normal validation and confirmation before
any external write.

The repository's `npm run pilot:pocket-polis` command makes this route
reproducible against the fictional defense-budget demo. It reads only the
public conversation, result and open-data CSV endpoints, then produces the
participant-aware bundle, TTTC and Agora files, result receipt and all four
handoff drafts. It stops rather than requesting a private token when open data
is disabled. The pilot distinguishes opened participant sessions from unique
people with a vote because only the latter appear in `votes.csv` and the result
receipt.

## The official Pol.is one-click gate

Running the containers is only the operator step. A non-engineer still needs:

1. an organizer account with a verified email;
2. a Site ID owned by that account;
3. a deterministic `page_id` for each deliberation;
4. the moderation and seed links delivered only to that owner;
5. exports, deletion and backup procedures;
6. a way to hand results back to `delib-bundle/v1`.

Upstream implicit conversation creation already creates a conversation from
`site_id + page_id`, then emails the participation, moderation and seed links to
the Site ID owner. This means a single operator-owned Site ID is not sufficient
for a public self-service product: every organizer would otherwise depend on the
operator to forward private moderation access.

Any future official shared-host release should therefore keep upstream account ownership.
Delib may remove the copy-and-paste step after the organizer explicitly connects
their account, but must not silently make every event belong to one Mashbean
account.

## Release gates

- Rebase and pin a reviewed upstream commit; document all local patches.
- Configure transactional email, origin TLS, database migrations and daily
  encrypted backups; run a restore drill.
- Verify account registration, Site ID ownership, implicit creation, seed,
  moderation, export and deletion on the deployed domain.
- Add resource limits, abuse reporting, privacy notice, retention policy and an
  operator contact before public signup.
- Connect Delib only after a real organizer can create a conversation and retain
  their own moderation rights end to end.

## Sources

- <https://polis.mashbean.net/>
- <https://github.com/mashbean/pocket-polis>
- <https://github.com/mashbean/pocket-polis/blob/main/AGENT.md>
- <https://github.com/AIObjectives/tttc-light-js>
- <https://github.com/zkorum/agora/blob/main/services/api/src/service/polisCsvParser.ts>
- <https://github.com/compdemocracy/polis>
- <https://github.com/compdemocracy/polis/blob/edge/docker-compose.yml>
- <https://github.com/compdemocracy/polis/blob/edge/server/src/routes/implicitConversation.ts>
- <https://github.com/PDIS/polis2023>
- <https://developers.cloudflare.com/containers/>

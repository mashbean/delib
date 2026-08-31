# Pol.is shared hosting decision

Last checked: 2026-08-31

## Decision

Self-hosting Pol.is from source is viable, but it is not a GitHub + Cloudflare
Workers-only deployment. The practical product is one maintained shared Pol.is
service behind Cloudflare, with one organizer account per steward, rather than a
new Docker stack for every deliberation.

Use `compdemocracy/polis` `edge` as the upstream baseline. Do not start from
`PDIS/polis2023`: it is useful evidence that PDIS operated a customized Docker
deployment, but its `pdis-prod` branch is far behind current upstream and
`https://polis.tw/` currently returns Cloudflare 523.

## Proposed shape

```text
delib.mashbean.net (Cloudflare Worker)
        │ prepare / open
        ▼
polis.mashbean.net (Cloudflare DNS, TLS, WAF)
        │
        ▼
maintained Linux/container origin
  ├─ Node API and web clients
  ├─ Clojure math service
  ├─ file/export service
  └─ PostgreSQL with backups
```

Cloudflare remains useful at the edge, but the stateful origin and PostgreSQL
need a VM or managed container/database provider. Cloudflare Containers has no
free allocation and does not replace PostgreSQL.

## The real one-click gate

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

The first shared-host release should therefore keep upstream account ownership.
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

- <https://github.com/compdemocracy/polis>
- <https://github.com/compdemocracy/polis/blob/edge/docker-compose.yml>
- <https://github.com/compdemocracy/polis/blob/edge/server/src/routes/implicitConversation.ts>
- <https://github.com/PDIS/polis2023>
- <https://developers.cloudflare.com/containers/>


# Direct integration audit

Last checked: 2026-08-30

This audit separates discovery from a usable integration. A tool is not called
“one click” merely because it has source code, an adaptor, an iframe, or a deploy
button.

## Readiness gates

| Gate | Meaning |
| --- | --- |
| Available | The in-app path exists, has a human confirmation gate and was tested. |
| Available with connection | Delib can embed or create after a one-time public identifier or account connection. |
| Direct viewer | Useful inside the workflow but has no per-project instance. |
| Agent pipeline | Runs against a data handoff rather than as a hosted participation surface. |
| Next: credentialed | The upstream adaptor can perform the operation, but Delib still needs a tab-only credential flow and end-to-end test. |
| Catalog only | Discovery metadata only. No claim of deployment, API stability or security review. |

## First integration set

| Tool | Current path in Delib | Account / credential | Free / deployment boundary | Decision |
| --- | --- | --- | --- | --- |
| Call-in | Create a seven-day hosted event from a public deck URL; return audience, presenter, setup and moderation links. | None. Private setup and moderation links remain in the tab. | Hosted path needs no account. The source also supports Cloudflare Workers + SQLite Durable Objects, available within the Workers Free limits. | Available. |
| Pol.is | Embed an existing conversation. A connected `site_id` plus deterministic `page_id` can create on first load. | Account and Site ID are needed to own and administer new conversations. Site ID is not a password. | The official main deployment says it is free for nonprofits and government. Full self-hosting uses Docker and PostgreSQL, so it is not labelled Cloudflare-native. | Available with connection. |
| OpenBook | Use the public evidence page as an evidence gear. | None. | Public static site; there is no instance to create. | Direct viewer. |
| Uncommon Ground | Hand a complete question pool to a bounded agent; preserve withdrawn rows and verify the final receipt. | No service account. The execution environment supplies any model credential. | CC0 workflow; not a hosted participation service. | Agent pipeline. |
| HeyForm | The MetaGov Rust adaptor can sign in, create workspaces and polls, publish and return an embed URL. | HeyForm credentials are required. | Current cost and limits depend on the selected HeyForm instance. | Next: credentialed. |
| Talk to the City | The MetaGov Rust adaptor can create a report from CSV or Google Sheets and poll for completion. | Firebase ID token is required. | Service and model limits must be checked at use time. | Next: credentialed. |

The remaining nineteen gallery tools stay `catalog-only` until we have verified
their creation API, embed policy, export contract, authentication, retention,
free-tier and deploy target. Their identifiers are listed in
`public/data/integrations.json` so the UI and agents can state this boundary
deterministically.

## UX contract adapted from Matters Lifeboat

1. Start from a human goal, not a product name.
2. Show only the smallest usable path first.
3. Explain account IDs and tokens in plain language.
4. Preview every external write before it happens.
5. Keep credentials in `sessionStorage`; never put them in URLs.
6. Return public links and private control links in visibly different groups.
7. Give every state a deterministic URL and JSON response for agents.
8. Report real retention, expected time, failure and recovery paths.

## Sources

- [Polis repository and deployment notes](https://github.com/compdemocracy/polis)
- [Polis site integration source](https://github.com/compdemocracy/polis/blob/edge/client-admin/src/components/conversations-and-account/Integrate.js)
- [MetaGov ontology and adaptors](https://github.com/metagov/ontology)
- [Matters Lifeboat UX flow](https://github.com/thematters/matters-lifeboat/blob/main/docs/ux-flow.md)
- [Call-in hosted creator and self-host path](https://github.com/mashbean/call-in)
- [Uncommon Ground workflow](https://github.com/audreyt/uncommon-ground)
- [Cloudflare Deploy buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Durable Objects pricing and Free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/)

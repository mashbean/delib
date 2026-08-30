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
| Available: existing only | A published participation surface can be embedded; project creation stays upstream. |
| Available with upstream login | Delib opens the current official flow in-app, while authentication and data remain upstream. |
| Direct viewer | Useful inside the workflow but has no per-project instance. |
| Agent pipeline | Runs against a data handoff rather than as a hosted participation surface. |
| Next: credentialed | The upstream adaptor can perform the operation, but Delib still needs a tab-only credential flow and end-to-end test. |
| Catalog only | Discovery metadata only. No claim of deployment, API stability or security review. |

## First integration set

| Tool | Current path in Delib | Account / credential | Free / deployment boundary | Decision |
| --- | --- | --- | --- | --- |
| Call-in | Create a seven-day hosted event from a public deck URL; return audience, presenter, setup and moderation links. | None. Private setup and moderation links remain in the tab. | Hosted path needs no account. The source also supports Cloudflare Workers + SQLite Durable Objects, available within the Workers Free limits. | Available. |
| Pol.is | Embed an existing conversation. A connected `site_id` plus deterministic `page_id` can create on first load. A personal Delib Deploy-button install can ask for `POLIS_SITE_ID` once. | A real Pol.is account creates and owns the Site ID. Cloudflare cannot manufacture one. Site ID is not a password. | Full self-hosting uses several containers and PostgreSQL. Cloudflare Containers are Workers Paid only and do not provide PostgreSQL, so this is not labelled a free Cloudflare-native deployment. | Available with connection. |
| OpenBook | Use the public evidence page as an evidence gear. | None. | Public static site; there is no instance to create. | Direct viewer. |
| Uncommon Ground | Hand a complete question pool to a bounded agent; preserve withdrawn rows and verify the final receipt. | No service account. The execution environment supplies any model credential. | CC0 workflow; not a hosted participation service. | Agent pipeline. |
| HeyForm | Validate an existing public form URL and embed the published participant form in Delib. | No Delib credential. Creating and administering a form stays in HeyForm. Delib never asks for a password or cookie. | Self-hosting needs the application, MongoDB and Redis/KeyDB; official docs point to hosted/container platforms, not Cloudflare Workers. | Available: existing only. |
| Talk to the City | Pre-fill title and description, then embed the current official `/create` UI. Login, CSV upload, model processing and submission all remain inside TTTC. | The user logs in to TTTC in its own frame; Delib never receives the Firebase token. | Current source uses Next/Express, Firebase, Google Cloud Storage, Redis/PubSub and model services, not a Cloudflare-only stack. | Available with upstream login. |

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

- [Polis repository and deployment notes](https://github.com/compdemocracy/polis)
- [Polis site integration source](https://github.com/compdemocracy/polis/blob/edge/client-admin/src/components/conversations-and-account/Integrate.js)
- [Cloudflare Containers](https://developers.cloudflare.com/containers/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [HeyForm embed documentation](https://docs.heyform.net/features/embed-your-form)
- [HeyForm self-hosting documentation](https://docs.heyform.net/open-source/self-hosting)
- [HeyForm authentication documentation](https://docs.heyform.net/open-source/configuration/authentication)
- [HeyForm security advisory GHSA-chmm-jqpm-3pwx](https://github.com/heyform/heyform/security/advisories/GHSA-chmm-jqpm-3pwx)
- [Current Talk to the City source](https://github.com/AIObjectives/tttc-light-js)
- [MetaGov ontology and adaptors](https://github.com/metagov/ontology)
- [Matters Lifeboat UX flow](https://github.com/thematters/matters-lifeboat/blob/main/docs/ux-flow.md)
- [Call-in hosted creator and self-host path](https://github.com/mashbean/call-in)
- [Uncommon Ground workflow](https://github.com/audreyt/uncommon-ground)
- [Cloudflare Deploy buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Durable Objects pricing and Free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/)

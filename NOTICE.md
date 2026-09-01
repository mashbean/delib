# Sources and acknowledgements

Delib is an independent open-source project. It links to and describes other
projects, but does not imply endorsement by their maintainers.

- The progressive-disclosure UX, calm microcopy, three-path landing page and
  session-only token pattern are adapted from
  [Matters 記憶吐司](https://github.com/thematters/matters-lifeboat), an MIT
  licensed project developed as part of the Matters open-source ecosystem.
- The bounded-agent, public-accountability, corrigibility and sunset checks are
  adapted from Audrey Tang and Caroline Green's
  [Civic AI — 6-Pack of Care](https://github.com/audreyt/civic.ai), released
  under CC0 1.0.
- The idea that every listening process should close with an inspectable
  receipt and a response to every participant is informed by
  [Uncommon Ground](https://github.com/audreyt/uncommon-ground), released under
  CC0 1.0.
- The deliberative stages and flat-file interoperability approach are based on
  Metagov's [Deliberative Tools Gallery](https://metagov.org/delib-tools),
  [interop specification](https://github.com/metagov/interop/blob/main/specification.md)
  and [ontology](https://github.com/metagov/ontology).
- The Pol.is workspace frames the upstream `https://pol.is/` participation
  surface over HTTPS. Pol.is is an independent AGPL-3.0 project; its code is
  not copied into this repository and its service policies apply inside the
  embedded frame.
- The managed Pocket Polis activation calls
  [polis.mashbean.net](https://polis.mashbean.net/), a separate MIT-licensed
  Cloudflare Worker project. It is a lightweight reimplementation, not the
  official Pol.is service or codebase. Delib does not persist its conversation
  data or fragment-held admin token.
- The managed Call-in activation calls the separately deployed
  [Call-in](https://github.com/mashbean/call-in) hosted creator. Call-in is
  Apache-2.0 licensed and keeps its own seven-day event lifecycle.
- The HeyForm workspace frames a published `https://heyform.net/f/...`
  participant surface. HeyForm is an independent AGPL-3.0 project; no HeyForm
  source or participant response is copied into this repository.
- The Agora workspace frames an official public conversation from the
  AGPL-3.0 [Agora Citizen Network](https://github.com/zkorum/agora) project.
  Delib normalizes the older `agoracitizen.network` share route to the current
  `agoracitizen.app` route; no Agora source or participant data is copied.
- The Talk to the City workspace frames the maintained
  `https://talktothe.city/create` interface. Its current source is the
  Apache-2.0 licensed
  [tttc-light-js](https://github.com/AIObjectives/tttc-light-js) project;
  authentication, uploads and model processing remain upstream.
- The Harmonica creator calls the public REST API of the independent AGPL-3.0
  [Harmonica web app](https://github.com/harmonicabot/harmonica-web-app) and
  frames only the returned participant URL. No Harmonica source, API key or
  participant response is bundled or persisted by Delib.
- `public/power-ranker-core.js` is a browser-native adaptation of the
  `rankCentrality` path from
  [PowerRanker revision 4cc4f60](https://github.com/zaratanDotWorld/powerRanker/tree/4cc4f604022d0188bde1619fc47f05678c0bc0ad),
  Copyright (c) 2024 Kronosapiens Labs and used under the MIT License. Delib
  replaces the matrix dependency with native arrays and adds question,
  participant export and aggregate handoff UI; it does not change the upstream
  project or imply endorsement.
- The source/hosting registry cites upstream repositories and their declared
  licenses. “Reusable” means a current repository exposes a recognized open
  license; it does not mean Delib has copied or redistributed that code.
- The registry describes Parti Co-op's MIT-licensed
  [DemosX](https://github.com/parti-coop/demosx) source as a self-host candidate.
  Delib does not bundle or run its Java, Tomcat, MySQL or Nginx services.

Tool names and trademarks belong to their respective owners. The tool registry
stores links and factual interoperability metadata; no third-party source code
is bundled unless explicitly noted above.

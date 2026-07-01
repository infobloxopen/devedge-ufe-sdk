---
title: Documentation
next: getting-started
---

devedge-ufe-sdk is the frontend half of the devedge platform. It is a small,
public SDK of TypeScript packages that give an Angular micro-frontend a session
it reads but does not own, navigation that fails loud when it is wrong, and one
way to call a backend with a bearer token.

The SDK is mechanism, not policy. Every seam here is a standard mechanism you
compose. Product-specific bindings — a particular identity provider, a nav
taxonomy, a design system — bind on top privately, and none of them live in this
repository.

## Where things live

The platform is three repositories. This site documents the micro-frontend SDK;
the platform portal is the front door, and the Go service framework keeps its
own reference.

| Repository | What it is | Documentation |
|---|---|---|
| **devedge-ufe-sdk** | The Angular micro-frontend SDK — session seam, loud nav validation, bearer wiring, dev loop. | This site. |
| **devedge** | The `de` CLI, the local edge router, and the orchestration surface. | [infobloxopen.github.io/devedge](https://infobloxopen.github.io/devedge/) |
| **devedge-sdk** | The Go service framework — proto-first services, fail-closed authz, storage. | [infobloxopen.github.io/devedge-sdk](https://infobloxopen.github.io/devedge-sdk/) |

## Start here

{{< cards >}}
  {{< card link="getting-started/" title="Getting started" subtitle="Scaffold a micro-frontend and install the packages." >}}
  {{< card link="tutorial/build-a-micro-frontend/" title="Build a micro-frontend" subtitle="Wire the session, nav, and a backend call end to end." >}}
  {{< card link="how-to/" title="How-to guides" subtitle="Wire the session, validate nav, and diagnose the dev loop." >}}
  {{< card link="reference/" title="Reference" subtitle="The public exports of each package." >}}
  {{< card link="explanation/" title="Explanation" subtitle="Why the seam is public and why nav fails loud." >}}
{{< /cards >}}

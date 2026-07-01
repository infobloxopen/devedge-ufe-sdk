---
title: Installation
weight: 10
---

You get a micro-frontend on this SDK in one of two ways: scaffold a new one with
the devedge CLI, or add the packages to a project you already have. Scaffolding
is the fastest path and is the recommended starting point.

## Prerequisites

- Node 22 and [pnpm](https://pnpm.io/). The SDK is a pnpm workspace and its
  packages build with `tsc`.
- The [`de` CLI](https://infobloxopen.github.io/devedge/) if you want to
  scaffold. `de ufe new` ships in the devedge CLI, the same tool that scaffolds
  backend services with `de new service`.

## Scaffold a micro-frontend

Run `de ufe new` with a name for the micro-frontend:

```bash
de ufe new my-ufe
```

`de ufe new` generates an Angular and single-spa micro-frontend already wired to
the SDK packages: a validated nav contribution, a session-aware shell, and the
bearer interceptor. You do not wire the seams by hand — the scaffold does it, and
the [tutorial](../../tutorial/build-a-micro-frontend/) walks through the code it
produces.

## Add the packages to an existing project

The SDK is five packages. You install the ones your project uses.

| Package | Purpose | Runtime dependencies |
|---|---|---|
| `@infobloxopen/devedge-ufe-core` | The mechanism-only contract: lifecycle, nav-group validation, session seam, manifest. | none |
| `@infobloxopen/devedge-ufe-oidc` | A generic OIDC (auth-code with PKCE) session provider. | `oidc-client-ts` |
| `@infobloxopen/devedge-ufe-single-spa` | The single-spa lifecycle adapter and `createShell`. | `single-spa` |
| `@infobloxopen/devedge-ufe-angular` | Angular glue: session provider, bearer interceptor. | peer `@angular/*`, `rxjs` |
| `@infobloxopen/devedge-ufe-dev-loop` | The `diagnose` checklist and the `devedge-ufe doctor` CLI. | `import-map-overrides` |

{{< callout type="warning" >}}
**The packages are not yet published to npm.** Install them from a local
checkout of the SDK rather than from the registry. Reference each package by a
workspace or `file:` link — for example `"@infobloxopen/devedge-ufe-core":
"file:../devedge-ufe-sdk/packages/core"` in your `package.json`, or a pnpm
workspace entry that points at the checkout. A future release will publish the
packages to npm; until then, `npm install @infobloxopen/devedge-ufe-core` does
not resolve.
{{< /callout >}}

Build the SDK packages once in your checkout so the `file:` links resolve to
built output:

```sh
pnpm install
pnpm -r --filter './packages/*' run build
```

## Next steps

- [Build a micro-frontend](../../tutorial/build-a-micro-frontend/) — a walkthrough
  grounded in the fullstack example.
- [Wire the session](../../how-to/wire-the-session/) — connect a shell-owned
  session to a micro-frontend.
- [Reference](../../reference/) — the public exports of each package.

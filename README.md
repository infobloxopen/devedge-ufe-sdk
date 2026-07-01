# devedge-ufe-sdk

The open-core, mechanism-only micro-frontend SDK for devedge — the **frontend
mirror of [`devedge-sdk`](https://github.com/infobloxopen/devedge-sdk)**. It is
small, public, and carries **no proprietary dependencies**.

## The seam is public; the proprietary implementation binds on top privately

This repo follows the same governance principle as `devedge-sdk`: **the seam is
public; any product-specific implementation is a private binding.** In
`devedge-sdk` the authorization *seam* is the public `authz.Authorizer`
interface; a concrete decision point — say, an OPA-backed authorizer — binds to
it from a separate private package, and nothing about that engine leaks into the
public seam.

The frontend SDK works the same way. Everything here is **mechanism, not
policy**:

- The **session seam** is `SessionProvider`. The generic OIDC binding
  (auth-code + PKCE) is public because OIDC is a standard; a provider-specific
  binding (e.g. for Okta, Auth0, or Keycloak) that merely supplies the
  `authority`/`audience` is a separate **private** package. No identity provider
  is named or hardwired here.
- The **nav seam** is `NavContribution` + `GroupRegistry`. The *set of valid
  groups* (a product taxonomy) is host-supplied and never hardcoded here.
- The **lifecycle seam** is `MicrofrontendModule`. The single-spa/Angular
  adapters are thin; a shell composes them.

Nothing product-specific lives in this repository — no identity-provider names,
no design system, no deployment CRDs, no nav-taxonomy values. Those bind on top,
privately, in a separate extension — the same way a private authorizer binds to
`authz.Authorizer` in `devedge-sdk`.

## Why this exists

A hands-on bootstrap of a real micro-frontend surfaced ten friction findings.
The worst was a **silent failure**: a nav item's `group` field was free text
validated against nothing, so a wrong value rendered **nothing**, with no error
anywhere. This SDK's job is to turn silent failures into **loud, mechanism-level
guarantees**.

## Packages

| Package | Purpose | Runtime deps |
|---|---|---|
| `@infobloxopen/devedge-ufe-core` | Mechanism-only contract: lifecycle (F1), loud nav-group validation (F2), session seam + primitives (F3), manifest (F5). | none |
| `@infobloxopen/devedge-ufe-oidc` | Generic OIDC (auth-code + PKCE) `SessionProvider` over `oidc-client-ts`. Provider-agnostic. | `oidc-client-ts` |
| `@infobloxopen/devedge-ufe-single-spa` | single-spa lifecycle adapter + `createShell` (shell-owns-session registration). | `single-spa` |
| `@infobloxopen/devedge-ufe-angular` | Plain-TS Angular glue: `SESSION_PROVIDER`, provider fn, functional bearer interceptor. Angular 15..latest. | (peer) `@angular/*`, `rxjs` |
| `@infobloxopen/devedge-ufe-dev-loop` | Ordered silent-failure `diagnose` + import-map override helper + `devedge-ufe doctor` CLI. | `import-map-overrides` |

## The load-bearing rule: the shell owns the session; uFEs never authenticate

The **shell** instantiates the `SessionProvider` (usually the OIDC one) exactly
once and threads it into every child uFE as a prop. Child uFEs receive only the
**read-only `SessionProvider` view** — they can read the token, read claims,
subscribe to auth events, and request login/logout, but they cannot construct a
session or reach the identity provider. `createShell` enforces this by gating
registration on `await session.getToken()` before any uFE mounts.

## Getting started

The fastest path to a working micro-frontend is to scaffold one with the devedge
CLI:

```bash
de ufe new my-ufe
```

`de ufe new` generates an Angular + single-spa micro-frontend already wired to
these packages — a validated nav contribution, a session-aware shell, and the
bearer interceptor. It ships in the
[`devedge`](https://github.com/infobloxopen/devedge) CLI, the same tool that
scaffolds backend services with `de new service`.

For a complete backend-and-frontend example — a
[`devedge-sdk`](https://github.com/infobloxopen/devedge-sdk) service and an
Angular micro-frontend that consumes it, with the session and REST seam wired end
to end — see [`examples/fullstack-oss`](examples/fullstack-oss).

To wire a micro-frontend by hand instead, follow the quickstart below.

## Quickstart

### Shell (owns the session, gates registration, validates nav)

```ts
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';
import { createShell } from '@infobloxopen/devedge-ufe-single-spa';
import { staticGroupRegistry, assertNavContributions } from '@infobloxopen/devedge-ufe-core';

// The shell owns OIDC. Issuer is generic (Dex in dev, any OIDC provider in prod).
const session = new OidcSessionProvider({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: 'ufe-shell',
  redirectUri: `${location.origin}/callback`,
  silentRedirectUri: `${location.origin}/silent-refresh`,
  audience: import.meta.env.VITE_OIDC_AUDIENCE, // optional
});

// The host owns the group taxonomy. A wrong group now fails LOUD, not silent.
const groups = staticGroupRegistry(['manage', 'monitor', 'administration']);
assertNavContributions(myNavItems, groups); // throws, naming the bad group + valid ones

const shell = createShell({
  session, // instantiated ONCE; passed to every uFE as a custom prop
  apps: [
    { name: 'widgets', activeWhen: '/widgets', load: () => import('widgets') },
  ],
});
await shell.registerAll(); // awaits getToken() first — proves the shell holds a session
```

### Child uFE (consumes the SessionProvider view; contributes validated nav)

```ts
import { defineManifest, createAuthedFetch, type HostProps } from '@infobloxopen/devedge-ufe-core';

export default defineManifest({
  navItems: [{ name: 'Widgets', path: '/widgets', group: 'manage', type: 'menuItem' }],
  routes: ['/widgets'],
  exports: [{ id: 'widgets', entry: './main.js', type: 'ufe-application' }],
});

export async function mount({ session }: HostProps) {
  const api = createAuthedFetch(session); // Bearer attached; 401 → login → retry once
  const res = await api('/api/v1/widgets');
  // ...render
}
```

### Angular consumer

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideDevedgeSession, bearerAuthInterceptor } from '@infobloxopen/devedge-ufe-angular';

bootstrapApplication(App, {
  providers: [
    provideDevedgeSession(session), // the shell-owned SessionProvider
    provideHttpClient(withInterceptors([bearerAuthInterceptor])),
  ],
});
```

### Dev loop

```sh
# Turns the silent cert/CORS/manifest/nav chain into a loud checklist.
npx devedge-ufe doctor --url https://localhost:4200 --app widgets --metadata metadata.js
```

```ts
import { override } from '@infobloxopen/devedge-ufe-dev-loop';
override('widgets', 'https://localhost:4200/widgets.js'); // import-map override + reload
```

## What this fixes (mapped to the findings in scope for the SDK)

1. **Silent nav-group drop** (the headline bug) — `validateNavContribution` /
   `assertNavContributions` fail loud, naming the unknown group and the valid
   groups. An empty registry warns in dev (`permissive`) or fails in strict mode
   — never a silent pass.
2. **Silent TLS/cert failure** on the dev server — `diagnose` isolates a cert
   error as its own step with an actionable message.
3. **Silent CORS failure** — `diagnose` checks for `access-control-allow-origin`
   and explains why the uFE won't load cross-origin.
4. **Silent "dev server not running"** — `diagnose` reports reachability first.
5. **Silent missing manifest/metadata** — `diagnose` probes it and reports the
   HTTP status.
6. **Ad-hoc, per-team auth wiring** — one generic OIDC `SessionProvider` seam;
   the shell owns it, uFEs consume the read-only view.
7. **uFEs re-implementing login** — the architecture forbids it: uFEs get a
   `SessionProvider`, not the provider factory; `createShell` gates on a token.
8. **Bearer/401 handling copy-pasted per app** — `createAuthedFetch` and
   `bearerAuthInterceptor` centralize attach-Bearer + 401→login→retry.
9. **Manifest shape drift** — `defineManifest` validates the manifest at
   import/build time instead of failing at runtime.
10. **Proprietary lock-in** — none. Every seam is a standard mechanism;
    product-specific bindings (a provider's OIDC authority, a product nav
    taxonomy) live in separate private packages, the same way a private
    authorizer binds to `authz.Authorizer` in `devedge-sdk`.

## Development

```sh
pnpm install
pnpm -r --filter './packages/*' run build     # tsc → dist + .d.ts
pnpm -r --filter './packages/*' run typecheck  # tsc --noEmit
pnpm -r --filter './packages/*' run test       # vitest (jsdom)
```

Node 22, pnpm workspaces, `tsc` for builds, `vitest` for tests. No Angular CLI /
ng-packagr anywhere in the SDK.

## License

[Apache-2.0](./LICENSE).

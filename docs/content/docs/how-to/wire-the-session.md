---
title: Wire the session
weight: 10
---

This guide connects a shell-owned session to a micro-frontend and to the Angular
bearer interceptor, so the micro-frontend calls the backend with a token it
never has to manage. You do this once per shell; every micro-frontend the shell
composes reads the same session.

## Goal

- The shell owns one `SessionProvider`.
- Each micro-frontend receives the read-only session view as a prop.
- Every HTTP request the micro-frontend makes carries the bearer token, and a
  401 triggers login once.

## Prerequisites

- A shell that uses [`createShell`](../../reference/single-spa/#the-shell) from
  `@infobloxopen/devedge-ufe-single-spa`.
- An OIDC issuer URL, or another [`SessionProvider`](../../reference/core/#session-seam).
- For the Angular consumer, `@infobloxopen/devedge-ufe-angular` and Angular 15 or
  later.

## Steps

### 1. Instantiate the session in the shell

Construct the [`OidcSessionProvider`](../../reference/oidc/#oidcsessionprovider)
once, in the shell. The shell is the only place that holds the provider.

```ts
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';

const session = new OidcSessionProvider({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: 'ufe-shell',
  redirectUri: `${location.origin}/callback`,
  silentRedirectUri: `${location.origin}/silent-refresh`,
});
```

### 2. Pass the session to createShell

`createShell` threads the session into every registered app as a prop and gates
registration on a token. The app activates on a hash route, and its bundle loads
through the native browser import map — the `webpackIgnore` comment leaves the
bare specifier for the browser's ESM loader to resolve at runtime.

```ts
import { createShell } from '@infobloxopen/devedge-ufe-single-spa';

const activeOnHash = (route: string) => (location: Location) =>
  location.hash === route || location.hash.startsWith(`${route}/`);

const shell = createShell({
  session,
  apps: [
    {
      name: 'widgets',
      activeWhen: activeOnHash('#widgets'),
      load: () => import(/* webpackIgnore: true */ 'widgets'),
    },
  ],
});
await shell.registerAll(); // awaits session.getToken() before any app mounts
```

See [How micro-frontends load](../../explanation/how-micro-frontends-load/) for
the import map and hash-routing model this example follows.

### 3. Bind the session into Angular DI

When single-spa bootstraps a micro-frontend, the shell-owned session arrives on
`props.session`. Provide it under [`SESSION_PROVIDER`](../../reference/angular/#wiring-the-session-into-di)
at the platform level.

```ts
{ provide: SESSION_PROVIDER, useValue: props.session }
```

### 4. Register the bearer interceptor

Register [`bearerAuthInterceptor`](../../reference/angular/#the-bearer-interceptor)
on the HTTP client. It reads the session from `SESSION_PROVIDER`.

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideDevedgeSession, bearerAuthInterceptor } from '@infobloxopen/devedge-ufe-angular';

bootstrapApplication(App, {
  providers: [
    provideDevedgeSession(session),
    provideHttpClient(withInterceptors([bearerAuthInterceptor])),
  ],
});
```

## Verify

Make an HTTP request from the micro-frontend to a backend that requires a token.
The request carries an `Authorization: Bearer <token>` header without any
per-request auth code. On a 401, the interceptor triggers login and retries once.

{{< callout type="warning" >}}
**A micro-frontend never constructs its own session.** It receives the read-only
`SessionProvider` view. If you find a micro-frontend importing
`OidcSessionProvider`, move that construction up into the shell. See
[The public seam](../../explanation/the-public-seam/#the-shell-owns-the-session-micro-frontends-never-authenticate).
{{< /callout >}}

## See also

- [Reference: single-spa](../../reference/single-spa/) — `createShell` and
  `ShellOptions`.
- [Reference: angular](../../reference/angular/) — the token, provider, and
  interceptor.

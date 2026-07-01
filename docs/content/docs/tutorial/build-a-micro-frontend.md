---
title: Build a micro-frontend
weight: 10
---

This walkthrough follows a working micro-frontend from the session down to a
backend call. By the end you will have seen where the session comes from, how a
child micro-frontend reads it, how nav is validated, and how a REST call to a
[devedge-sdk](https://infobloxopen.github.io/devedge-sdk/) backend carries a
token without any per-request auth code.

The tutorial is grounded in the
[`examples/fullstack-oss`](https://github.com/infobloxopen/devedge-ufe-sdk/tree/main/examples/fullstack-oss)
example: a `notesd` backend that serves a tenant-scoped `Note` resource, and a
`notes-ufe` Angular micro-frontend that lists and creates notes through the
backend's REST gateway.

You will follow one happy path. Alternatives and edge cases live in the
[how-to guides](../../how-to/) and the [reference](../../reference/).

## What you build

- A shell that owns the session, validates nav, and registers a micro-frontend.
- A child micro-frontend that reads the session and calls the backend.

## The shell owns the session

The shell is the host. It is the single-spa root-config in
`frontend/shell/root-config.ts`, served at a stable host by the shell dev server.
It does three things the micro-frontend must never do.

First, it instantiates the [`OidcSessionProvider`](../../reference/oidc/#oidcsessionprovider)
once, from a generic OIDC config, and it completes the browser redirects.

```ts
const session = new OidcSessionProvider({
  authority: environment.oidc.authority,   // any OIDC issuer; Dex in dev
  clientId: environment.oidc.clientId,
  redirectUri: environment.oidc.redirectUri,
  silentRedirectUri: environment.oidc.silentRedirectUri,
  scope: environment.oidc.scope,
});

if (location.pathname === '/callback') {
  await session.completeLoginRedirect();
} else if (location.pathname === '/silent-refresh') {
  await session.completeSilentRedirect();
  return;
}
```

Second, it owns the nav-group taxonomy and validates the micro-frontend's nav
against it, so a wrong group fails loud at startup.

```ts
const groups = staticGroupRegistry([APP_GROUP, 'administration']);
assertNavContributions(notesManifest.navItems, groups);
```

Third, it registers the micro-frontend with
[`createShell`](../../reference/single-spa/#the-shell), which awaits a token
before any micro-frontend mounts, then threads the session in as a prop. The
micro-frontend is selected by a hash route (`#notes`), and its bundle loads from
the CDN through the native browser import map — see
[How micro-frontends load](../../explanation/how-micro-frontends-load/).

```ts
const shell = createShell({
  session,
  apps: [
    {
      name: 'notes-ufe',
      activeWhen: activeOnHash('#notes'),        // hash route, not path route
      load: () => import(/* webpackIgnore: true */ 'notes-ufe'),
    },
  ],
});
await shell.registerAll(); // awaits session.getToken() before mounting
```

The `load` function runs a native dynamic import against the bare specifier
`notes-ufe`. The `<script type="importmap">` in `frontend/shell/index.html`
resolves that specifier to the CDN bundle at `https://cdn.dev.test/notes/main.js`.
The `webpackIgnore` comment keeps the specifier out of the build so the browser's
ESM loader resolves it at runtime instead. Angular's dev server emits ESM
bundles, which the native import map loads directly; the SDK does not use
SystemJS.

{{< callout type="info" >}}
**`registerAll` gates on the token.** By awaiting `session.getToken()` before it
registers the apps, the shell proves it holds a session before a micro-frontend
mounts. A child never has to check whether a session exists. See
[The public seam](../../explanation/the-public-seam/#the-shell-owns-the-session-micro-frontends-never-authenticate).
{{< /callout >}}

## The micro-frontend binds the session into Angular

When single-spa bootstraps the micro-frontend, the shell-owned session arrives on
`props.session`. In `frontend/notes-ufe/src/main.ufe.ts` the micro-frontend binds
it to the [`SESSION_PROVIDER`](../../reference/angular/#wiring-the-session-into-di)
token at the platform level, so Angular DI can supply it anywhere.

```ts
platformBrowserDynamic([
  ...getSingleSpaExtraProviders(),
  // Bridge the shell-owned session into Angular DI.
  { provide: SESSION_PROVIDER, useValue: props.session },
]).bootstrapModule(AppModule);
```

The micro-frontend receives the read-only session view. It never constructs a
session and never imports `OidcSessionProvider`.

## The bearer interceptor attaches the token

The micro-frontend registers `HttpClient` with the
[`bearerAuthInterceptor`](../../reference/angular/#the-bearer-interceptor) in
`frontend/notes-ufe/src/app/app.module.ts`. The interceptor reads the session
from `SESSION_PROVIDER`, attaches `Authorization: Bearer <token>` to every
request, and on a 401 triggers login and retries once.

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bearerAuthInterceptor } from '@infobloxopen/devedge-ufe-angular';

@NgModule({
  providers: [provideHttpClient(withInterceptors([bearerAuthInterceptor]))],
})
export class AppModule {}
```

## Calling the backend

With the interceptor in place, the API service carries no auth code at all. In
`frontend/notes-ufe/src/app/notes.service.ts` it calls the backend's REST
gateway directly.

```ts
@Injectable({ providedIn: 'root' })
export class NotesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.notesApiBaseUrl}/v1/notes`;

  list(): Observable<Note[]> {
    return this.http.get<ListNotesResponse>(this.base).pipe(map((res) => res.notes ?? []));
  }

  create(note: Pick<Note, 'displayName' | 'description'>): Observable<Note> {
    return this.http.post<Note>(this.base, note); // Bearer attached by the interceptor
  }
}
```

The backend is `notesd`, a devedge-sdk service that serves a tenant-scoped `Note`
over a REST gateway on `:8080`. It exposes `GET /v1/notes` and `POST /v1/notes`,
and its authorizer is fail-closed: a request without a valid token is denied.
The bearer token from the shell session is what lets the call through.

## Validating nav at import time

The micro-frontend contributes a nav item in
`frontend/notes-ufe/src/metadata.ts`, and it validates the item against a group
registry when the module is imported. A wrong group throws here, not at runtime.

```ts
const navItems: NavContribution[] = [
  { name: 'Notes-ufe', path: APP_PATH, group: APP_GROUP, type: 'menuItem', weight: 100 },
];

assertNavContributions(navItems, staticGroupRegistry([APP_GROUP]));

export default defineManifest({
  navItems,
  routes: [APP_PATH],
  exports: [{ id: 'notes-ufe', entry: 'main.js', type: 'ufe-application' }],
});
```

See [Why nav validation is loud](../../explanation/why-loud-validation/) for the
bug this prevents.

## Verify the loop

Run the micro-frontend's dev server, then run the diagnostic checklist. It
reports the first step in the load chain that fails.

```sh
cd examples/fullstack-oss/frontend/notes-ufe
pnpm start          # serves on https://localhost:4200
pnpm run doctor     # reachability → cert → CORS → manifest → nav
```

{{< callout type="warning" >}}
**A self-signed dev certificate is the most common silent failure.** A shell that
cannot trust the certificate fails to load the micro-frontend with no visible
error. The `doctor` checklist isolates the certificate as its own step. Trust the
certificate, or serve plain `http` for local development. See
[Diagnose the dev loop](../../how-to/diagnose-the-dev-loop/).
{{< /callout >}}

To run the micro-frontend inside the shell — the shell host, the backend under
`/api`, and the CDN that serves the uFE bundle, all through one edge — bring the
whole topology up with `de project up -f shell.yaml`. See
[Serve the shell and route micro-frontends](../../how-to/serve-the-shell-and-route-microfrontends/).

## What you built

You built a micro-frontend that reads a session it does not own, contributes nav
that is validated before it ships, and calls a devedge-sdk backend with a token
it never manages. The seams are the same in production; you change the OIDC
`authority`, the backend base URL, and the shell, and the micro-frontend code
does not change.

## Next steps

- [Wire the session](../../how-to/wire-the-session/) — the session boundary as a
  standalone recipe.
- [Serve the shell and route micro-frontends](../../how-to/serve-the-shell-and-route-microfrontends/)
  — serve the shell at a stable host and route uFEs through it with
  `de project up -f shell.yaml`.
- [How micro-frontends load](../../explanation/how-micro-frontends-load/) — the
  import map, the CDN, and hash routing, grounded in the shell files.
- [Ship a full-stack feature](https://infobloxopen.github.io/devedge/docs/tutorial/ship-a-full-stack-feature/)
  — the full-stack companion on the devedge platform: build the Go service and
  the micro-frontend together with the `de` CLI.
- [Reference](../../reference/) — the public exports of each package.

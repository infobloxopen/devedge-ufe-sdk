---
title: angular
weight: 40
---

`@infobloxopen/devedge-ufe-angular` is the Angular glue for the
[`SessionProvider`](../core/#session-seam) seam. It provides an injection token
for the shell-owned session, an `EnvironmentProviders` factory that binds it, and
a functional HTTP interceptor that attaches the bearer token. It is plain
TypeScript compiled with `tsc` — no Angular CLI or ng-packagr — and is consumable
across Angular 15 and later.

`@angular/core`, `@angular/common`, and `rxjs` are peer dependencies. Your
application provides them.

Import from `@infobloxopen/devedge-ufe-angular`.

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `SESSION_PROVIDER` | `InjectionToken<SessionProvider>` | DI token for the shell-owned session. |
| `API_ORIGINS` | `InjectionToken<string[]>` | Origins the interceptor may attach the token to. |
| `provideDevedgeSession` | function | Binds a `SessionProvider` to `SESSION_PROVIDER`. |
| `bearerAuthInterceptor` | `HttpInterceptorFn` | Attaches `Authorization: Bearer <token>` to requests. |

## Wiring the session into DI

`provideDevedgeSession` returns `EnvironmentProviders` that bind a
`SessionProvider` to the `SESSION_PROVIDER` token. Pass the shell-owned session.

```ts
const SESSION_PROVIDER: InjectionToken<SessionProvider>;
const API_ORIGINS: InjectionToken<string[]>;

function provideDevedgeSession(sp: SessionProvider): EnvironmentProviders;
```

When single-spa bootstraps a micro-frontend, the shell-owned session arrives as
a prop. Bind it at the platform level:

```ts
{ provide: SESSION_PROVIDER, useValue: props.session }
```

## The bearer interceptor

`bearerAuthInterceptor` is a functional `HttpInterceptorFn`. Register it with
`provideHttpClient(withInterceptors([...]))`. It reads the session from
`SESSION_PROVIDER`, attaches the bearer token to each request, and on a 401
triggers login through the session.

```ts
const bearerAuthInterceptor: HttpInterceptorFn;
```

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

`API_ORIGINS` limits the origins the interceptor will attach a token to, so a
request to a third-party origin does not receive the bearer token.

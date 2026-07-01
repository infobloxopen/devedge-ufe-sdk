# @infobloxopen/devedge-ufe-angular

Angular glue (plain TypeScript, no ng-packagr) for the
[devedge](https://github.com/infobloxopen/devedge-ufe-sdk) `SessionProvider`
seam: an `InjectionToken`, an `EnvironmentProviders` factory, and a functional
HTTP interceptor that attaches the bearer token. Compiles with `tsc` and is
consumable across **Angular 15..latest**.

## Install

```sh
pnpm add @infobloxopen/devedge-ufe-angular @infobloxopen/devedge-ufe-core
# @angular/core, @angular/common, and rxjs are peer dependencies.
```

## Usage

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideDevedgeSession,
  bearerAuthInterceptor,
  API_ORIGINS,
} from '@infobloxopen/devedge-ufe-angular';

bootstrapApplication(App, {
  providers: [
    provideDevedgeSession(session), // the shell-owned SessionProvider
    provideHttpClient(withInterceptors([bearerAuthInterceptor])),
    // Optional: allow the token on extra origins. Defaults to [location.origin],
    // so cross-origin requests never receive the token unless opted in here.
    { provide: API_ORIGINS, useValue: [location.origin, 'https://api.example'] },
  ],
});
```

The interceptor attaches `Authorization: Bearer <token>` only for requests whose
origin is in `API_ORIGINS`; on a 401 it calls `session.login()` and rethrows.

## License

[Apache-2.0](https://github.com/infobloxopen/devedge-ufe-sdk/blob/main/LICENSE).

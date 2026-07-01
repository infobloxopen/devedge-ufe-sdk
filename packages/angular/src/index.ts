/**
 * @infobloxopen/devedge-ufe-angular
 *
 * Angular glue for the core SessionProvider seam — plain TypeScript only (no
 * ng-packagr, no component templates), so it compiles with `tsc` and is
 * consumable across Angular 15..latest. It provides an InjectionToken for the
 * session, an EnvironmentProviders factory, and a functional HTTP interceptor
 * that attaches the Bearer token.
 */
import { InjectionToken, inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import {
  type HttpInterceptorFn,
  type HttpEvent,
} from '@angular/common/http';
import { from, switchMap, Observable } from 'rxjs';
import type { SessionProvider } from '@infobloxopen/devedge-ufe-core';

/** DI token carrying the shell-owned {@link SessionProvider}. */
export const SESSION_PROVIDER = new InjectionToken<SessionProvider>('devedge.ufe.session');

/**
 * The set of origins the bearer token MAY be attached to. Defaults to just the
 * page origin (`location.origin`), so cross-origin requests never receive the
 * token unless the app explicitly opts them in — preventing token leakage to
 * third-party APIs. Override by providing a value for this token.
 */
export const API_ORIGINS = new InjectionToken<string[]>('devedge.ufe.apiOrigins', {
  providedIn: 'root',
  factory: () => (typeof location !== 'undefined' ? [location.origin] : []),
});

/** Registers a {@link SessionProvider} for injection via {@link SESSION_PROVIDER}. */
export function provideDevedgeSession(sp: SessionProvider): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SESSION_PROVIDER, useValue: sp }]);
}

/**
 * Functional HTTP interceptor that attaches `Authorization: Bearer <token>`
 * from the injected {@link SessionProvider}. On a 401 it calls
 * `session.login()` (fire-and-forget) and rethrows so the caller sees the 401.
 * Register via `provideHttpClient(withInterceptors([bearerAuthInterceptor]))`.
 *
 * The token is attached ONLY when the request's resolved origin is in the
 * injected {@link API_ORIGINS} (the page origin by default). Requests to any
 * other origin pass through untouched, so the token cannot leak to a
 * third-party URL.
 */
export const bearerAuthInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const session = inject(SESSION_PROVIDER);
  const apiOrigins = inject(API_ORIGINS);

  if (!isAllowedOrigin(req.url, apiOrigins)) {
    // Cross-origin: never attach the token; forward the request unchanged.
    return next(req);
  }

  return from(session.getToken()).pipe(
    switchMap((token) => {
      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return new Observable<HttpEvent<unknown>>((subscriber) => {
        const sub = next(authReq).subscribe({
          next: (ev) => subscriber.next(ev),
          error: (err: unknown) => {
            if (isUnauthorized(err)) {
              // Re-authenticate; the current request still surfaces the 401.
              void session.login();
            }
            subscriber.error(err);
          },
          complete: () => subscriber.complete(),
        });
        return () => sub.unsubscribe();
      });
    }),
  );
};

/**
 * Resolves `url` against the page origin and returns whether its origin is in
 * `apiOrigins`. Relative URLs resolve to the page origin and are allowed when
 * the page origin is present in `apiOrigins` (the default). Unparseable URLs
 * fail closed (no token).
 */
function isAllowedOrigin(url: string, apiOrigins: string[]): boolean {
  const pageOrigin = typeof location !== 'undefined' ? location.origin : undefined;
  let target: URL;
  try {
    target = new URL(url, pageOrigin);
  } catch {
    return false;
  }
  return apiOrigins.includes(target.origin);
}

function isUnauthorized(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 401;
}

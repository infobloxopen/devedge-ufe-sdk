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

/** Registers a {@link SessionProvider} for injection via {@link SESSION_PROVIDER}. */
export function provideDevedgeSession(sp: SessionProvider): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SESSION_PROVIDER, useValue: sp }]);
}

/**
 * Functional HTTP interceptor that attaches `Authorization: Bearer <token>`
 * from the injected {@link SessionProvider}. On a 401 it calls
 * `session.login()` (fire-and-forget) and rethrows so the caller sees the 401.
 * Register via `provideHttpClient(withInterceptors([bearerAuthInterceptor]))`.
 */
export const bearerAuthInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const session = inject(SESSION_PROVIDER);
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

function isUnauthorized(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 401;
}

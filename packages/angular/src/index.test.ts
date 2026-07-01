import 'zone.js';
import { describe, it, expect, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { of, firstValueFrom } from 'rxjs';
import { SESSION_PROVIDER, bearerAuthInterceptor } from './index.js';
import type { SessionProvider } from '@infobloxopen/devedge-ufe-core';

/** Minimal HttpRequest stand-in: only `clone({ setHeaders })` is exercised. */
function fakeReq() {
  const headers: Record<string, string> = {};
  const req = {
    headers,
    clone(opts: { setHeaders: Record<string, string> }) {
      Object.assign(headers, opts.setHeaders);
      return req;
    },
  };
  return req;
}

function makeInjector(sp: SessionProvider): Injector {
  return Injector.create({ providers: [{ provide: SESSION_PROVIDER, useValue: sp }] });
}

describe('bearerAuthInterceptor', () => {
  it('attaches the Bearer header from the injected SessionProvider', async () => {
    const sp: SessionProvider = {
      getToken: vi.fn(async () => 'my-token'),
      subscribe: () => () => {},
      login: vi.fn(async () => {}),
      logout: async () => {},
    };
    const req = fakeReq();
    const next = vi.fn(() => of({ type: 4 } as never));

    const injector = makeInjector(sp);
    const event$ = runInInjectionContext(injector, () =>
      bearerAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['Authorization']).toBe('Bearer my-token');
    expect(next).toHaveBeenCalledOnce();
    // the request passed to next is the (cloned) authorized request
    expect((next.mock.calls[0][0] as typeof req).headers['Authorization']).toBe(
      'Bearer my-token',
    );
  });
});

import 'zone.js';
import { describe, it, expect, vi } from 'vitest';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  type Provider,
} from '@angular/core';
import { of, firstValueFrom } from 'rxjs';
import {
  SESSION_PROVIDER,
  API_ORIGINS,
  DEV_AUTH_HEADERS,
  bearerAuthInterceptor,
  devAuthInterceptor,
} from './index.js';
import type { SessionProvider } from '@infobloxopen/devedge-ufe-core';

/** Minimal HttpRequest stand-in: `url` + `clone({ setHeaders })`. */
function fakeReq(url: string) {
  const headers: Record<string, string> = {};
  const req = {
    url,
    headers,
    clone(opts: { setHeaders: Record<string, string> }) {
      Object.assign(headers, opts.setHeaders);
      return req;
    },
  };
  return req;
}

/**
 * Runs `fn` inside an Angular injection context built from `providers`.
 * Uses `EnvironmentInjector.runInContext` — available since Angular 15, so it
 * works across the whole 15..latest support range (unlike the Angular-16-only
 * top-level `runInInjectionContext`).
 */
function inContext<T>(providers: Provider[], fn: () => T): T {
  const root = createEnvironmentInjector([], null as unknown as EnvironmentInjector);
  const injector = createEnvironmentInjector(providers, root);
  return injector.runInContext(fn);
}

// jsdom serves the page from http://localhost:3000.
const PAGE_ORIGIN = 'http://localhost:3000';

describe('bearerAuthInterceptor', () => {
  it('attaches the Bearer header for a same-origin request', async () => {
    const sp: SessionProvider = {
      getToken: vi.fn(async () => 'my-token'),
      subscribe: () => () => {},
      login: vi.fn(async () => {}),
      logout: async () => {},
    };
    const req = fakeReq(`${PAGE_ORIGIN}/api/x`);
    const next = vi.fn(() => of({ type: 4 } as never));

    // Provide API_ORIGINS explicitly — in a real bootstrapped app this is the
    // token's providedIn:'root' factory default ([location.origin]).
    const event$ = inContext(
      [
        { provide: SESSION_PROVIDER, useValue: sp },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => bearerAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['Authorization']).toBe('Bearer my-token');
    expect(next).toHaveBeenCalledOnce();
    expect((next.mock.calls[0][0] as typeof req).headers['Authorization']).toBe(
      'Bearer my-token',
    );
  });

  it('attaches the Bearer header for a relative URL (page origin)', async () => {
    const sp: SessionProvider = {
      getToken: vi.fn(async () => 'my-token'),
      subscribe: () => () => {},
      login: vi.fn(async () => {}),
      logout: async () => {},
    };
    const req = fakeReq('/api/x');
    const next = vi.fn(() => of({ type: 4 } as never));

    const event$ = inContext(
      [
        { provide: SESSION_PROVIDER, useValue: sp },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => bearerAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['Authorization']).toBe('Bearer my-token');
  });

  it('leaves a cross-origin request UNTOUCHED (no token, no getToken call)', async () => {
    const sp: SessionProvider = {
      getToken: vi.fn(async () => 'my-token'),
      subscribe: () => () => {},
      login: vi.fn(async () => {}),
      logout: async () => {},
    };
    const req = fakeReq('https://evil.example/steal');
    const next = vi.fn(() => of({ type: 4 } as never));

    const event$ = inContext(
      [
        { provide: SESSION_PROVIDER, useValue: sp },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => bearerAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['Authorization']).toBeUndefined();
    expect(sp.getToken).not.toHaveBeenCalled();
    // The original (unmodified) request is forwarded.
    expect(next.mock.calls[0][0]).toBe(req);
  });

  it('attaches the token to a cross-origin request that is in API_ORIGINS', async () => {
    const sp: SessionProvider = {
      getToken: vi.fn(async () => 'my-token'),
      subscribe: () => () => {},
      login: vi.fn(async () => {}),
      logout: async () => {},
    };
    const req = fakeReq('https://api.example/data');
    const next = vi.fn(() => of({ type: 4 } as never));

    const event$ = inContext(
      [
        { provide: SESSION_PROVIDER, useValue: sp },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN, 'https://api.example'] },
      ],
      () => bearerAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['Authorization']).toBe('Bearer my-token');
  });
});

describe('devAuthInterceptor', () => {
  it('stamps configured dev headers on a same-origin API request', async () => {
    const req = fakeReq(`${PAGE_ORIGIN}/api/x`);
    const next = vi.fn(() => of({ type: 4 } as never));

    const event$ = inContext(
      [
        { provide: DEV_AUTH_HEADERS, useValue: { 'account-id': 't1', groups: 'admin' } },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => devAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['account-id']).toBe('t1');
    expect(req.headers['groups']).toBe('admin');
  });

  it('is a no-op when DEV_AUTH_HEADERS is empty (production default)', async () => {
    const req = fakeReq(`${PAGE_ORIGIN}/api/x`);
    const next = vi.fn(() => of({ type: 4 } as never));

    // Production wires provideDevAuthHeaders({}) (environment.prod.ts), so the
    // token resolves to an empty object and the interceptor forwards untouched.
    const event$ = inContext(
      [
        { provide: DEV_AUTH_HEADERS, useValue: {} },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => devAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['account-id']).toBeUndefined();
    // The original (unmodified) request is forwarded untouched.
    expect(next.mock.calls[0][0]).toBe(req);
  });

  it('never stamps identity on a cross-origin request', async () => {
    const req = fakeReq('https://evil.example/steal');
    const next = vi.fn(() => of({ type: 4 } as never));

    const event$ = inContext(
      [
        { provide: DEV_AUTH_HEADERS, useValue: { 'account-id': 't1' } },
        { provide: API_ORIGINS, useValue: [PAGE_ORIGIN] },
      ],
      () => devAuthInterceptor(req as never, next as never),
    );
    await firstValueFrom(event$);

    expect(req.headers['account-id']).toBeUndefined();
    expect(next.mock.calls[0][0]).toBe(req);
  });
});

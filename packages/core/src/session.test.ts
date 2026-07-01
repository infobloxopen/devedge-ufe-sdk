import { describe, it, expect, vi } from 'vitest';
import {
  createAuthEventBus,
  createAuthedFetch,
  StubSessionProvider,
  type SessionEvent,
  type SessionProvider,
} from './session.js';

describe('createAuthEventBus (window-pinned singleton)', () => {
  it('returns the SAME instance across two calls', () => {
    const a = createAuthEventBus();
    const b = createAuthEventBus();
    expect(a).toBe(b);
  });

  it('delivers events to subscribers and unsubscribes', () => {
    const bus = createAuthEventBus();
    const seen: SessionEvent[] = [];
    const off = bus.subscribe((e) => seen.push(e));
    bus.publish({ type: 'signed_out' });
    off();
    bus.publish({ type: 'token_expired' });
    expect(seen).toEqual([{ type: 'signed_out' }]);
  });
});

function stubProvider(token: string): SessionProvider {
  return {
    getToken: vi.fn(async () => token),
    subscribe: () => () => {},
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  };
}

// jsdom serves tests from http://localhost:3000 — see location.origin below.
const SAME_ORIGIN = 'http://localhost:3000/x';

describe('createAuthedFetch', () => {
  it('attaches Bearer from getToken() for a same-origin URL', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    await f(SAME_ORIGIN);
    const init = base.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer t0k');
  });

  it('attaches Bearer for a relative URL (resolves to page origin)', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    await f('/api/x');
    const headers = new Headers((base.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer t0k');
  });

  it('does NOT attach the token for a cross-origin URL', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    await f('https://evil.example/steal');
    const headers = new Headers((base.mock.calls[0][1] as RequestInit | undefined)?.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(session.getToken).not.toHaveBeenCalled();
  });

  it('attaches the token to a cross-origin URL that is explicitly allowlisted', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch, {
      allowedOrigins: ['https://api.example'],
    });
    await f('https://api.example/data');
    const headers = new Headers((base.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer t0k');
  });

  it('on 401 calls login() then retries ONCE', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const res = await f(SAME_ORIGIN);
    expect(res.status).toBe(200);
    expect(session.login).toHaveBeenCalledOnce();
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once on repeated 401', async () => {
    const base = vi.fn(async () => new Response('no', { status: 401 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const res = await f(SAME_ORIGIN);
    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('retries a POST WITH a body after a 401 without losing the body', async () => {
    const bodies: string[] = [];
    const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // The body arrives via init on the first send and each rebuilt retry.
      bodies.push(String(init?.body));
      return new Response('no', { status: bodies.length === 1 ? 401 : 200 });
    });
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const res = await f(SAME_ORIGIN, {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    // Both the initial send and the retry carried the JSON body.
    expect(bodies).toEqual([
      JSON.stringify({ hello: 'world' }),
      JSON.stringify({ hello: 'world' }),
    ]);
  });

  it('retries a Request-object body after a 401 (clone, not reuse)', async () => {
    const seen: string[] = [];
    const base = vi.fn(async (input: RequestInfo | URL) => {
      const req = input as Request;
      seen.push(await req.text());
      return new Response('r', { status: seen.length === 1 ? 401 : 200 });
    });
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const req = new Request(SAME_ORIGIN, {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await f(req);
    expect(res.status).toBe(200);
    // The single-use body survived the retry because each send clones it.
    expect(seen).toEqual([JSON.stringify({ a: 1 }), JSON.stringify({ a: 1 })]);
  });
});

describe('StubSessionProvider', () => {
  it('warns loudly on construction (dev-only guard)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new StubSessionProvider();
    expect(warn).toHaveBeenCalledWith(
      '[devedge-ufe] StubSessionProvider is for development only and must not be used in production.',
    );
    warn.mockRestore();
  });

  it('returns a fixed token and claims and publishes on the bus', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = createAuthEventBus();
    const seen: SessionEvent[] = [];
    const off = bus.subscribe((e) => seen.push(e));
    const sp = new StubSessionProvider({ token: 'fixed', claims: { sub: 'me' } });
    expect(await sp.getToken()).toBe('fixed');
    expect(await sp.getClaims()).toEqual({ sub: 'me' });
    await sp.login();
    await sp.logout();
    off();
    expect(seen).toEqual([
      { type: 'token_acquired', token: 'fixed', expiresAt: null },
      { type: 'signed_out' },
    ]);
    warn.mockRestore();
  });
});

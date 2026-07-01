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

describe('createAuthedFetch', () => {
  it('attaches Bearer from getToken()', async () => {
    const base = vi.fn(async () => new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    await f('https://api.example/x');
    const init = base.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer t0k');
  });

  it('on 401 calls login() then retries ONCE', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const res = await f('https://api.example/x');
    expect(res.status).toBe(200);
    expect(session.login).toHaveBeenCalledOnce();
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once on repeated 401', async () => {
    const base = vi.fn(async () => new Response('no', { status: 401 }));
    const session = stubProvider('t0k');
    const f = createAuthedFetch(session, base as unknown as typeof fetch);
    const res = await f('https://api.example/x');
    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(2);
  });
});

describe('StubSessionProvider', () => {
  it('returns a fixed token and claims and publishes on the bus', async () => {
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
  });
});

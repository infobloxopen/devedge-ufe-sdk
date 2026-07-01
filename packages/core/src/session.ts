/**
 * F3 — session/identity interfaces + framework-agnostic primitives.
 *
 * The load-bearing architectural rule: the SHELL owns OIDC. Child uFEs NEVER
 * authenticate. They receive a read-only {@link SessionProvider} view and
 * subscribe to a window-pinned auth-event bus. This module carries only the
 * contract + zero-dependency helpers — no `oidc-client-ts`. The concrete OIDC
 * binding lives in `@infobloxopen/devedge-ufe-oidc`.
 */

/** Decoded identity claims. Shape is issuer-specific beyond `sub`. */
export interface Claims {
  sub?: string;
  [k: string]: unknown;
}

/** Events broadcast as the session's token lifecycle advances. */
export type SessionEvent =
  | { type: 'token_acquired'; token: string; expiresAt: number | null }
  | { type: 'token_expired' }
  | { type: 'signed_out' };

/**
 * The read-only session view handed to uFEs. uFEs can read the token, read
 * claims, subscribe to lifecycle events, and request login/logout — but they
 * cannot construct a session or reach the underlying identity provider.
 */
export interface SessionProvider {
  getToken(): Promise<string>;
  getClaims?(): Promise<Claims | null>;
  subscribe(fn: (e: SessionEvent) => void): () => void;
  login(): Promise<void>;
  logout(): Promise<void>;
}

/** A minimal publish/subscribe bus for {@link SessionEvent}s. */
export interface AuthEventBus {
  publish(e: SessionEvent): void;
  subscribe(fn: (e: SessionEvent) => void): () => void;
}

function makeLocalBus(): AuthEventBus {
  const subs = new Set<(e: SessionEvent) => void>();
  return {
    publish(e: SessionEvent): void {
      for (const fn of subs) fn(e);
    },
    subscribe(fn: (e: SessionEvent) => void): () => void {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

/**
 * The global key under which the single shared bus is pinned. Using a
 * `Symbol.for` (registered symbol) guarantees one identity even across
 * multiple bundle copies of this package loaded on the same window.
 */
const BUS_KEY = Symbol.for('devedge.ufe.authEventBus');

interface BusGlobal {
  [BUS_KEY]?: AuthEventBus;
}

/**
 * Returns the process-global auth-event bus, creating it once.
 *
 * MUST be window-pinned: the shell and every uFE bundle copy share ONE bus, so
 * an event published by the shell reaches subscribers in a separately-bundled
 * uFE. Falls back to a module-local bus when no `window`/`globalThis` host
 * object is available (SSR / non-jsdom test).
 */
export function createAuthEventBus(): AuthEventBus {
  const host = (typeof globalThis !== 'undefined' ? globalThis : undefined) as
    | (BusGlobal & typeof globalThis)
    | undefined;
  if (!host) {
    return makeLocalBus();
  }
  if (!host[BUS_KEY]) {
    host[BUS_KEY] = makeLocalBus();
  }
  return host[BUS_KEY]!;
}

/**
 * Wraps `fetch` so requests carry `Authorization: Bearer <token>` from the
 * session. On a 401 it calls `session.login()` then retries the request ONCE;
 * if that retry also 401s it returns the response. Any other status passes
 * through unchanged.
 */
export function createAuthedFetch(
  session: SessionProvider,
  base: typeof fetch = fetch,
): typeof fetch {
  const authed = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const withBearer = async (): Promise<Response> => {
      const token = await session.getToken();
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return base(input, { ...init, headers });
    };

    const res = await withBearer();
    if (res.status !== 401) {
      return res;
    }
    // 401 → re-authenticate and retry exactly once.
    await session.login();
    return withBearer();
  };
  return authed as typeof fetch;
}

/**
 * A no-real-auth session for local development and tests. Returns a fixed
 * token, publishes a `token_acquired` on the shared bus, and no-ops on
 * login/logout. Never use in production.
 */
export class StubSessionProvider implements SessionProvider {
  private readonly token: string;
  private readonly claims: Claims | null;
  private readonly bus: AuthEventBus;

  constructor(opts: { token?: string; claims?: Claims | null } = {}) {
    this.token = opts.token ?? 'dev-stub-token';
    this.claims = opts.claims ?? { sub: 'dev-user' };
    this.bus = createAuthEventBus();
  }

  async getToken(): Promise<string> {
    return this.token;
  }

  async getClaims(): Promise<Claims | null> {
    return this.claims;
  }

  subscribe(fn: (e: SessionEvent) => void): () => void {
    return this.bus.subscribe(fn);
  }

  async login(): Promise<void> {
    this.bus.publish({ type: 'token_acquired', token: this.token, expiresAt: null });
  }

  async logout(): Promise<void> {
    this.bus.publish({ type: 'signed_out' });
  }
}

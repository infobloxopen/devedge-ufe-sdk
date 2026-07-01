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

/** Options for {@link createAuthedFetch}. */
export interface AuthedFetchOptions {
  /**
   * Extra origins (beyond `location.origin`) that MAY receive the bearer
   * token. Each entry is compared against the request's resolved origin.
   */
  allowedOrigins?: string[];
}

/**
 * Resolves `input` to a request URL string, matching `fetch`'s own coercion:
 * a `Request` uses its `.url`; anything else is stringified.
 */
function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  // A Request (or Request-like) object.
  return (input as { url: string }).url;
}

/**
 * Decides whether the bearer token may be attached to a request bound for
 * `resolvedUrl`. Same-origin (which includes relative URLs, since they resolve
 * to the page origin) is always allowed; cross-origin requires an explicit
 * allowlist match. In a non-browser host (no `location`) only an explicit
 * allowlist match qualifies.
 */
function mayAttachToken(urlStr: string, allowedOrigins: string[]): boolean {
  const pageOrigin = typeof location !== 'undefined' ? location.origin : undefined;
  let target: URL;
  try {
    target = new URL(urlStr, pageOrigin);
  } catch {
    // Unparseable target: fail closed — do not attach the token.
    return false;
  }
  if (pageOrigin !== undefined && target.origin === pageOrigin) return true;
  return allowedOrigins.includes(target.origin);
}

/**
 * Wraps `fetch` so requests carry `Authorization: Bearer <token>` from the
 * session. On a 401 it calls `session.login()` then retries the request ONCE;
 * if that retry also 401s it returns the response. Any other status passes
 * through unchanged.
 *
 * @remarks
 * Same-origin by default: the token is attached ONLY when the request's
 * resolved origin equals the page origin (`location.origin`) — relative URLs
 * resolve to the page origin and are therefore safe — or is listed in
 * `opts.allowedOrigins`. This prevents leaking the bearer token to third-party
 * origins. In a non-browser host (no `location`) the token is attached only
 * when an explicit allowlist matches.
 */
export function createAuthedFetch(
  session: SessionProvider,
  base: typeof fetch = fetch,
  opts?: AuthedFetchOptions,
): typeof fetch {
  const allowedOrigins = opts?.allowedOrigins ?? [];
  const authed = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const attach = mayAttachToken(urlFromInput(input), allowedOrigins);

    // Capture the request in a re-constructable form so a 401 retry does not
    // reuse an already-consumed body. A Request body is single-use, so we
    // clone it up front and rebuild a fresh Request for each send.
    const template = input instanceof Request ? input : undefined;

    const send = async (): Promise<Response> => {
      if (!attach) {
        return template ? base(template.clone()) : base(input, init);
      }
      const token = await session.getToken();
      if (template) {
        const req = template.clone();
        const headers = new Headers(req.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return base(new Request(req, { headers }));
      }
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return base(input, { ...init, headers });
    };

    const res = await send();
    if (res.status !== 401) {
      return res;
    }
    // 401 → re-authenticate and retry exactly once.
    await session.login();
    return send();
  };
  return authed as typeof fetch;
}

/**
 * A no-real-auth session for local development and tests. Returns a fixed
 * token, publishes a `token_acquired` on the shared bus, and no-ops on
 * login/logout.
 *
 * @remarks
 * DEVELOPMENT ONLY. This provider performs NO authentication and MUST NOT be
 * used in production. Constructing it emits a `console.warn` so an accidental
 * production bundle surfaces the misuse loudly (it stays functional and does
 * not throw).
 */
export class StubSessionProvider implements SessionProvider {
  private readonly token: string;
  private readonly claims: Claims | null;
  private readonly bus: AuthEventBus;

  constructor(opts: { token?: string; claims?: Claims | null } = {}) {
    console.warn(
      '[devedge-ufe] StubSessionProvider is for development only and must not be used in production.',
    );
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

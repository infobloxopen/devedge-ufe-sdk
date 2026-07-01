/**
 * @infobloxopen/devedge-ufe-oidc
 *
 * A generic OIDC binding for the core {@link SessionProvider} seam, built on
 * `oidc-client-ts` (authorization-code + PKCE). The issuer is generic (Dex in
 * dev, any OIDC provider in prod) — no identity provider is hardwired here.
 * A provider-specific binding (e.g. for Okta, Auth0, or Keycloak) is a separate
 * private package that merely supplies the `authority`/`audience`, the same way
 * a private authorizer binds to authz.Authorizer.
 */
import {
  UserManager,
  WebStorageStateStore,
  InMemoryWebStorage,
  type User,
} from 'oidc-client-ts';
import {
  createAuthEventBus,
  type AuthEventBus,
  type Claims,
  type SessionEvent,
  type SessionProvider,
} from '@infobloxopen/devedge-ufe-core';

/** Generic OIDC configuration. No provider-specific fields. */
export interface OidcConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  silentRedirectUri?: string;
  scope?: string;
  audience?: string;
  /**
   * Where OIDC state (including tokens) is persisted.
   *
   * - `'localStorage'` (default): survives full-page reloads and is shared
   *   across tabs, but is readable by any script on the origin — an XSS
   *   payload can exfiltrate the token. This preserves the historical
   *   behavior.
   * - `'memory'`: keeps tokens in a per-page in-memory store. It is not
   *   reachable by unrelated script contexts and is cleared on reload, which
   *   narrows the XSS blast radius at the cost of re-authenticating after a
   *   hard reload.
   *
   * See the package README for the full tradeoff.
   */
  stateStore?: 'localStorage' | 'memory';
}

const DEFAULT_SCOPE = 'openid profile email offline_access';

/** How near expiry (seconds) `getToken` proactively refreshes. */
const REFRESH_SKEW_SECONDS = 30;

/**
 * A {@link SessionProvider} backed by `oidc-client-ts`'s `UserManager`.
 *
 * The shell owns exactly one of these. It republishes UserManager events onto
 * the window-pinned core auth-event bus so every uFE bundle copy sees the same
 * token lifecycle.
 */
export class OidcSessionProvider implements SessionProvider {
  private readonly mgr: UserManager;
  private readonly bus: AuthEventBus;
  /**
   * The in-flight silent-refresh promise, shared by concurrent `getToken`
   * callers so only ONE `signinSilent` runs at a time. Cleared when it settles.
   */
  private refreshInFlight: Promise<User | null> | null = null;

  constructor(config: OidcConfig, bus: AuthEventBus = createAuthEventBus()) {
    this.bus = bus;
    const store =
      config.stateStore === 'memory' ? new InMemoryWebStorage() : localStorage;
    this.mgr = new UserManager({
      authority: config.authority,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      silent_redirect_uri: config.silentRedirectUri,
      response_type: 'code',
      scope: config.scope ?? DEFAULT_SCOPE,
      extraQueryParams: config.audience ? { audience: config.audience } : undefined,
      automaticSilentRenew: true,
      loadUserInfo: false,
      monitorSession: false,
      userStore: new WebStorageStateStore({ store }),
    });

    this.mgr.events.addUserLoaded((user: User) => {
      this.bus.publish({
        type: 'token_acquired',
        token: user.access_token,
        expiresAt: user.expires_at ?? null,
      });
    });
    this.mgr.events.addAccessTokenExpired(() => {
      this.bus.publish({ type: 'token_expired' });
    });
    this.mgr.events.addUserSignedOut(() => {
      this.bus.publish({ type: 'signed_out' });
    });
  }

  /**
   * Returns a current access token, refreshing when near/after expiry:
   * silent renew first, falling back to an interactive redirect.
   */
  async getToken(): Promise<string> {
    let user = await this.mgr.getUser();
    if (user && this.isFresh(user)) {
      return user.access_token;
    }
    // Concurrent callers share ONE silent refresh: the first starts it, the
    // rest await the same promise. Cleared on settle so the next expiry can
    // trigger a fresh refresh.
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.mgr.signinSilent().catch(() => null);
      this.refreshInFlight.finally(() => {
        this.refreshInFlight = null;
      });
    }
    try {
      user = await this.refreshInFlight;
    } catch {
      user = null;
    }
    if (user && this.isFresh(user)) {
      return user.access_token;
    }
    await this.mgr.signinRedirect();
    // signinRedirect navigates away; this is unreachable in a browser.
    throw new Error('[devedge-ufe-oidc] interactive login required');
  }

  async getClaims(): Promise<Claims | null> {
    const user = await this.mgr.getUser();
    return (user?.profile as Claims | undefined) ?? null;
  }

  subscribe(fn: (e: SessionEvent) => void): () => void {
    return this.bus.subscribe(fn);
  }

  async login(): Promise<void> {
    await this.mgr.signinRedirect();
  }

  async logout(): Promise<void> {
    await this.mgr.signoutRedirect();
  }

  /** Completes the authorization-code redirect on the `/callback` route. */
  async completeLoginRedirect(): Promise<User> {
    return this.mgr.signinRedirectCallback();
  }

  /** Completes the silent-renew redirect on the `/silent-refresh` route. */
  async completeSilentRedirect(): Promise<void> {
    await this.mgr.signinSilentCallback();
  }

  private isFresh(user: User): boolean {
    if (user.expires_at == null) return !!user.access_token;
    const now = Math.floor(Date.now() / 1000);
    return !!user.access_token && user.expires_at - REFRESH_SKEW_SECONDS > now;
  }
}

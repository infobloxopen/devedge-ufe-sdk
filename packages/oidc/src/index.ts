/**
 * @infobloxopen/devedge-ufe-oidc
 *
 * A generic OIDC binding for the core {@link SessionProvider} seam, built on
 * `oidc-client-ts` (authorization-code + PKCE). The issuer is generic (Dex in
 * dev, any OIDC provider in prod) — Okta is intentionally NOT hardwired here.
 * An Infoblox/Okta binding is a separate private package that merely supplies
 * Okta's `authority`/`audience`, mirroring opaauthz → authz.Authorizer.
 */
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
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

  constructor(config: OidcConfig, bus: AuthEventBus = createAuthEventBus()) {
    this.bus = bus;
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
      userStore: new WebStorageStateStore({ store: localStorage }),
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
    try {
      user = await this.mgr.signinSilent();
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

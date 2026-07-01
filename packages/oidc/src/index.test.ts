import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the settings passed to UserManager and expose event registrars.
const captured: { settings?: Record<string, unknown> } = {};
const handlers: Record<string, (arg?: unknown) => void> = {};

vi.mock('oidc-client-ts', () => {
  class WebStorageStateStore {
    constructor(public opts: unknown) {}
  }
  class UserManager {
    events = {
      addUserLoaded: (fn: (u: unknown) => void) => (handlers.userLoaded = fn),
      addAccessTokenExpired: (fn: () => void) => (handlers.expired = fn),
      addUserSignedOut: (fn: () => void) => (handlers.signedOut = fn),
    };
    constructor(settings: Record<string, unknown>) {
      captured.settings = settings;
    }
    getUser = vi.fn(async () => null);
    signinSilent = vi.fn(async () => null);
    signinRedirect = vi.fn(async () => {});
    signoutRedirect = vi.fn(async () => {});
  }
  return { UserManager, WebStorageStateStore };
});

import { OidcSessionProvider, type OidcConfig } from './index.js';
import { createAuthEventBus, type SessionEvent } from '@infobloxopen/devedge-ufe-core';

const cfg: OidcConfig = {
  authority: 'https://issuer.example/realms/dev',
  clientId: 'ufe-shell',
  redirectUri: 'https://app.example/callback',
  silentRedirectUri: 'https://app.example/silent-refresh',
  audience: 'api://devedge',
};

beforeEach(() => {
  captured.settings = undefined;
  for (const k of Object.keys(handlers)) delete handlers[k];
});

describe('OidcSessionProvider → UserManager settings mapping', () => {
  it('maps OidcConfig to the expected UserManager settings', () => {
    new OidcSessionProvider(cfg);
    const s = captured.settings!;
    expect(s.authority).toBe(cfg.authority);
    expect(s.client_id).toBe(cfg.clientId);
    expect(s.redirect_uri).toBe(cfg.redirectUri);
    expect(s.silent_redirect_uri).toBe(cfg.silentRedirectUri);
    expect(s.response_type).toBe('code');
    expect(s.scope).toBe('openid profile email offline_access');
    expect(s.automaticSilentRenew).toBe(true);
    expect(s.loadUserInfo).toBe(false);
    expect(s.monitorSession).toBe(false);
    expect(s.extraQueryParams).toEqual({ audience: 'api://devedge' });
  });

  it('honors a custom scope', () => {
    new OidcSessionProvider({ ...cfg, scope: 'openid custom' });
    expect(captured.settings!.scope).toBe('openid custom');
  });
});

describe('republishes UserManager events onto the core bus', () => {
  it('token_acquired / token_expired / signed_out', () => {
    const bus = createAuthEventBus();
    const seen: SessionEvent[] = [];
    const off = bus.subscribe((e) => seen.push(e));
    new OidcSessionProvider(cfg, bus);

    handlers.userLoaded({ access_token: 'abc', expires_at: 1234 });
    handlers.expired();
    handlers.signedOut();
    off();

    expect(seen).toEqual([
      { type: 'token_acquired', token: 'abc', expiresAt: 1234 },
      { type: 'token_expired' },
      { type: 'signed_out' },
    ]);
  });
});

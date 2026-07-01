/**
 * Dev environment for the Notes uFE (OSS flavor).
 *
 * Two things are configured here and nowhere else:
 *
 *  1. `oidc` — a GENERIC OIDC client config consumed by the standalone shell
 *     (see `src/shell/main.ts`). The default `authority` points at a local Dex
 *     issuer; point it at ANY OIDC provider by changing `authority`/`clientId`.
 *     Nothing here is provider-specific — no named provider, no proprietary
 *     fields. A product-specific flavor binds these values in a private extension.
 *
 *  2. `notesApiBaseUrl` — the base URL of the notesd backend's REST gateway.
 *     The Angular NotesApiService (src/app/notes.service.ts) prefixes every
 *     request with this, and the shell-owned bearer token is attached by the
 *     open-core `bearerAuthInterceptor`.
 */
export const environment = {
  production: false,

  /** Generic OIDC config. Point `authority` at any OIDC issuer. */
  oidc: {
    authority: 'http://localhost:5556/dex',
    clientId: 'notes-ufe-shell',
    redirectUri: 'http://localhost:9000/callback',
    silentRedirectUri: 'http://localhost:9000/silent-refresh',
    scope: 'openid profile email offline_access',
  },

  /** Base URL of the notesd REST gateway (see the backend README). */
  notesApiBaseUrl: 'http://localhost:8080',
};

/**
 * Production environment for the Notes uFE.
 *
 * These values are placeholders: in production the shell (not this uFE) owns
 * the OIDC session, and the backend base URL is injected at deploy time. See
 * the example README section "Run against a real OIDC issuer + real backend".
 */
export const environment = {
  production: true,

  oidc: {
    authority: 'https://issuer.example.com',
    clientId: 'notes-ufe-shell',
    redirectUri: 'https://app.example.com/callback',
    silentRedirectUri: 'https://app.example.com/silent-refresh',
    scope: 'openid profile email offline_access',
  },

  notesApiBaseUrl: '/api',
};

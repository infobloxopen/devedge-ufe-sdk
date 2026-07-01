# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## 0.1.0

Initial open-core release of the devedge micro-frontend SDK — a mechanism-only,
Infoblox-proprietary-free core, the frontend mirror of `devedge-sdk`.

### Added

- **`@infobloxopen/devedge-ufe-core`** (zero runtime deps)
  - F1 app-lifecycle contract: `MicrofrontendDescriptor`, `HostProps`,
    `MicrofrontendModule`.
  - F2 nav contribution + loud validation: `NavContribution`, `NavItemType`,
    `GroupRegistry`, `staticGroupRegistry`, `validateNavContribution`,
    `assertNavContributions`. Unknown or unvalidatable nav groups now fail loud
    (throw / warn) instead of silently rendering nothing.
  - F3 session seam + primitives: `SessionProvider`, `SessionEvent`, `Claims`,
    `AuthEventBus`, window-pinned `createAuthEventBus`, `createAuthedFetch`
    (Bearer + 401→login→retry-once), and `StubSessionProvider`.
  - F5 manifest contract: `UfeManifest`, `UfeExport`, `DeployableArtifact`,
    `defineManifest`.
- **`@infobloxopen/devedge-ufe-oidc`** — generic OIDC (auth-code + PKCE)
  `OidcSessionProvider` over `oidc-client-ts`. Provider-agnostic; no Okta.
- **`@infobloxopen/devedge-ufe-single-spa`** — `toSingleSpaLifecycles` adapter
  and `createShell` (shell-owns-session registration).
- **`@infobloxopen/devedge-ufe-angular`** — `SESSION_PROVIDER`,
  `provideDevedgeSession`, and the functional `bearerAuthInterceptor` (plain TS,
  Angular 15..latest).
- **`@infobloxopen/devedge-ufe-dev-loop`** — ordered silent-failure `diagnose`
  (reachability → TLS → CORS → manifest → nav groups), the `override` import-map
  helper, and the `devedge-ufe doctor` CLI.

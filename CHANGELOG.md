# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## 0.1.3

- **`@infobloxopen/devedge-ufe-angular`** gains a dev-only metadata-auth interceptor for local
  development: `devAuthInterceptor`, `provideDevAuthHeaders()`, and the `DEV_AUTH_HEADERS` injection
  token. It stamps `account-id`/`groups` request headers on allowed origins so a generated client can
  round-trip against the devedge dev authorizer (which reads raw metadata, not a bearer subject). It is
  a no-op when no headers are configured, and production continues to use real OIDC; the `de ufe new`
  scaffold wires it into the dev environment. This closes the third surface (uFE) of the CLI/Terraform
  local-dev auth gap. (#22, #23)

## 0.1.2

Documentation and packaging pass — no runtime code changes.

- Reworded the README, package docs, examples, and the `@infobloxopen/devedge-ufe-oidc`
  package description to be provider- and vendor-neutral: identity providers
  (Okta, Auth0, Keycloak) are now named only as *generic* examples, and the
  open-core/private-binding governance story is told without naming any
  proprietary implementation — mirroring how `devedge-sdk` describes its seams.

## 0.1.1

Hardening and publish-readiness (#3): origin-scoped bearer tokens in
`createAuthedFetch` / `bearerAuthInterceptor`, safe 401→login→retry, `getToken`
in-flight de-duplication, a `createShell` session-override guard, a loud
`StubSessionProvider`, and an optional in-memory OIDC token store. Packages
publish to GitHub Packages via the built-in `GITHUB_TOKEN` — no external secret.

## 0.1.0

Initial open-core release of the devedge micro-frontend SDK — a mechanism-only
core with no proprietary dependencies, the frontend mirror of `devedge-sdk`.

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
  `OidcSessionProvider` over `oidc-client-ts`. Provider-agnostic; no identity
  provider hardwired.
- **`@infobloxopen/devedge-ufe-single-spa`** — `toSingleSpaLifecycles` adapter
  and `createShell` (shell-owns-session registration).
- **`@infobloxopen/devedge-ufe-angular`** — `SESSION_PROVIDER`,
  `provideDevedgeSession`, and the functional `bearerAuthInterceptor` (plain TS,
  Angular 15..latest).
- **`@infobloxopen/devedge-ufe-dev-loop`** — ordered silent-failure `diagnose`
  (reachability → TLS → CORS → manifest → nav groups), the `override` import-map
  helper, and the `devedge-ufe doctor` CLI.

# Security

## Reporting

Report suspected vulnerabilities via a private security advisory on
[the repository](https://github.com/infobloxopen/devedge-ufe-sdk/security/advisories),
not a public issue.

## Runtime posture

- **Token scoping.** The bearer token is attached **same-origin by default** —
  in `createAuthedFetch` (core) and `bearerAuthInterceptor` (angular). It is
  never sent to a third-party origin unless that origin is explicitly
  allowlisted (`allowedOrigins` / `API_ORIGINS`).
- **Token storage.** The OIDC binding defaults to `localStorage` but supports
  `stateStore: 'memory'` to narrow the XSS blast radius. See the OIDC package
  README for the tradeoff.
- **Dev-only auth.** `StubSessionProvider` performs no authentication and warns
  loudly on construction; it must never ship to production.

## Dependency advisories

Direct dev/test dependencies (`vitest`, and the `vite`/`esbuild` it pulls) are
kept current so their advisories are cleared.

The remaining advisories originate **transitively** from the pinned Angular 15
dev tree (`@angular/core`, `@angular/common`, `@angular/compiler` at
`15.2.x` — and historically related tooling deps such as `dompurify` /
`d3-color` that ride along with an Angular 15 toolchain). These are **not
directly controllable** from this repository: the versions are constrained by
`@angular/*@15.2.x`, kept as **dev/test-only** dependencies for typecheck and
the vitest environment so the package stays compatible across the documented
Angular 15..latest support range (the published `@infobloxopen/devedge-ufe-angular`
depends on Angular only as a peer, `>=15`). None is reachable in this SDK's
published runtime code — the SDK runtime packages ship no such dependency, and
consumers resolve Angular themselves. They are tracked here and will be picked
up as the support range advances.

The pnpm install prints no `Ignored build scripts` notice: `esbuild`'s build
script is approved via `pnpm.onlyBuiltDependencies` in the root `package.json`
(benign — `esbuild` is only a transitive test dependency and is never run as a
bundler here).

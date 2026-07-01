---
title: Reference
weight: 40
---

The public exports of each SDK package. Each page leads with what the package is,
then lists its exports in a table — symbol, kind, and a one-line summary — and
gives signatures for the load-bearing symbols. The reader here is looking
something up, not reading a narrative.

The SDK is five packages. Every symbol below is exported from the package's
entry point (`@infobloxopen/devedge-ufe-<name>`).

{{< cards >}}
  {{< card link="core/" title="core" subtitle="The mechanism-only contract: lifecycle, nav validation, session seam, manifest." >}}
  {{< card link="oidc/" title="oidc" subtitle="A generic OIDC session provider over oidc-client-ts." >}}
  {{< card link="single-spa/" title="single-spa" subtitle="The single-spa lifecycle adapter and createShell." >}}
  {{< card link="angular/" title="angular" subtitle="Angular glue: the session token, provider, and bearer interceptor." >}}
  {{< card link="dev-loop/" title="dev-loop" subtitle="The diagnose checklist, import-map override, and doctor CLI." >}}
{{< /cards >}}

## Package overview

| Package | Purpose | Runtime dependencies |
|---|---|---|
| [`@infobloxopen/devedge-ufe-core`](core/) | Lifecycle, nav-group validation, session seam, manifest. | none |
| [`@infobloxopen/devedge-ufe-oidc`](oidc/) | Generic OIDC session provider. | `oidc-client-ts` |
| [`@infobloxopen/devedge-ufe-single-spa`](single-spa/) | single-spa adapter and `createShell`. | `single-spa` |
| [`@infobloxopen/devedge-ufe-angular`](angular/) | Angular session token, provider, and bearer interceptor. | peer `@angular/*`, `rxjs` |
| [`@infobloxopen/devedge-ufe-dev-loop`](dev-loop/) | `diagnose`, import-map override, `devedge-ufe doctor`. | `import-map-overrides` |

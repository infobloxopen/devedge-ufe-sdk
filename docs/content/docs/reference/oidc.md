---
title: oidc
weight: 20
---

`@infobloxopen/devedge-ufe-oidc` is a generic OIDC session provider that binds
to the [`SessionProvider`](../core/#session-seam) seam. It implements the
authorization code flow with PKCE over
[`oidc-client-ts`](https://github.com/authts/oidc-client-ts). The issuer is
generic: any OIDC provider works, and no identity provider is named or hardwired
here.

Use this package in the shell, which owns the session. A micro-frontend never
constructs a provider — it receives the read-only `SessionProvider` view.

Import from `@infobloxopen/devedge-ufe-oidc`.

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `OidcConfig` | interface | Configuration for the provider: authority, client, redirect URIs. |
| `OidcSessionProvider` | class | A `SessionProvider` backed by an OIDC authorization-code + PKCE flow. |

## OidcConfig

```ts
interface OidcConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  silentRedirectUri?: string;
  scope?: string;
  audience?: string;
  stateStore?: 'localStorage' | 'memory';
}
```

`authority` is the OIDC issuer URL. A provider-specific binding supplies the
`authority` and `audience`; the SDK does not hardcode either.

## OidcSessionProvider

`OidcSessionProvider` implements [`SessionProvider`](../core/#session-seam) and
adds two methods the shell calls to finish a browser redirect.

```ts
class OidcSessionProvider implements SessionProvider {
  constructor(config: OidcConfig, bus?: AuthEventBus);

  getToken(): Promise<string>;
  getClaims(): Promise<Claims | null>;
  subscribe(fn: (e: SessionEvent) => void): () => void;
  login(): Promise<void>;
  logout(): Promise<void>;

  completeLoginRedirect(): Promise<User>;
  completeSilentRedirect(): Promise<void>;
}
```

- `completeLoginRedirect` finishes the authorization-code redirect on the
  configured `redirectUri` route and returns the signed-in user.
- `completeSilentRedirect` finishes a silent token renewal on the configured
  `silentRedirectUri` route.

The optional `bus` is an [`AuthEventBus`](../core/#auth-primitives); when
provided, the provider publishes `SessionEvent`s to it.

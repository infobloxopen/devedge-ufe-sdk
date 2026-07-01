# @infobloxopen/devedge-ufe-oidc

Generic OIDC (authorization-code + PKCE) binding for the
[devedge](https://github.com/infobloxopen/devedge-ufe-sdk) `SessionProvider`
seam, built on [`oidc-client-ts`](https://github.com/authts/oidc-client-ts). The
issuer is generic (Dex in dev, any OIDC provider in prod) — **Okta is not
hardwired**; an Infoblox/Okta binding is a separate private package that only
supplies the `authority`/`audience`.

## Install

```sh
pnpm add @infobloxopen/devedge-ufe-oidc @infobloxopen/devedge-ufe-core
```

## Usage

The shell owns exactly one `OidcSessionProvider` and threads it to every uFE.

```ts
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';

const session = new OidcSessionProvider({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: 'ufe-shell',
  redirectUri: `${location.origin}/callback`,
  silentRedirectUri: `${location.origin}/silent-refresh`,
  audience: import.meta.env.VITE_OIDC_AUDIENCE, // optional
  stateStore: 'localStorage', // or 'memory' — see the tradeoff below
});
```

Concurrent `getToken()` calls share a single in-flight silent refresh.

## Token storage & the XSS tradeoff

`stateStore` selects where OIDC state (including tokens) is persisted:

- **`'localStorage'` (default)** — survives full-page reloads and is shared
  across tabs, but is readable by any script on the origin, so an XSS payload
  can exfiltrate the token. This preserves the historical behavior.
- **`'memory'`** — keeps tokens in a per-page in-memory store
  (`InMemoryWebStorage`). Not reachable by unrelated script contexts and cleared
  on reload, which narrows the XSS blast radius at the cost of re-authenticating
  after a hard reload.

Neither option removes the need to prevent XSS in the first place; `'memory'`
only reduces the impact if one occurs.

## License

[Apache-2.0](https://github.com/infobloxopen/devedge-ufe-sdk/blob/main/LICENSE).

# @infobloxopen/devedge-ufe-core

Mechanism-only micro-frontend contract for [devedge](https://github.com/infobloxopen/devedge-ufe-sdk):
lifecycle types, **loud** nav-group validation, the read-only `SessionProvider`
session seam plus framework-agnostic auth primitives, and manifest types. Zero
runtime dependencies, nothing Infoblox-specific.

## Install

```sh
pnpm add @infobloxopen/devedge-ufe-core
```

## Usage

```ts
import {
  assertNavContributions,
  staticGroupRegistry,
  createAuthedFetch,
  type HostProps,
} from '@infobloxopen/devedge-ufe-core';

// A wrong nav group fails LOUD (names the bad value + the valid groups),
// instead of silently rendering nothing.
const groups = staticGroupRegistry(['manage', 'monitor']);
assertNavContributions(navItems, groups);

// Attaches `Authorization: Bearer <token>` — same-origin only by default, so
// the token never leaks to a third-party URL. Allow extra origins explicitly.
export async function mount({ session }: HostProps) {
  const api = createAuthedFetch(session, fetch, { allowedOrigins: ['https://api.example'] });
  await api('/api/v1/widgets');
}
```

See the [repo README](https://github.com/infobloxopen/devedge-ufe-sdk#readme) for
the full architecture.

## License

[Apache-2.0](https://github.com/infobloxopen/devedge-ufe-sdk/blob/main/LICENSE).

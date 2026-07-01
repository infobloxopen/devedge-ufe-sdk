---
title: core
weight: 10
---

`@infobloxopen/devedge-ufe-core` is the mechanism-only contract for a devedge
micro-frontend. It defines the lifecycle types, the loud nav-group validation,
the read-only session seam and its auth primitives, and the manifest types. It
has no runtime dependencies and nothing product-specific.

Import from `@infobloxopen/devedge-ufe-core`.

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `MicrofrontendDescriptor` | interface | Identifies a micro-frontend: an `id` and an `entry`. |
| `HostProps` | interface | The props a host passes to a micro-frontend; carries the `session`. |
| `MicrofrontendModule` | interface | The lifecycle contract: `bootstrap`, `mount`, `unmount`. |
| `NavItemType` | type | The allowed nav-item shapes (`menuItem`, `tab`, and others). |
| `NavContribution` | interface | A nav item a micro-frontend contributes, including its `group`. |
| `GroupRegistry` | interface | The set of valid nav groups; `known()` and `has()`. |
| `staticGroupRegistry` | function | Builds a `GroupRegistry` from a fixed list of groups. |
| `validateNavContribution` | function | Validates one contribution against a registry; returns a result. |
| `assertNavContributions` | function | Validates many contributions; throws on the first invalid group. |
| `Claims` | interface | Token claims; `sub` and arbitrary fields. |
| `SessionEvent` | type | An auth event: token acquired, token expired, or signed out. |
| `SessionProvider` | interface | The read-only session seam a micro-frontend consumes. |
| `AuthEventBus` | interface | Publishes and subscribes to `SessionEvent`s. |
| `createAuthEventBus` | function | Builds an in-memory `AuthEventBus`. |
| `AuthedFetchOptions` | interface | Options for `createAuthedFetch`, including `allowedOrigins`. |
| `createAuthedFetch` | function | Wraps `fetch` to attach the bearer token and retry once on 401. |
| `StubSessionProvider` | class | A `SessionProvider` with a fixed token, for tests. |
| `UfeExport` | interface | An entry a micro-frontend exports, such as a `ufe-application`. |
| `UfeManifest` | interface | The manifest: nav items, routes, and exports. |
| `defineManifest` | function | Validates a manifest shape at import time and returns it. |

## Lifecycle

A micro-frontend is a `MicrofrontendModule`. The host drives it through three
methods, passing `HostProps` to each.

```ts
interface MicrofrontendDescriptor {
  id: string;
  entry: string;
}

interface HostProps {
  session: SessionProvider;
  [k: string]: unknown;
}

interface MicrofrontendModule {
  descriptor: MicrofrontendDescriptor;
  bootstrap(props: HostProps): Promise<void>;
  mount(props: HostProps): Promise<void>;
  unmount(props: HostProps): Promise<void>;
}
```

## Nav validation

A `NavContribution` names the `group` it belongs to. A `GroupRegistry` holds the
set of valid groups. Validation checks the contribution's group against the
registry.

```ts
type NavItemType =
  | 'menuItem' | 'tabParent' | 'tab' | 'tabButton'
  | 'tabLink' | 'headerMenu' | 'dropdownTab';

interface NavContribution {
  name: string;
  path: string;
  group: string;
  type: NavItemType;
  weight?: number;
  access?: unknown;
}

interface GroupRegistry {
  known(): readonly string[];
  has(group: string): boolean;
}

function staticGroupRegistry(groups: readonly string[]): GroupRegistry;
function validateNavContribution(
  c: NavContribution, reg: GroupRegistry, opts?: NavValidationOptions,
): NavValidationResult;
function assertNavContributions(
  cs: NavContribution[], reg: GroupRegistry, opts?: NavValidationOptions,
): void;
```

`assertNavContributions` throws on the first contribution whose group is not in
the registry, and the error names the unknown group and the valid ones. See
[Why nav validation is loud](../../explanation/why-loud-validation/) for the
reasoning.

## Session seam

`SessionProvider` is the read-only view a micro-frontend receives. It can read
the token and claims, subscribe to auth events, and request login or logout. It
cannot construct a session.

```ts
interface Claims {
  sub?: string;
  [k: string]: unknown;
}

type SessionEvent =
  | { type: 'token_acquired'; token: string; expiresAt: number | null }
  | { type: 'token_expired' }
  | { type: 'signed_out' };

interface SessionProvider {
  getToken(): Promise<string>;
  getClaims?(): Promise<Claims | null>;
  subscribe(fn: (e: SessionEvent) => void): () => void;
  login(): Promise<void>;
  logout(): Promise<void>;
}
```

## Auth primitives

`createAuthedFetch` wraps a `fetch` implementation so that every request carries
the bearer token from the session. On a 401 it triggers login and retries the
request once.

```ts
interface AuthedFetchOptions {
  allowedOrigins?: string[];
}

function createAuthedFetch(
  session: SessionProvider,
  base?: typeof fetch,
  opts?: AuthedFetchOptions,
): typeof fetch;

interface AuthEventBus {
  publish(e: SessionEvent): void;
  subscribe(fn: (e: SessionEvent) => void): () => void;
}
function createAuthEventBus(): AuthEventBus;
```

`StubSessionProvider` is a `SessionProvider` implementation with a fixed token
and claims, for use in tests.

```ts
class StubSessionProvider implements SessionProvider {
  constructor(opts?: { token?: string; claims?: Claims | null });
}
```

## Manifest

`defineManifest` validates a manifest's shape when the module is imported, so a
malformed manifest fails at import or build time instead of at runtime.

```ts
interface UfeExport {
  id: string;
  entry: string;
  type: 'ufe-application' | string;
}

interface UfeManifest {
  navItems: NavContribution[];
  routes: string[];
  exports: UfeExport[];
  searchObjects?: unknown[];
}

function defineManifest(m: UfeManifest): UfeManifest;
```

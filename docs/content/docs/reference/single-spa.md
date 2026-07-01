---
title: single-spa
weight: 30
---

`@infobloxopen/devedge-ufe-single-spa` adapts the
[`MicrofrontendModule`](../core/#lifecycle) contract to
[single-spa](https://single-spa.js.org/) lifecycles, and provides `createShell`,
the shell-owns-session registration mechanism. The shell instantiates a
[`SessionProvider`](../core/#session-seam) once, gates registration on
`await session.getToken()`, and threads the session to every micro-frontend as a
single-spa custom prop.

A caller's `customProps.session` can never override the shell session; the shell
supplies it.

Import from `@infobloxopen/devedge-ufe-single-spa`.

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `SingleSpaLifecycles` | interface | The `bootstrap`, `mount`, `unmount` functions single-spa expects. |
| `toSingleSpaLifecycles` | function | Adapts a `MicrofrontendModule` to `SingleSpaLifecycles`. |
| `ShellApp` | interface | A micro-frontend the shell registers: `name`, `activeWhen`, `load`. |
| `ShellOptions` | interface | Options for `createShell`: the `session` and the `apps`. |
| `Shell` | interface | The shell handle; `registerAll()` mounts the apps. |
| `createShell` | function | Builds a shell that owns the session and gates registration. |

## Adapting a module

`toSingleSpaLifecycles` turns a `MicrofrontendModule` into the lifecycle object
single-spa registers.

```ts
interface SingleSpaLifecycles {
  bootstrap: LifeCycleFn<HostProps>;
  mount: LifeCycleFn<HostProps>;
  unmount: LifeCycleFn<HostProps>;
}

function toSingleSpaLifecycles(
  m: MicrofrontendModule, props: HostProps,
): SingleSpaLifecycles;
```

## The shell

`createShell` builds a shell around a shell-owned `SessionProvider`. Each
`ShellApp` declares when it is active and how to load its lifecycles.
`registerAll` awaits `session.getToken()` before it registers any app, which
proves the shell holds a session before a micro-frontend mounts.

```ts
interface ShellApp {
  name: string;
  activeWhen:
    | string
    | ((location: Location) => boolean)
    | Array<string | ((location: Location) => boolean)>;
  load: () => Promise<SingleSpaLifecycles> | SingleSpaLifecycles;
}

interface ShellOptions {
  session: SessionProvider;
  apps: ShellApp[];
  customProps?: Record<string, unknown>;
}

interface Shell {
  registerAll(): Promise<void>;
}

function createShell(opts: ShellOptions): Shell;
```

{{< callout type="info" >}}
**`registerAll` gates on the token.** It calls `await session.getToken()` before
registering the apps, so a micro-frontend never mounts without a session behind
it. See [The public seam](../../explanation/the-public-seam/#the-shell-owns-the-session-micro-frontends-never-authenticate).
{{< /callout >}}

## Activating and loading an app

Each `ShellApp` declares two things: when it is active (`activeWhen`) and how to
load its lifecycles (`load`). The full-stack example activates on a hash route
and loads through the native browser import map.

`activeWhen` takes a predicate over `location`. The example activates the app on
a hash route so the edge never sees the uFE surface — single-spa reads
`location.hash`, not the path.

```ts
function activeOnHash(route: string): (location: Location) => boolean {
  return (location) =>
    location.hash === route || location.hash.startsWith(`${route}/`);
}
```

`load` returns the app's single-spa lifecycles. The example runs a native dynamic
import against a bare specifier that the shell's `<script type="importmap">`
resolves to a CDN bundle. The `webpackIgnore` comment keeps the specifier out of
the build so the browser's ESM loader resolves it at runtime.

```ts
function loadMfe(spec: string): Promise<SingleSpaLifecycles> {
  return import(/* webpackIgnore: true */ spec) as Promise<SingleSpaLifecycles>;
}

const shell = createShell({
  session,
  apps: [
    { name: 'notes-ufe', activeWhen: activeOnHash('#notes'), load: () => loadMfe('notes-ufe') },
  ],
});
await shell.registerAll();
```

The SDK does not use SystemJS. Angular's dev server emits ESM bundles, which the
native import map loads directly. For the full loading model — the import map,
the CDN, and hash routing — see
[How micro-frontends load](../../explanation/how-micro-frontends-load/).

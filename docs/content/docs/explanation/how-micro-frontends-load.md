---
title: How micro-frontends load
weight: 30
---

A micro-frontend on this SDK is a JavaScript bundle the browser fetches at
runtime and mounts into a shell. This page explains how that bundle is
addressed, fetched, and activated: the shell served at a stable host, a native
browser import map that points bare specifiers at a CDN, and hash routing that
selects which micro-frontend mounts. Read it when you want to understand the
loading path before you serve a shell or debug why a micro-frontend does not
appear.

The model has four parts that fit together: the shell, the import map, the CDN,
and hash routing. The full-stack example wires all four in
[`examples/fullstack-oss`](https://github.com/infobloxopen/devedge-ufe-sdk/tree/main/examples/fullstack-oss);
the files named below are the ground truth.

## The shell is served at a stable host

The shell is the single-spa root-config in `frontend/shell/root-config.ts`,
loaded by the browser from a fixed host — `notesapp.dev.test` in the example.
The shell owns the page: it renders the chrome, instantiates the session, and
registers each micro-frontend. Every path on the shell host that is not the
backend prefix is served by the shell.

The root-config's job at load time is to register the micro-frontends and start
single-spa. It does not fetch any micro-frontend bundle itself; it declares, for
each app, when the app is active and how to load it.

## A native import map maps specifiers to CDN URLs

The shell's `frontend/shell/index.html` carries a native browser import map. The
import map maps each micro-frontend's bare specifier to the URL of its bundle on
the CDN.

```html
<script type="importmap">
  {
    "imports": {
      "notes-ufe": "https://cdn.dev.test/notes/main.js"
    }
  }
</script>
```

When the root-config loads a micro-frontend, it runs a native dynamic import
against that bare specifier, and the import map resolves it to the CDN URL.

```ts
function loadMfe(spec: string): Promise<SingleSpaLifecycles> {
  return import(/* webpackIgnore: true */ spec) as Promise<SingleSpaLifecycles>;
}
```

The `webpackIgnore` comment keeps the specifier out of the build. Without it,
webpack would try to resolve `notes-ufe` at build time and bundle it. With it,
the specifier is left alone, so the browser's ESM loader resolves it at runtime
through the import map.

{{< callout type="info" >}}
**The SDK loads bundles with a native import, not SystemJS.** Angular's dev
server emits ESM bundles. The native browser import map feeds each bare specifier
straight into the browser's ESM loader, which loads those bundles directly. An
earlier SystemJS path could not, because a SystemJS loader expects
SystemJS-format bundles, which `ng serve` does not emit.
{{< /callout >}}

## Bundles come from a simulated CDN

The bundle URLs in the import map point at a CDN host — `cdn.dev.test` in the
example. In development that host is simulated: `de project up -f shell.yaml`
routes each `cdn.dev.test/<route>/` path to the corresponding micro-frontend's
dev server. So `https://cdn.dev.test/notes/main.js` is served, at develop time,
by the `notes-ufe` dev server on `:4200`.

The CDN host and the micro-frontend routes come from the `shell.yaml` topology,
so the import map in `index.html` and the routes the edge serves stay in step. In
production the same import map points at a real CDN; the shell code does not
change.

## Hash routing selects the active micro-frontend

The shell selects which micro-frontend mounts by the URL hash, not the path. Each
app declares an `activeWhen` predicate over `location.hash`.

```ts
function activeOnHash(route: string): (location: Location) => boolean {
  return (location) =>
    location.hash === route || location.hash.startsWith(`${route}/`);
}
```

The notes micro-frontend mounts at `#notes` and its sub-paths (`#notes/123`).
Because single-spa reads `location.hash`, navigating between micro-frontends
changes only the hash. The browser does not make a new request to the edge, and
the edge never sees the micro-frontend surface — it serves the shell host and the
CDN paths, and the hash routing happens entirely in the browser. A micro-frontend
therefore needs no edge route of its own; only its CDN asset path is routed.

## Overriding the import map in development

To run a local build of one micro-frontend inside an otherwise deployed shell,
override its import-map entry. The
[dev-loop `override`](../../reference/dev-loop/#import-map-override) helper writes
an override to `localStorage` (through `import-map-overrides`) and reloads, so the
one specifier you name resolves to your dev-server URL while every other
micro-frontend still loads from the CDN. See
[Diagnose the dev loop](../../how-to/diagnose-the-dev-loop/) for when to reach for
this.

## The session gates the load

Loading is the second half of the story; the first half is the session. Before
any micro-frontend bundle mounts, the shell proves it holds a session. The
root-config instantiates the [`OidcSessionProvider`](../../reference/oidc/#oidcsessionprovider)
once and passes it to [`createShell`](../../reference/single-spa/#the-shell),
whose `registerAll` awaits `session.getToken()` before it registers the apps. A
micro-frontend never fetches, mounts, or authenticates on its own; it receives
the read-only session view the shell threads in as a prop. See
[The public seam](../the-public-seam/#the-shell-owns-the-session-micro-frontends-never-authenticate).

## See also

- [Serve the shell and route micro-frontends](../../how-to/serve-the-shell-and-route-microfrontends/)
  — bring the topology up with `de project up -f shell.yaml`.
- [Reference: single-spa](../../reference/single-spa/) — `createShell`,
  `activeWhen`, and `load`.
- [The public seam](../the-public-seam/) — why the shell owns the session and the
  micro-frontend never does.

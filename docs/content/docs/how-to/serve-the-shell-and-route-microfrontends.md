---
title: Serve the shell and route micro-frontends
weight: 40
---

This guide serves the shell at a stable host and routes one or more
micro-frontends through it, so the shell, the backend, and the micro-frontend
bundles all reach the browser through one edge. You describe the topology once in
a `shell.yaml` file and bring it up with `de project up -f shell.yaml`; the CLI
renders the edge routes and starts the pieces the same way it does for every
other kind.

Use this when you want to run a micro-frontend the way the browser will see it in
production — served from a shell host, with bundles from a CDN and the backend
under a stable prefix — rather than hitting a bare dev server.

## Goal

- The shell is served at a stable host.
- Each micro-frontend's bundle is served from a CDN path.
- The backend is reachable at a stable prefix.
- Each micro-frontend is selected in the browser by a hash route.

## Prerequisites

- The [`de` CLI](https://infobloxopen.github.io/devedge/), which renders the
  topology and brings it up.
- A shell whose `index.html` import map and root-config match the topology — the
  full-stack example ships one in
  [`examples/fullstack-oss`](https://github.com/infobloxopen/devedge-ufe-sdk/tree/main/examples/fullstack-oss).
- A running shell dev server, backend, and one micro-frontend dev server for the
  topology to route to.

## The topology

A `shell.yaml` file describes the shell topology with `kind: Shell`. It names the
shell host, the shell upstream, the CDN host, the backend, and the
micro-frontends composed into the shell. The full-stack example's file is the
worked reference:

```yaml
apiVersion: devedge.infoblox.dev/v1alpha1
kind: Shell
metadata:
  name: notesapp
spec:
  host: notesapp.dev.test              # the shell FQDN
  shellUpstream: http://127.0.0.1:9000 # where the shell is served
  cdn:
    host: cdn.dev.test                 # serves uFE bundles
  api:
    method: 1                          # backend fronted same-origin under /api
    prefix: /api
    upstream: http://127.0.0.1:8080
  ufes:
    - id: notes-ufe                    # import-map specifier / single-spa app name
      route: notes                     # hash route (#notes) and CDN path segment (/notes/)
      upstream: http://127.0.0.1:4200  # the uFE dev server
```

Each field maps to one part of the [loading
model](../../explanation/how-micro-frontends-load/):

- `host` is the shell FQDN. The browser loads the root-config here, and every
  non-backend path on this host is served by the shell.
- `cdn.host` is the host the import map points its bundle URLs at. A uFE with
  `route: notes` is served at `https://cdn.dev.test/notes/main.js`, which is the
  same URL the shell's `<script type="importmap">` maps `notes-ufe` to.
- `ufes[].route` is both the hash route the uFE mounts at (`#notes`) and the CDN
  path segment (`/notes/`). The uFE needs no edge route of its own — hash routing
  keeps its surface in the browser — only its CDN asset path is routed.

## Steps

### 1. Choose how the backend is fronted

The `api.method` field selects one of two topologies for the backend.

**Method 1 — single origin (the default).** The shell host fronts everything on
one origin:

- `<host>/` serves the shell.
- `<host>/api` proxies the backend, with the prefix stripped
  (`/api/v1/notes` → `/v1/notes`).
- `<host>/#<ufe>` selects a micro-frontend by hash route.
- `cdn.dev.test/<route>` serves each micro-frontend bundle.

Method 1 matches a micro-frontend whose API base URL shares the shell's origin.
The bearer interceptor and the SPA make same-origin calls to `/api`, so there is
no cross-origin request to the backend.

**Method 2 — per-service API FQDNs.** Each backend service is fronted at its own
FQDN rather than under the shell's `/api` prefix. Use Method 2 when services are
addressed independently — for example when a micro-frontend calls several
backends, each with its own host — rather than through one same-origin prefix.
Set `api.method: 2` and give each service its FQDN.

### 2. Bring the topology up

Render the routes and start the pieces:

```sh
de project up -f shell.yaml
```

The CLI renders `shell.yaml` into edge routes and brings them up through the same
path every other kind uses. It routes the shell host to the shell upstream, the
`/api` prefix to the backend, and each `cdn.dev.test/<route>/` path to the
matching micro-frontend upstream.

### 3. Add a micro-frontend to the roster

`de ufe new` scaffolds a micro-frontend and adds it to the shell roster: it
writes an import-map entry for the new specifier and a hash route for it. You do
not edit the import map or the routes by hand — adding the uFE to the roster
keeps `index.html`, the root-config, and the topology in step.

{{< callout type="info" >}}
**The default shell host is `app.dev.test`.** A new topology uses `app.dev.test`
as the shell FQDN. The full-stack example overrides it to `notesapp.dev.test`,
and the Infoblox-CTO preset uses `csp.dev.test`. Set `spec.host` to the host you
want the shell served at.
{{< /callout >}}

## Verify

Open the shell host in a browser. The shell chrome loads, and navigating to a
micro-frontend's hash route (`<host>/#notes`) mounts that micro-frontend without
a full page load. The micro-frontend's calls to `<host>/api` reach the backend,
and its bundle loads from `cdn.dev.test/<route>/`. If nothing appears, run the
[dev-loop doctor](../diagnose-the-dev-loop/) to name the failing step.

## See also

- [How micro-frontends load](../../explanation/how-micro-frontends-load/) — the
  import map, the CDN, and hash routing the topology sets up.
- [Diagnose the dev loop](../diagnose-the-dev-loop/) — name the first failing step
  when a micro-frontend does not appear.
- [Ship a full-stack feature](https://infobloxopen.github.io/devedge/docs/tutorial/ship-a-full-stack-feature/)
  — the devedge platform tutorial that builds the Go service and the
  micro-frontend together with the `de` CLI.

---
title: Diagnose the dev loop
weight: 30
---

This guide diagnoses a micro-frontend that will not load locally. It runs an
ordered checklist that isolates the first failing step — reachability, TLS,
CORS, manifest, or nav groups — so a silent failure becomes a named one. Use it
when a micro-frontend shows nothing and no error points at the cause.

## Goal

- Find the one step in the load chain that is failing.
- Get an actionable message for that step.

## Prerequisites

- `@infobloxopen/devedge-ufe-dev-loop`.
- A dev server running your micro-frontend, and its URL.

## Steps

### 1. Run the doctor CLI

The package's binary is `devedge-ufe`. Point it at the dev server, the app id,
and the metadata file.

```sh
npx devedge-ufe doctor --url https://localhost:4200 --app widgets --metadata metadata.js
```

The checklist runs in order and stops at the first failure, because each step
depends on the earlier ones. It reports which step failed and why.

### 2. Read the failed step

The report names the failing step:

- **Reachability** — the dev server is not answering at the URL.
- **TLS** — the certificate is not trusted, so the browser refuses the module.
- **CORS** — the response is missing `access-control-allow-origin`, so a
  cross-origin load is blocked.
- **Manifest** — the metadata or manifest file is missing or returns a non-200
  status.
- **Nav groups** — a nav contribution names a group that is not in the registry.

### 3. Diagnose programmatically (optional)

Call [`diagnose`](../../reference/dev-loop/#the-checklist) directly to get the
structured result, for example from a test or a script.

```ts
import { diagnose } from '@infobloxopen/devedge-ufe-dev-loop';

const result = await diagnose({
  devServerUrl: 'https://localhost:4200',
  appId: 'widgets',
  metadataFile: 'metadata.js',
});

if (!result.ok) {
  console.error(result.failedStep, result.message);
}
```

## Verify

Fix the reported step and run the checklist again. When every step passes,
`diagnose` returns `ok: true` and the micro-frontend loads in the shell.

{{< callout type="info" >}}
**Override the import map to run a local build inside a deployed shell.** Use
[`override`](../../reference/dev-loop/#import-map-override) to point an app's
import-map entry at your dev-server URL and reload.
{{< /callout >}}

## See also

- [Reference: dev-loop](../../reference/dev-loop/) — `diagnose`, `override`, and
  the CLI.
- [How micro-frontends load](../../explanation/how-micro-frontends-load/) — where
  the import-map override fits in the loading model.
- [Serve the shell and route micro-frontends](../serve-the-shell-and-route-microfrontends/)
  — bring the whole topology up with `de project up -f shell.yaml`.
- [Why nav validation is loud](../../explanation/why-loud-validation/) — the nav
  step, in depth.

---
title: dev-loop
weight: 50
---

`@infobloxopen/devedge-ufe-dev-loop` diagnoses a micro-frontend that fails to
load. It runs an ordered checklist — reachability, TLS, CORS, manifest, nav
groups — and reports the first step that fails with an actionable message,
turning a silent "the micro-frontend just doesn't show up" into a loud result.
It also ships an import-map override helper and the `devedge-ufe doctor` CLI.

Import the programmatic API from `@infobloxopen/devedge-ufe-dev-loop`; run the
checklist from the shell with the `devedge-ufe` binary.

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `diagnose` | function | Runs the ordered silent-failure checklist and returns a result. |
| `DiagnoseOptions` | interface | Inputs to `diagnose`: the dev-server URL, app id, and checks. |
| `DiagnoseResult` | interface | The checklist outcome: overall `ok`, the failed step, and steps. |
| `DiagnoseStep` | interface | One step's result: `name`, `ok`, and an optional `detail`. |
| `override` | function | Writes an import-map override to `localStorage` and reloads. |

## The checklist

`diagnose` runs its steps in order and stops at the first failure, because a
later step depends on the earlier ones passing. The steps are: reachability,
TLS, CORS, manifest, and nav-group validation.

```ts
interface DiagnoseStep {
  name: string;
  ok: boolean;
  detail?: string;
}

interface DiagnoseResult {
  ok: boolean;
  failedStep?: string;
  message?: string;
  steps: DiagnoseStep[];
}

interface DiagnoseOptions {
  devServerUrl: string;
  appId: string;
  metadataFile?: string;
  registry?: GroupRegistry;
  navItems?: NavContribution[];
  fetchImpl?: typeof fetch;
}

function diagnose(o: DiagnoseOptions): Promise<DiagnoseResult>;
```

## Import-map override

`override` points an app's import-map entry at a local URL and reloads the page,
so you can run a micro-frontend from your dev server inside a deployed shell.

```ts
function override(appId: string, url: string, ns?: string): void;
```

## The doctor CLI

The package's `bin` is `devedge-ufe`. Run the checklist against a dev server:

```sh
npx devedge-ufe doctor --url https://localhost:4200 --app widgets --metadata metadata.js
```

See [Diagnose the dev loop](../../how-to/diagnose-the-dev-loop/) for the task
recipe.

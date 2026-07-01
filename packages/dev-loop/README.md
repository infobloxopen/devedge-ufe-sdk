# @infobloxopen/devedge-ufe-dev-loop

Dev-loop diagnostics for [devedge](https://github.com/infobloxopen/devedge-ufe-sdk)
micro-frontends: an ordered **silent-failure checklist** (reachability, TLS,
CORS, manifest, nav groups) that turns the usual "the uFE just doesn't show up"
mystery into a loud, actionable report — plus an import-map override helper and
the `devedge-ufe doctor` CLI.

## Install

```sh
pnpm add -D @infobloxopen/devedge-ufe-dev-loop
```

## CLI

```sh
# Runs each check in order and stops at the first failure with a clear message.
npx devedge-ufe doctor --url https://localhost:4200 --app widgets --metadata metadata.js
```

## Programmatic

```ts
import { diagnose, override } from '@infobloxopen/devedge-ufe-dev-loop';

const result = await diagnose({ devServerUrl: 'https://localhost:4200', appId: 'widgets' });
if (!result.ok) console.error(`failed at ${result.failedStep}: ${result.message}`);

// Point an import-map entry at a local dev bundle and reload.
override('widgets', 'https://localhost:4200/widgets.js');
```

## License

[Apache-2.0](https://github.com/infobloxopen/devedge-ufe-sdk/blob/main/LICENSE).

# @infobloxopen/devedge-ufe-single-spa

[single-spa](https://single-spa.js.org/) adapter for the
[devedge](https://github.com/infobloxopen/devedge-ufe-sdk) lifecycle contract,
plus the **shell-owns-session** registration mechanism: the shell instantiates
the `SessionProvider` once, gates registration on `await session.getToken()`,
and threads the session to every uFE as a single-spa custom prop. A caller
`customProps.session` can never override the shell session.

## Install

```sh
pnpm add @infobloxopen/devedge-ufe-single-spa @infobloxopen/devedge-ufe-core single-spa
```

## Usage

```ts
import { createShell } from '@infobloxopen/devedge-ufe-single-spa';

const shell = createShell({
  session, // the shell-owned SessionProvider, instantiated ONCE
  apps: [
    { name: 'widgets', activeWhen: '/widgets', load: () => import('widgets') },
  ],
});

// Awaits getToken() FIRST — proving the shell holds a session — then registers
// each app with `session` as a custom prop. uFEs never authenticate.
await shell.registerAll();
```

`toSingleSpaLifecycles(module, props)` adapts a core `MicrofrontendModule` to
single-spa `bootstrap`/`mount`/`unmount`.

## License

[Apache-2.0](https://github.com/infobloxopen/devedge-ufe-sdk/blob/main/LICENSE).

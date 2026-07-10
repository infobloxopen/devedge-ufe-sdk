/**
 * The single-spa root-config for the full-stack example (WS-018 Phase D).
 *
 * This is the SHELL. In production a real host owns this file; it lives in the
 * example so the topology is coherent end-to-end and shows exactly where the
 * shell-owns-session boundary sits.
 *
 * What the shell does — and what a uFE MUST NOT do:
 *   1. Instantiates the OidcSessionProvider ONCE (generic OIDC; Dex in dev, any
 *      OIDC issuer in prod). A uFE never constructs a session.
 *   2. Owns the nav-group taxonomy: it builds a GroupRegistry and asserts every
 *      uFE's nav contributions against it, so a wrong group fails LOUD at
 *      startup instead of silently rendering nothing.
 *   3. Registers each uFE via `createShell`, which gates registration on
 *      `await session.getToken()` — proving the shell holds a session before any
 *      uFE mounts — then threads `session` into each uFE as a HostProp.
 *
 * uFE selection is by HASH route: `#notes` mounts notes-ufe (see `activeOnHash`).
 * The uFE JS bundle loads via the native browser importmap in index.html — the
 * bare specifier `notes-ufe` resolves to https://cdn.dev.test/notes/main.js. We
 * load it with `import(/* webpackIgnore: true *​/ spec)` so the browser's ESM
 * loader fetches Angular's ESM bundle at runtime; SystemJS could not, because
 * ng-serve emits ESM, not SystemJS-format bundles.
 */
// The shell/host loads zone.js ONCE for the whole page. Angular uFEs need a
// global Zone; in a micro-frontend it must be loaded by the host (not bundled
// per-uFE, which risks multiple Zone instances). The uFE build keeps zone.js in
// a separate `polyfills.js` entry that the native-import loader does not fetch,
// so the host supplies it here — before any uFE bootstraps.
import 'zone.js';

import { start } from 'single-spa';
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';
import {
  createShell,
  type SingleSpaLifecycles,
} from '@infobloxopen/devedge-ufe-single-spa';
import {
  StubSessionProvider,
  type SessionProvider,
  staticGroupRegistry,
  assertNavContributions,
} from '@infobloxopen/devedge-ufe-core';

import { environment } from '../notes-ufe/src/environments/environment';
import notesManifest, { APP_GROUP } from '../notes-ufe/src/metadata';

/** The hash route the notes uFE mounts at (matches shell.yaml ufes[0].route). */
const NOTES_HASH = '#notes';

/**
 * Builds a single-spa `activeWhen` predicate for a hash route. The uFE is active
 * when the URL hash is exactly the route or a sub-path of it (`#notes`,
 * `#notes/123`) — this is HASH routing, not path routing: single-spa reads
 * `location.hash`, so the edge never sees the uFE surface.
 */
function activeOnHash(route: string): (location: Location) => boolean {
  return (location: Location) =>
    location.hash === route || location.hash.startsWith(`${route}/`);
}

/**
 * Native dynamic import against the bare specifier, resolved by the
 * <script type="importmap"> in index.html. `import(/* webpackIgnore: true *​/ …)`
 * keeps webpack from bundling the specifier at build time, so the import goes
 * through the runtime importmap to the CDN bundle. Mirrors the POC's loadMfe.
 *
 * The uFE builds a webpack UMD bundle (`library:'notes-ufe'`,
 * `libraryTarget:'umd'`), so a native `import()` yields an empty ESM namespace
 * and the single-spa lifecycles land on `globalThis['notes-ufe']`. We therefore
 * check, in order: the module's own `mount` (native ESM), a `default.mount`
 * (interop default), then `globalThis[globalName]` (the UMD global).
 */
async function loadMfe(spec: string, globalName: string): Promise<SingleSpaLifecycles> {
  const mod = (await import(/* webpackIgnore: true */ spec)) as Record<string, unknown>;
  const g = globalThis as Record<string, unknown>;
  const cand =
    typeof (mod as { mount?: unknown }).mount === 'function' ? mod
    : (mod as { default?: { mount?: unknown } }).default && typeof (mod as { default?: { mount?: unknown } }).default!.mount === 'function' ? (mod as { default: unknown }).default
    : g[globalName];
  const lc = cand as SingleSpaLifecycles | undefined;
  if (!lc || typeof lc.mount !== 'function') {
    throw new Error(`uFE "${spec}": no single-spa lifecycles found (checked ESM exports and globalThis["${globalName}"] — bundle library target?)`);
  }
  return lc;
}

/** Boots the shell: owns OIDC, validates nav, registers the uFE(s), starts. */
export async function bootShell(): Promise<void> {
  // 1. The shell owns the session — instantiated exactly ONCE. The provider is
  //    chosen by `environment.useDevSession`: a no-auth StubSessionProvider so
  //    the shell renders locally without an OIDC issuer, or the generic
  //    OidcSessionProvider (point `authority` at any issuer). A uFE never
  //    constructs a session either way.
  let session: SessionProvider;
  if (environment.useDevSession) {
    session = new StubSessionProvider();
  } else {
    const oidc = new OidcSessionProvider({
      authority: environment.oidc.authority,
      clientId: environment.oidc.clientId,
      redirectUri: environment.oidc.redirectUri,
      silentRedirectUri: environment.oidc.silentRedirectUri,
      scope: environment.oidc.scope,
    });
    // Complete the auth-code / silent-renew redirects on their dedicated paths.
    // These are OIDC redirect endpoints (path-based), independent of the uFE
    // hash routing above.
    if (location.pathname === '/callback') {
      await oidc.completeLoginRedirect();
      history.replaceState(null, '', `/${NOTES_HASH}`);
    } else if (location.pathname === '/silent-refresh') {
      await oidc.completeSilentRedirect();
      return;
    }
    session = oidc;
  }

  // 2. The host owns the nav-group taxonomy. The notes uFE's default group is
  //    APP_GROUP; a wrong group throws here (loud), not renders nothing.
  const groups = staticGroupRegistry([APP_GROUP, 'administration']);
  assertNavContributions(notesManifest.navItems, groups);

  // 3. Register the uFE. createShell awaits getToken() FIRST (proves the shell
  //    holds a session) and threads `session` into the uFE as a HostProp. The
  //    uFE is selected by HASH route and loaded via the native importmap.
  const shell = createShell({
    session,
    apps: [
      {
        name: 'notes-ufe',
        activeWhen: activeOnHash(NOTES_HASH),
        load: () => loadMfe('notes-ufe', 'notes-ufe'),
      },
    ],
  });
  await shell.registerAll();

  // Start single-spa. Registration already happened; start() begins reacting to
  // route (hash) changes and mounts the active uFE.
  start();
}

void bootShell();

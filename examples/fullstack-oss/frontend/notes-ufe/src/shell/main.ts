/**
 * A tiny standalone SHELL for the full-stack example.
 *
 * In production a real host (the product's shell) owns this. It is included
 * here so the example is coherent end-to-end: it shows exactly where the
 * shell-owns-session boundary lives.
 *
 * What the shell does — and what a uFE MUST NOT do:
 *   1. Instantiates the OidcSessionProvider ONCE (generic OIDC; issuer is Dex
 *      in dev, any OIDC provider in prod). The uFE never constructs a session.
 *   2. Owns the group taxonomy: it builds a GroupRegistry and asserts every
 *      uFE's nav contributions against it, so a wrong group fails LOUD at
 *      startup instead of silently rendering nothing.
 *   3. Registers each uFE with `createShell`, which gates registration on
 *      `await session.getToken()` — proving the shell holds a session before
 *      any uFE mounts — then threads `session` into each uFE as HostProps.
 *
 * The uFE is selected by HASH route (`#notes`) and loaded via a NATIVE dynamic
 * import of the bare specifier, resolved by the browser's importmap — NOT
 * SystemJS, which cannot load Angular's ESM bundle. The runnable root-config in
 * ../../../shell (its own index.html + native importmap) is the deployable twin
 * of this file; both share the same hash-routing + native-import model.
 *
 * This file is not part of the deployed uFE bundle; it documents the contract
 * the host fulfills. See the example README, "How the shell owns the session".
 */
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';
import {
  createShell,
  type SingleSpaLifecycles,
} from '@infobloxopen/devedge-ufe-single-spa';
import {
  staticGroupRegistry,
  assertNavContributions,
} from '@infobloxopen/devedge-ufe-core';

import { environment } from '../environments/environment';
import notesManifest, { APP_GROUP } from '../metadata';

/**
 * The hash route the notes uFE mounts at (`<host>/#notes`). The runnable shell
 * lives at ../../../shell (a native-importmap root-config); this file is the
 * in-src twin that shares the same hash-routing + native-import model.
 */
const NOTES_HASH = '#notes';

/**
 * Builds a single-spa `activeWhen` predicate for a HASH route: the uFE is active
 * when `location.hash` is exactly the route or a sub-path of it (`#notes`,
 * `#notes/123`). This is hash routing, not path routing — single-spa reads the
 * hash, so the uFE surface never reaches the edge.
 */
function activeOnHash(route: string): (location: Location) => boolean {
  return (location: Location) =>
    location.hash === route || location.hash.startsWith(`${route}/`);
}

/**
 * Native dynamic import of a bare specifier, resolved by the browser's importmap
 * at runtime. Taking `spec` as a parameter (not a string literal) also keeps the
 * bundler from resolving it at build time, alongside the `webpackIgnore` hint.
 */
function loadMfe(spec: string): Promise<SingleSpaLifecycles> {
  return import(/* webpackIgnore: true */ spec) as Promise<SingleSpaLifecycles>;
}

/**
 * Boots the shell: owns OIDC, validates the notes uFE's nav, and registers it.
 * Call this from the host page's entry script.
 */
export async function bootShell(): Promise<void> {
  // 1. The shell owns the session — instantiated exactly ONCE. Generic OIDC:
  //    point `authority` at any issuer (Dex in dev). No provider-specific code.
  const session = new OidcSessionProvider({
    authority: environment.oidc.authority,
    clientId: environment.oidc.clientId,
    redirectUri: environment.oidc.redirectUri,
    silentRedirectUri: environment.oidc.silentRedirectUri,
    scope: environment.oidc.scope,
  });

  // Complete the auth-code / silent-renew redirects on their dedicated paths.
  // These are OIDC redirect endpoints (path-based) and are independent of the
  // uFE HASH routing below.
  if (location.pathname === '/callback') {
    await session.completeLoginRedirect();
    history.replaceState(null, '', `/${NOTES_HASH}`);
  } else if (location.pathname === '/silent-refresh') {
    await session.completeSilentRedirect();
    return;
  }

  // 2. The host owns the nav group taxonomy. The notes uFE's default group is
  //    APP_GROUP; a wrong group would throw here (loud), not render nothing.
  const groups = staticGroupRegistry([APP_GROUP, 'administration']);
  assertNavContributions(notesManifest.navItems, groups);

  // 3. Register the uFE. createShell awaits getToken() FIRST (proves the shell
  //    holds a session) and threads `session` into the uFE as a HostProp.
  const shell = createShell({
    session,
    apps: [
      {
        name: 'notes-ufe',
        // HASH routing: the uFE mounts when the URL hash is #notes (or a
        // sub-path). NOT path routing.
        activeWhen: activeOnHash(NOTES_HASH),
        // Load the uFE's single-spa lifecycles via a NATIVE dynamic import of
        // the bare specifier. The browser's <script type="importmap"> resolves
        // `notes-ufe` to the CDN bundle (https://cdn.dev.test/notes/main.js in
        // this example), and `import(/* webpackIgnore: true *​/ …)` keeps
        // webpack from bundling the specifier so the fetch happens at runtime.
        // This replaces the earlier `System.import`, which could not load
        // Angular's ESM bundle (ng-serve emits ESM, not SystemJS format).
        load: () => loadMfe('notes-ufe'),
      },
    ],
  });
  await shell.registerAll();
}

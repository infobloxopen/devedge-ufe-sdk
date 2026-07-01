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
import { start } from 'single-spa';
import { OidcSessionProvider } from '@infobloxopen/devedge-ufe-oidc';
import {
  createShell,
  type SingleSpaLifecycles,
} from '@infobloxopen/devedge-ufe-single-spa';
import {
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
 * The uFE's main.ufe.ts exports the three single-spa lifecycle FUNCTIONS, so we
 * type the module as SingleSpaLifecycles (single-spa's own LifeCycles also
 * allows arrays; the cast pins it to the function form createShell expects).
 */
function loadMfe(spec: string): Promise<SingleSpaLifecycles> {
  return import(/* webpackIgnore: true */ spec) as Promise<SingleSpaLifecycles>;
}

/** Boots the shell: owns OIDC, validates nav, registers the uFE(s), starts. */
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
  // These are OIDC redirect endpoints (path-based), independent of the uFE hash
  // routing above.
  if (location.pathname === '/callback') {
    await session.completeLoginRedirect();
    history.replaceState(null, '', `/${NOTES_HASH}`);
  } else if (location.pathname === '/silent-refresh') {
    await session.completeSilentRedirect();
    return;
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
        load: () => loadMfe('notes-ufe'),
      },
    ],
  });
  await shell.registerAll();

  // Start single-spa. Registration already happened; start() begins reacting to
  // route (hash) changes and mounts the active uFE.
  start();
}

void bootShell();

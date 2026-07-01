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
import notesManifest, { APP_GROUP, APP_PATH } from '../metadata';

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

  // Complete the auth-code / silent-renew redirects on their routes.
  if (location.pathname === '/callback') {
    await session.completeLoginRedirect();
    history.replaceState(null, '', APP_PATH);
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
        activeWhen: APP_PATH,
        // The uFE's single-spa lifecycles. In a real shell these are loaded
        // from the deployed bundle via SystemJS (`System.import('notes-ufe')`);
        // in dev, the import-map override points that id at the local dev
        // server (see the README). We load through the host's SystemJS so the
        // uFE bundle is fetched at runtime, not resolved at build time.
        load: () =>
          (globalThis as unknown as {
            System: { import(id: string): Promise<SingleSpaLifecycles> };
          }).System.import('notes-ufe'),
      },
    ],
  });
  await shell.registerAll();
}

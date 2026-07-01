/**
 * Root component for the Notes-ufe uFE. It has a real selector
 * ('notes-ufe-root', matching main.ufe.ts's template) and renders the
 * router outlet whose route is registered at 'notes-ufe' — matching the
 * path published in metadata.ts. Nothing here is path:'' (which never
 * activates).
 */
import { Component, Inject } from '@angular/core';

import { SESSION_PROVIDER } from '@infobloxopen/devedge-ufe-angular';
import type { SessionProvider } from '@infobloxopen/devedge-ufe-core';

@Component({
  selector: 'notes-ufe-root',
  template: `
    <main class="notes-ufe-root">
      <h1>Notes-ufe</h1>
      <p>Signed in as: {{ subject }}</p>
      <router-outlet></router-outlet>
    </main>
  `,
})
export class AppComponent {
  subject = '(loading…)';

  constructor(@Inject(SESSION_PROVIDER) private readonly session: SessionProvider) {
    void this.session.getClaims?.().then((claims) => {
      this.subject = (claims?.sub as string | undefined) ?? '(anonymous)';
    });
  }
}

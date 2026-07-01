/**
 * @infobloxopen/devedge-ufe-core
 *
 * The open-core, mechanism-only micro-frontend contract for devedge. Zero
 * runtime dependencies, nothing Infoblox-specific. The seam is public here;
 * proprietary implementations bind on top privately (see the OIDC package for
 * the pattern, mirroring opaauthz → authz.Authorizer in devedge-sdk).
 */
export type {
  MicrofrontendDescriptor,
  HostProps,
  MicrofrontendModule,
} from './lifecycle.js';

export type {
  NavItemType,
  NavContribution,
  GroupRegistry,
  NavValidationOptions,
  NavValidationResult,
} from './nav.js';
export {
  staticGroupRegistry,
  validateNavContribution,
  assertNavContributions,
} from './nav.js';

export type {
  Claims,
  SessionEvent,
  SessionProvider,
  AuthEventBus,
  AuthedFetchOptions,
} from './session.js';
export { createAuthEventBus, createAuthedFetch, StubSessionProvider } from './session.js';

export type { UfeExport, UfeManifest, DeployableArtifact } from './manifest.js';
export { defineManifest } from './manifest.js';

/**
 * F5 — deploy-artifact / manifest contract.
 *
 * Generalizes the `metadata.ts` default export from the single-spa-angular
 * boilerplate ({ navItems, routes, exports, searchObjects }) into a small,
 * validated, framework-agnostic shape.
 */
import type { NavContribution } from './nav.js';

/** One exported entry a uFE artifact exposes to the host. */
export interface UfeExport {
  id: string;
  entry: string;
  type: 'ufe-application' | string;
}

/** The manifest a uFE publishes describing what it contributes. */
export interface UfeManifest {
  navItems: NavContribution[];
  routes: string[];
  exports: UfeExport[];
  searchObjects?: unknown[];
}

/** A built uFE described abstractly: its manifest plus (optionally) its files. */
export interface DeployableArtifact {
  manifest: UfeManifest;
  files?: string[];
}

/**
 * Identity function that validates a manifest's shape, throwing a clear error
 * if a required field is missing or the wrong type. Use it as the default
 * export of a uFE's `metadata` module so shape errors fail at build/import
 * time rather than rendering nothing at runtime.
 */
export function defineManifest(m: UfeManifest): UfeManifest {
  if (m == null || typeof m !== 'object') {
    throw new Error('[devedge-ufe] manifest must be an object');
  }
  if (!Array.isArray(m.navItems)) {
    throw new Error('[devedge-ufe] manifest.navItems must be an array');
  }
  if (!Array.isArray(m.routes)) {
    throw new Error('[devedge-ufe] manifest.routes must be an array');
  }
  if (!Array.isArray(m.exports)) {
    throw new Error('[devedge-ufe] manifest.exports must be an array');
  }
  for (const [i, exp] of m.exports.entries()) {
    if (!exp || typeof exp.id !== 'string' || typeof exp.entry !== 'string') {
      throw new Error(
        `[devedge-ufe] manifest.exports[${i}] must have string "id" and "entry"`,
      );
    }
  }
  if (m.searchObjects !== undefined && !Array.isArray(m.searchObjects)) {
    throw new Error('[devedge-ufe] manifest.searchObjects, if present, must be an array');
  }
  return m;
}

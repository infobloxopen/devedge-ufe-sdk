/**
 * @infobloxopen/devedge-ufe-dev-loop
 *
 * The dev-time diagnostic loop. It turns the silent-failure chain that plagued
 * the reference uFE (unreachable dev server, untrusted TLS cert, missing CORS
 * headers, missing manifest, unknown nav groups) into an ordered checklist that
 * always reports the FIRST failing step with an actionable message — never a
 * blank pass. Also provides an import-map override helper matching the OSS
 * `import-map-overrides` localStorage convention.
 */
import {
  validateNavContribution,
  type GroupRegistry,
  type NavContribution,
} from '@infobloxopen/devedge-ufe-core';

/** Default namespace for import-map-override localStorage keys. */
const DEFAULT_NS = 'devedge';

/**
 * Writes an `import-map-override:<ns>:<appId>` localStorage entry (matching the
 * OSS `import-map-overrides` convention) pointing `appId` at a local `url`,
 * then reloads so the override takes effect. No-ops outside a browser.
 */
export function override(appId: string, url: string, ns: string = DEFAULT_NS): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(`import-map-override:${ns}:${appId}`, url);
  if (typeof location !== 'undefined' && typeof location.reload === 'function') {
    location.reload();
  }
}

/** One step in a {@link diagnose} run. */
export interface DiagnoseStep {
  name: string;
  ok: boolean;
  detail?: string;
}

/** The outcome of a {@link diagnose} run. */
export interface DiagnoseResult {
  ok: boolean;
  failedStep?: string;
  message?: string;
  steps: DiagnoseStep[];
}

/** Inputs to {@link diagnose}. */
export interface DiagnoseOptions {
  devServerUrl: string;
  appId: string;
  /** Manifest/metadata path to probe (relative to devServerUrl or absolute). */
  metadataFile?: string;
  /** Registry to validate nav groups against (step 5). */
  registry?: GroupRegistry;
  /** Nav items to validate (step 5). */
  navItems?: NavContribution[];
  /** Injectable fetch for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function join(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * Detects the class of a fetch failure. TLS/certificate errors surface
 * differently across runtimes; we match on the common signals so a self-signed
 * dev cert produces a targeted message instead of a generic network error.
 */
function isCertError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err as { cause?: { code?: string } }).cause?.code ?? ''}` : String(err);
  return /cert|self.?signed|SSL|TLS|ERR_CERT|DEPTH_ZERO|UNABLE_TO_VERIFY/i.test(msg);
}

/**
 * Runs the silent-failure chain in order and returns the FIRST failing step:
 *   1. dev server reachable
 *   2. TLS cert trusted (fetch succeeds without a cert error)
 *   3. CORS headers present (access-control-allow-origin)
 *   4. metadata/manifest reachable
 *   5. every nav group validates against the registry
 * Each failure carries a clear, actionable message.
 */
export async function diagnose(o: DiagnoseOptions): Promise<DiagnoseResult> {
  const doFetch = o.fetchImpl ?? fetch;
  const steps: DiagnoseStep[] = [];

  const fail = (name: string, detail: string): DiagnoseResult => {
    steps.push({ name, ok: false, detail });
    return { ok: false, failedStep: name, message: detail, steps };
  };
  const pass = (name: string, detail?: string): void => {
    steps.push({ name, ok: true, detail });
  };

  // 1 + 2: reachability and TLS, distinguished by error class.
  let rootRes: Response;
  try {
    rootRes = await doFetch(o.devServerUrl);
  } catch (err) {
    if (isCertError(err)) {
      pass('dev server reachable', 'connection established (cert check failed next)');
      return fail(
        'TLS cert trusted',
        `TLS/certificate error contacting ${o.devServerUrl}: ${(err as Error).message}. ` +
          `Trust the dev cert (e.g. add it to your keychain / set NODE_EXTRA_CA_CERTS), or use http for local dev.`,
      );
    }
    return fail(
      'dev server reachable',
      `could not reach ${o.devServerUrl}: ${(err as Error).message}. ` +
        `Is the dev server running on that host/port?`,
    );
  }
  pass('dev server reachable', `HTTP ${rootRes.status}`);
  pass('TLS cert trusted', 'fetch succeeded without a cert error');

  // 3: CORS headers present.
  const acao = rootRes.headers.get('access-control-allow-origin');
  if (!acao) {
    return fail(
      'CORS headers present',
      `response from ${o.devServerUrl} has no "access-control-allow-origin" header. ` +
        `The shell will silently fail to load this uFE cross-origin — enable CORS on the dev server.`,
    );
  }
  pass('CORS headers present', `access-control-allow-origin: ${acao}`);

  // 4: metadata/manifest reachable.
  if (o.metadataFile) {
    const url = join(o.devServerUrl, o.metadataFile);
    try {
      const mres = await doFetch(url);
      if (!mres.ok) {
        return fail('manifest reachable', `GET ${url} returned HTTP ${mres.status}.`);
      }
      pass('manifest reachable', `HTTP ${mres.status}`);
    } catch (err) {
      return fail('manifest reachable', `GET ${url} failed: ${(err as Error).message}.`);
    }
  } else {
    pass('manifest reachable', 'skipped (no metadataFile provided)');
  }

  // 5: nav group validation (the headline fix, at dev time).
  if (o.registry && o.navItems && o.navItems.length) {
    for (const item of o.navItems) {
      const res = validateNavContribution(item, o.registry);
      if (!res.ok) {
        return fail('nav groups valid', res.error!);
      }
    }
    pass('nav groups valid', `${o.navItems.length} contribution(s) validated`);
  } else {
    pass('nav groups valid', 'skipped (no registry/navItems provided)');
  }

  return { ok: true, steps };
}

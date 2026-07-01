/**
 * @infobloxopen/devedge-ufe-single-spa
 *
 * Adapts the core F1 lifecycle contract to single-spa, and provides the
 * shell-owns-session registration mechanism. This is where "the shell owns
 * OIDC, uFEs never authenticate" becomes an enforced mechanism rather than a
 * convention: registration is gated on the shell having a token, and `session`
 * is threaded to every uFE as a single-spa custom prop.
 */
import { registerApplication, type LifeCycleFn, type LifeCycles } from 'single-spa';
import type {
  HostProps,
  MicrofrontendModule,
  SessionProvider,
} from '@infobloxopen/devedge-ufe-core';

/** The three single-spa lifecycle functions. */
export interface SingleSpaLifecycles {
  bootstrap: LifeCycleFn<HostProps>;
  mount: LifeCycleFn<HostProps>;
  unmount: LifeCycleFn<HostProps>;
}

/**
 * Adapts a {@link MicrofrontendModule} to single-spa lifecycle functions.
 * single-spa passes custom props (which include `session`) to each function;
 * this is a near-passthrough that merges the module's captured props with
 * whatever single-spa supplies at call time.
 */
export function toSingleSpaLifecycles(
  m: MicrofrontendModule,
  props: HostProps,
): SingleSpaLifecycles {
  const merge = (ssProps: unknown): HostProps => ({
    ...props,
    ...(ssProps as Record<string, unknown>),
  });
  return {
    bootstrap: async (ssProps) => m.bootstrap(merge(ssProps)),
    mount: async (ssProps) => m.mount(merge(ssProps)),
    unmount: async (ssProps) => m.unmount(merge(ssProps)),
  };
}

/** One uFE the shell will register. */
export interface ShellApp {
  name: string;
  /** single-spa activity predicate (e.g. a path-prefix match). */
  activeWhen: string | ((location: Location) => boolean) | Array<string | ((location: Location) => boolean)>;
  /** Loads the uFE's single-spa lifecycles. */
  load: () => Promise<SingleSpaLifecycles> | SingleSpaLifecycles;
}

/** Options for {@link createShell}. */
export interface ShellOptions {
  /** The shell-owned session. Instantiated ONCE, threaded to every uFE. */
  session: SessionProvider;
  apps: ShellApp[];
  /** Extra custom props passed to every uFE alongside `session`. */
  customProps?: Record<string, unknown>;
}

/** The shell handle returned by {@link createShell}. */
export interface Shell {
  registerAll(): Promise<void>;
}

/**
 * The shell-owns-session pattern. `registerAll` gates registration on
 * `await session.getToken()` FIRST — proving the shell holds a session before
 * any uFE mounts — then registers each app with `session` (plus any
 * `customProps`) as a single-spa custom prop. Child uFEs therefore only ever
 * receive the read-only SessionProvider view; they never authenticate.
 */
export function createShell(opts: ShellOptions): Shell {
  return {
    async registerAll(): Promise<void> {
      // Enforce "shell owns session" — must have a token before registering.
      await opts.session.getToken();
      for (const app of opts.apps) {
        registerApplication({
          name: app.name,
          app: async () => {
            const l = await app.load();
            return l as LifeCycles<HostProps>;
          },
          activeWhen: app.activeWhen,
          customProps: { session: opts.session, ...opts.customProps },
        });
      }
    },
  };
}

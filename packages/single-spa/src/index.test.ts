import { describe, it, expect, vi, beforeEach } from 'vitest';

const { registerApplication } = vi.hoisted(() => ({ registerApplication: vi.fn() }));
vi.mock('single-spa', () => ({ registerApplication }));

import { toSingleSpaLifecycles, createShell } from './index.js';
import type {
  HostProps,
  MicrofrontendModule,
  SessionProvider,
} from '@infobloxopen/devedge-ufe-core';

const session = (): SessionProvider => ({
  getToken: vi.fn(async () => 'tok'),
  subscribe: () => () => {},
  login: async () => {},
  logout: async () => {},
});

beforeEach(() => registerApplication.mockClear());

describe('toSingleSpaLifecycles', () => {
  it('returns the 3 lifecycle fns and forwards merged props', async () => {
    const calls: HostProps[] = [];
    const mod: MicrofrontendModule = {
      descriptor: { id: 'a', entry: './a.js' },
      bootstrap: async (p) => void calls.push(p),
      mount: async (p) => void calls.push(p),
      unmount: async (p) => void calls.push(p),
    };
    const sp = session();
    const l = toSingleSpaLifecycles(mod, { session: sp, base: 1 });
    expect(typeof l.bootstrap).toBe('function');
    expect(typeof l.mount).toBe('function');
    expect(typeof l.unmount).toBe('function');

    await l.mount({ session: sp, extra: 2 });
    expect(calls[0]).toMatchObject({ base: 1, extra: 2 });
    expect(calls[0].session).toBe(sp);
  });
});

describe('createShell (shell owns session)', () => {
  it('awaits getToken() BEFORE registering, and passes session as a custom prop', async () => {
    const order: string[] = [];
    const sp = session();
    (sp.getToken as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('getToken');
      return 'tok';
    });
    registerApplication.mockImplementation(() => order.push('register'));

    const shell = createShell({
      session: sp,
      apps: [
        { name: 'app1', activeWhen: '/a', load: () => ({} as never) },
        { name: 'app2', activeWhen: '/b', load: () => ({} as never) },
      ],
    });
    await shell.registerAll();

    expect(order[0]).toBe('getToken');
    expect(order.filter((x) => x === 'register')).toHaveLength(2);
    expect(order.indexOf('getToken')).toBeLessThan(order.indexOf('register'));

    const firstCall = registerApplication.mock.calls[0][0];
    expect(firstCall.customProps.session).toBe(sp);
    expect(firstCall.name).toBe('app1');
  });
});

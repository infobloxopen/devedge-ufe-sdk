import { describe, it, expect, vi } from 'vitest';
import { diagnose } from './index.js';
import { staticGroupRegistry, type NavContribution } from '@infobloxopen/devedge-ufe-core';

function res(headers: Record<string, string>, status = 200): Response {
  return new Response('ok', { status, headers });
}

const goodHeaders = { 'access-control-allow-origin': '*' };

describe('diagnose', () => {
  it('returns the first failing step for a simulated cert failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('unable to verify the first certificate (self-signed?)');
    });
    const r = await diagnose({
      devServerUrl: 'https://localhost:4200',
      appId: 'app',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe('TLS cert trusted');
    expect(r.message).toMatch(/cert/i);
    // reachability passed before the cert step failed
    expect(r.steps.find((s) => s.name === 'dev server reachable')?.ok).toBe(true);
  });

  it('returns unreachable when the connection cannot be made', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await diagnose({
      devServerUrl: 'http://localhost:4200',
      appId: 'app',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe('dev server reachable');
  });

  it('fails on missing CORS headers', async () => {
    const fetchImpl = vi.fn(async () => res({}));
    const r = await diagnose({
      devServerUrl: 'http://localhost:4200',
      appId: 'app',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe('CORS headers present');
  });

  it('returns the first failing step for an unknown nav group', async () => {
    const fetchImpl = vi.fn(async () => res(goodHeaders));
    const navItems: NavContribution[] = [
      { name: 'Bad', path: '/bad', group: 'nope', type: 'menuItem' },
    ];
    const r = await diagnose({
      devServerUrl: 'http://localhost:4200',
      appId: 'app',
      registry: staticGroupRegistry(['manage']),
      navItems,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe('nav groups valid');
    expect(r.message).toContain('"nope"');
    expect(r.message).toContain('"manage"');
  });

  it('passes end-to-end when everything is healthy', async () => {
    const fetchImpl = vi.fn(async () => res(goodHeaders));
    const r = await diagnose({
      devServerUrl: 'http://localhost:4200',
      appId: 'app',
      metadataFile: 'metadata.js',
      registry: staticGroupRegistry(['manage']),
      navItems: [{ name: 'Ok', path: '/ok', group: 'manage', type: 'menuItem' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.steps.every((s) => s.ok)).toBe(true);
  });
});

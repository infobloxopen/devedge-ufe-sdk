import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  staticGroupRegistry,
  validateNavContribution,
  assertNavContributions,
  type NavContribution,
} from './nav.js';

const item = (over: Partial<NavContribution> = {}): NavContribution => ({
  name: 'Widgets',
  path: '/widgets',
  group: 'manage',
  type: 'menuItem',
  ...over,
});

describe('validateNavContribution', () => {
  it('passes a known group', () => {
    const reg = staticGroupRegistry(['manage', 'monitor']);
    expect(validateNavContribution(item(), reg)).toEqual({ ok: true });
  });

  it('fails an unknown group and names it + the valid groups', () => {
    const reg = staticGroupRegistry(['manage', 'monitor']);
    const res = validateNavContribution(item({ group: 'manageee' }), reg);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('"manageee"');
    expect(res.error).toContain('"manage"');
    expect(res.error).toContain('"monitor"');
  });
});

describe('empty registry: permissive vs strict', () => {
  afterEach(() => vi.restoreAllMocks());

  it('strict (default) fails on an empty registry', () => {
    const reg = staticGroupRegistry([]);
    const res = validateNavContribution(item(), reg);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('empty');
  });

  it('permissive passes on an empty registry but WARNS loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = staticGroupRegistry([]);
    const res = validateNavContribution(item(), reg, { permissive: true });
    expect(res.ok).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('empty');
  });
});

describe('assertNavContributions (headline fix)', () => {
  it('THROWS naming the unknown group and listing valid groups', () => {
    const reg = staticGroupRegistry(['manage', 'monitor']);
    const cs = [item(), item({ name: 'Bad', group: 'nope' })];
    expect(() => assertNavContributions(cs, reg)).toThrowError(/unknown group "nope"/);
    try {
      assertNavContributions(cs, reg);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('"Bad"');
      expect(msg).toContain('"manage"');
      expect(msg).toContain('"monitor"');
    }
  });

  it('does not throw when all groups are known', () => {
    const reg = staticGroupRegistry(['manage']);
    expect(() => assertNavContributions([item()], reg)).not.toThrow();
  });
});

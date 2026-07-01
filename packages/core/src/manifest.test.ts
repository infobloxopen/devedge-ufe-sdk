import { describe, it, expect } from 'vitest';
import { defineManifest, type UfeManifest } from './manifest.js';

const valid: UfeManifest = {
  navItems: [],
  routes: ['/app'],
  exports: [{ id: 'app', entry: './main.js', type: 'ufe-application' }],
  searchObjects: [],
};

describe('defineManifest', () => {
  it('returns the same manifest when valid', () => {
    expect(defineManifest(valid)).toBe(valid);
  });

  it('throws when navItems is not an array', () => {
    expect(() => defineManifest({ ...valid, navItems: undefined as never })).toThrow(
      /navItems/,
    );
  });

  it('throws when an export is missing id/entry', () => {
    expect(() =>
      defineManifest({ ...valid, exports: [{ entry: './x.js' } as never] }),
    ).toThrow(/exports\[0\]/);
  });

  it('throws when searchObjects is present but not an array', () => {
    expect(() =>
      defineManifest({ ...valid, searchObjects: {} as never }),
    ).toThrow(/searchObjects/);
  });
});

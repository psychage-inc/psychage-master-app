import { describe, expect, it } from 'vitest';

import { compareSemver, evaluateVersionGate, parseSemver } from '@/lib/app-version/semver';

describe('parseSemver', () => {
  it('parses strict MAJOR.MINOR.PATCH', () => {
    expect(parseSemver('1.1.0')).toEqual([1, 1, 0]);
    expect(parseSemver('10.0.12')).toEqual([10, 0, 12]);
  });

  it.each([null, undefined, 110, '', '1.1', '1.1.0.0', 'v1.1.0', '1.1.0-beta', ' 1.1.0', '01.1.0', '1.a.0', {}])(
    'rejects %j',
    (value) => {
      expect(parseSemver(value)).toBeNull();
    },
  );
});

describe('compareSemver', () => {
  it('compares numerically, not lexically', () => {
    expect(compareSemver([1, 10, 0], [1, 9, 0])).toBe(1);
    expect(compareSemver([1, 0, 9], [1, 1, 0])).toBe(-1);
    expect(compareSemver([2, 0, 0], [2, 0, 0])).toBe(0);
  });
});

describe('evaluateVersionGate', () => {
  it('blocks an installed version below the minimum', () => {
    expect(evaluateVersionGate('1.0.0', '1.1.0')).toBe('update-required');
    expect(evaluateVersionGate('1.1.0', '1.1.1')).toBe('update-required');
    expect(evaluateVersionGate('1.9.9', '2.0.0')).toBe('update-required');
  });

  it('passes an installed version equal to or above the minimum', () => {
    expect(evaluateVersionGate('1.1.0', '1.1.0')).toBe('ok');
    expect(evaluateVersionGate('1.2.0', '1.1.0')).toBe('ok');
    expect(evaluateVersionGate('1.10.0', '1.9.0')).toBe('ok');
  });

  it('is an error (never a pass) when either side is not a valid semver', () => {
    expect(evaluateVersionGate('1.1.0', null)).toBe('error');
    expect(evaluateVersionGate('1.1.0', '')).toBe('error');
    expect(evaluateVersionGate('1.1.0', { version: '1.1.0' })).toBe('error');
    expect(evaluateVersionGate('1.1.0', '1.1')).toBe('error');
    expect(evaluateVersionGate(null, '1.1.0')).toBe('error');
  });
});

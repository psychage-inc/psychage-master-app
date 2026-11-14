// Minimum-app-version decision — pure, so it unit-tests under Vitest without the
// native layer. The startup gate (features/app-gate) feeds it the installed native
// version and the server minimum from get_min_app_version.
//
// Strict MAJOR.MINOR.PATCH only (e.g. '1.1.0'). Anything else — prerelease tags,
// a 'v' prefix, two parts, whitespace, non-strings — is invalid, and an invalid
// value on either side is an ERROR, never a pass (no fail-open).

export type Semver = readonly [number, number, number];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Parse a strict semver string, or null when it is not one. */
export function parseSemver(value: unknown): Semver | null {
  if (typeof value !== 'string') return null;
  const m = SEMVER.exec(value);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** -1 when a < b, 0 when equal, 1 when a > b. */
export function compareSemver(a: Semver, b: Semver): -1 | 0 | 1 {
  const pairs: [number, number][] = [
    [a[0], b[0]],
    [a[1], b[1]],
    [a[2], b[2]],
  ];
  for (const [x, y] of pairs) {
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export type VersionGateResult = 'ok' | 'update-required' | 'error';

/**
 * Decide the gate: 'update-required' when the installed version is lower than the
 * minimum, 'ok' when equal or higher, 'error' when either value is not a valid
 * semver (the caller shows a retryable error — never lets the user through).
 */
export function evaluateVersionGate(installed: unknown, minimum: unknown): VersionGateResult {
  const have = parseSemver(installed);
  const need = parseSemver(minimum);
  if (!have || !need) return 'error';
  return compareSemver(have, need) < 0 ? 'update-required' : 'ok';
}

// Compliance item 0 — native config rules. ios/ and android/ are generated (CNG),
// so app.json is the source of truth for permissions and the iOS privacy manifest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const appJson = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as {
  expo: {
    version: string;
    plugins: (string | [string, unknown])[];
    ios: { privacyManifests: Record<string, unknown> };
    android: { permissions?: string[]; blockedPermissions?: string[] };
  };
};
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

const LOCATION_PERMS = ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'];

describe('app version', () => {
  it('ships 1.1.0 — the version the server minimum (get_min_app_version) is checked against', () => {
    expect(appJson.expo.version).toBe('1.1.0');
  });
});

describe('device location is not used', () => {
  it('has no expo-location dependency or config plugin', () => {
    expect(pkg.dependencies['expo-location']).toBeUndefined();
    const names = appJson.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    expect(names).not.toContain('expo-location');
  });

  it('requests no Android location permission and blocks both from manifest merge', () => {
    for (const perm of LOCATION_PERMS) {
      expect(appJson.expo.android.permissions ?? []).not.toContain(perm);
      expect(appJson.expo.android.blockedPermissions).toContain(perm);
    }
  });
});

describe('iOS privacy manifest', () => {
  const manifest = appJson.expo.ios.privacyManifests as {
    NSPrivacyTracking: boolean;
    NSPrivacyTrackingDomains: string[];
    NSPrivacyCollectedDataTypes: {
      NSPrivacyCollectedDataType: string;
      NSPrivacyCollectedDataTypeLinked: boolean;
      NSPrivacyCollectedDataTypeTracking: boolean;
      NSPrivacyCollectedDataTypePurposes: string[];
    }[];
    NSPrivacyAccessedAPITypes: { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }[];
  };

  it('declares no tracking', () => {
    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(manifest.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('declares exactly email, user ID, health and other user content — linked, not tracking, app functionality', () => {
    const types = manifest.NSPrivacyCollectedDataTypes.map((t) => t.NSPrivacyCollectedDataType).sort();
    expect(types).toEqual(
      [
        'NSPrivacyCollectedDataTypeEmailAddress',
        'NSPrivacyCollectedDataTypeHealth',
        'NSPrivacyCollectedDataTypeOtherUserContent',
        'NSPrivacyCollectedDataTypeUserID',
      ].sort(),
    );
    for (const t of manifest.NSPrivacyCollectedDataTypes) {
      expect(t.NSPrivacyCollectedDataTypeLinked).toBe(true);
      expect(t.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(t.NSPrivacyCollectedDataTypePurposes).toEqual(['NSPrivacyCollectedDataTypePurposeAppFunctionality']);
    }
  });

  it('declares the required-reason APIs the bundled Expo / React Native pods use', () => {
    const byType = Object.fromEntries(
      manifest.NSPrivacyAccessedAPITypes.map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons]),
    );
    expect(byType.NSPrivacyAccessedAPICategoryUserDefaults).toContain('CA92.1');
    expect(byType.NSPrivacyAccessedAPICategoryFileTimestamp).toContain('C617.1');
    expect(byType.NSPrivacyAccessedAPICategorySystemBootTime).toContain('35F9.1');
    expect(byType.NSPrivacyAccessedAPICategoryDiskSpace).toContain('E174.1');
  });
});

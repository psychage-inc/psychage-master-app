// Config adapter — mobile DI seam values.
//
// `appVersion` is stamped into synced MomentRecord provenance
// (`client_version: mobile@<appVersion>` in lib/moment-store.ts), so it must be
// the REAL app version, not a stub (PR-005). `expo-constants` (hoisted
// transitive dep of expo-router; expo-application is NOT installed) exposes
// app.json's `version` as `Constants.expoConfig?.version`.

export interface AppConfig {
  readonly appVersion: string;
  readonly env: 'dev' | 'prod';
}

function resolveAppVersion(): string {
  try {
    // Guarded CJS require, not a static import: lib/moment-store.ts (imported by
    // Vitest logic tests) loads this module, and expo-constants' module graph
    // pulls react-native — which cannot load under node. On Metro the require
    // resolves normally; under node/Vitest it throws and we fall back.
    const Constants = (
      require('expo-constants') as {
        default?: { expoConfig?: { version?: string | null } | null } | null;
      }
    ).default;
    return Constants?.expoConfig?.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const config: AppConfig = {
  appVersion: resolveAppVersion(),
  env: 'dev',
};

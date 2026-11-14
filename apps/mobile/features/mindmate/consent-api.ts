// MindMate consent + conversation-deletion RPCs (compliance items 5 + 6). Thin,
// fail-fast wrappers over the shared Supabase project's RPCs, called with the
// signed-in user's session (the existing auth client). Every wrapper THROWS on an
// RPC error or an unexpected payload — callers show the error; nothing is swallowed.
//
//   mindmate_consent_status()                       → 'current' | 'outdated' | 'none'
//   grant_mindmate_consent(p_version, p_app_version) → void
//   withdraw_mindmate_consent()                     → void (stamps revoked_at)
//   delete_mindmate_conversations()                 → void (hard-deletes server copies)
//
// The client is injectable so the wrappers are unit-testable under Vitest (node).

import type { SupabaseClient } from '@supabase/supabase-js';

import { MINDMATE_CONSENT_VERSION } from './consent-copy';

export type MindMateConsentStatus = 'current' | 'outdated' | 'none';

/** The minimal client surface the wrappers use (rpc only). */
export type ConsentRpcClient = Pick<SupabaseClient, 'rpc'>;

export interface MindMateConsentApi {
  getStatus(): Promise<MindMateConsentStatus>;
  grant(): Promise<void>;
  withdraw(): Promise<void>;
  deleteConversations(): Promise<void>;
}

function parseStatus(data: unknown): MindMateConsentStatus {
  if (data === 'current' || data === 'outdated' || data === 'none') return data;
  throw new Error(`mindmate_consent_status returned an unexpected value: ${JSON.stringify(data)}`);
}

async function call(client: ConsentRpcClient, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as unknown;
}

/**
 * `ios-<version>` / `android-<version>` for grant_mindmate_consent's p_app_version.
 * Throws when the native version is unavailable or the platform is neither — the
 * server rejects an empty app version, and a guessed one would be a false record.
 */
export function mindMateAppVersion(platform: string, nativeApplicationVersion: string | null): string {
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`MindMate consent can only be recorded on ios or android (got ${platform}).`);
  }
  if (!nativeApplicationVersion) {
    throw new Error('Native application version is unavailable; cannot record MindMate consent.');
  }
  return `${platform}-${nativeApplicationVersion}`;
}

export function createMindMateConsentApi(
  client: ConsentRpcClient,
  appVersion: () => string,
): MindMateConsentApi {
  return {
    getStatus: async () => parseStatus(await call(client, 'mindmate_consent_status')),
    grant: async () => {
      await call(client, 'grant_mindmate_consent', {
        p_version: MINDMATE_CONSENT_VERSION,
        p_app_version: appVersion(),
      });
    },
    withdraw: async () => {
      await call(client, 'withdraw_mindmate_consent');
    },
    deleteConversations: async () => {
      await call(client, 'delete_mindmate_conversations');
    },
  };
}

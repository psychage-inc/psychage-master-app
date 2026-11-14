import { describe, expect, it, vi } from 'vitest';

import {
  type ConsentRpcClient,
  createMindMateConsentApi,
  mindMateAppVersion,
} from '@/features/mindmate/consent-api';
import {
  MINDMATE_CONSENT_CHANGE_SUMMARY,
  MINDMATE_CONSENT_VERSION,
  requireConsentChangeSummary,
} from '@/features/mindmate/consent-copy';

// A fake rpc client: records every call and answers from a per-function table.
function fakeClient(answers: Record<string, { data?: unknown; error?: { message: string } }>) {
  const rpc = vi.fn(async (fn: string, _args?: unknown) => {
    const a = answers[fn] ?? {};
    return { data: a.data ?? null, error: a.error ?? null };
  });
  return { client: { rpc } as unknown as ConsentRpcClient, rpc };
}

describe('MindMate consent constants', () => {
  it('labels this build with mm-consent-v1', () => {
    expect(MINDMATE_CONSENT_VERSION).toBe('mm-consent-v1');
  });

  it('v1 ships no change summary — outdated status then fails fast', () => {
    expect(MINDMATE_CONSENT_CHANGE_SUMMARY).toBeNull();
    expect(() => requireConsentChangeSummary(null)).toThrow(/MINDMATE_CONSENT_CHANGE_SUMMARY is null/);
    expect(requireConsentChangeSummary('We now keep less.')).toBe('We now keep less.');
  });
});

describe('mindMateAppVersion', () => {
  it('stamps ios-/android- with the native version', () => {
    expect(mindMateAppVersion('ios', '1.4.0')).toBe('ios-1.4.0');
    expect(mindMateAppVersion('android', '1.4.0')).toBe('android-1.4.0');
  });

  it('throws when the native version is unavailable', () => {
    expect(() => mindMateAppVersion('ios', null)).toThrow(/Native application version is unavailable/);
    expect(() => mindMateAppVersion('android', '')).toThrow(/Native application version is unavailable/);
  });

  it('throws on a non-native platform', () => {
    expect(() => mindMateAppVersion('web', '1.4.0')).toThrow(/ios or android/);
  });
});

describe('createMindMateConsentApi', () => {
  it.each(['current', 'outdated', 'none'] as const)('getStatus returns %s', async (status) => {
    const { client, rpc } = fakeClient({ mindmate_consent_status: { data: status } });
    const api = createMindMateConsentApi(client, () => 'ios-1.0.0');
    await expect(api.getStatus()).resolves.toBe(status);
    expect(rpc).toHaveBeenCalledWith('mindmate_consent_status', undefined);
  });

  it('getStatus throws on an unexpected value (never guesses consent)', async () => {
    const { client } = fakeClient({ mindmate_consent_status: { data: 'granted' } });
    const api = createMindMateConsentApi(client, () => 'ios-1.0.0');
    await expect(api.getStatus()).rejects.toThrow(/unexpected value/);
  });

  it('getStatus throws on an RPC error (e.g. no session)', async () => {
    const { client } = fakeClient({ mindmate_consent_status: { error: { message: 'not authenticated' } } });
    const api = createMindMateConsentApi(client, () => 'ios-1.0.0');
    await expect(api.getStatus()).rejects.toThrow(/mindmate_consent_status failed: not authenticated/);
  });

  it('grant sends this build’s version and the platform app version', async () => {
    const { client, rpc } = fakeClient({});
    const api = createMindMateConsentApi(client, () => 'android-2.0.1');
    await api.grant();
    expect(rpc).toHaveBeenCalledWith('grant_mindmate_consent', {
      p_version: 'mm-consent-v1',
      p_app_version: 'android-2.0.1',
    });
  });

  it('grant fails fast (no RPC) when the app version cannot be resolved', async () => {
    const { client, rpc } = fakeClient({});
    const api = createMindMateConsentApi(client, () => mindMateAppVersion('ios', null));
    await expect(api.grant()).rejects.toThrow(/Native application version is unavailable/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('grant throws when the server rejects it', async () => {
    const { client } = fakeClient({ grant_mindmate_consent: { error: { message: 'stale version' } } });
    const api = createMindMateConsentApi(client, () => 'ios-1.0.0');
    await expect(api.grant()).rejects.toThrow(/grant_mindmate_consent failed: stale version/);
  });

  it('withdraw and deleteConversations call their RPCs and throw on error', async () => {
    const ok = fakeClient({});
    const api = createMindMateConsentApi(ok.client, () => 'ios-1.0.0');
    await api.withdraw();
    await api.deleteConversations();
    expect(ok.rpc).toHaveBeenCalledWith('withdraw_mindmate_consent', undefined);
    expect(ok.rpc).toHaveBeenCalledWith('delete_mindmate_conversations', undefined);

    const bad = fakeClient({
      withdraw_mindmate_consent: { error: { message: 'boom' } },
      delete_mindmate_conversations: { error: { message: 'boom' } },
    });
    const badApi = createMindMateConsentApi(bad.client, () => 'ios-1.0.0');
    await expect(badApi.withdraw()).rejects.toThrow(/withdraw_mindmate_consent failed/);
    await expect(badApi.deleteConversations()).rejects.toThrow(/delete_mindmate_conversations failed/);
  });
});

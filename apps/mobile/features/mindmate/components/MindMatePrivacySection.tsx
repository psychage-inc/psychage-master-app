import { useState } from 'react';
import { ActivityIndicator, Alert, Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth';
import { useThemeColors } from '@/lib/use-theme-colors';

import type { MindMateConsentApi } from '../consent-api';
import { MINDMATE_PRIVACY_COPY } from '../consent-copy';
import { MINDMATE_COPY } from '../copy';
import { clearLocalMindMateConversations } from '../local-conversation';
import { getMindMateConsentApi } from '../production-consent-api';
import { useMindMateConsent } from '../useMindMateConsent';

// Settings > Privacy > MindMate (compliance item 6, mobile half). Consent reads On only
// when the server says 'current'. The toggle can only turn consent OFF — turning it on
// happens through the consent screen in MindMate. "Delete all conversations" hard-
// deletes the server copies (delete_mindmate_conversations) and clears the in-memory
// transcript on this device. Every failure is shown; nothing is swallowed.
export function MindMatePrivacySection({
  getConsentApi = getMindMateConsentApi,
}: {
  /** Injectable consent RPCs for tests; defaults to the real Supabase-backed API. */
  getConsentApi?: () => MindMateConsentApi;
}) {
  const p = MINDMATE_PRIVACY_COPY;
  const tc = useThemeColors();
  const { session } = useAuth();
  const consent = useMindMateConsent({ signedIn: session !== null, getApi: getConsentApi });
  const [busy, setBusy] = useState<'withdraw' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const gate = consent.state;

  if (gate.kind === 'signed-out') {
    return (
      <View className="px-4 py-3" testID="mindmate-privacy">
        <Text variant="body">{MINDMATE_COPY.privacySignedOut}</Text>
      </View>
    );
  }
  if (gate.kind === 'loading') {
    return (
      <View className="items-center px-4 py-4" testID="mindmate-privacy">
        <ActivityIndicator accessibilityLabel={MINDMATE_COPY.consentLoadingLabel} color={tc.primary} />
      </View>
    );
  }
  if (gate.kind === 'error') {
    return (
      <View className="gap-3 px-4 py-3" testID="mindmate-privacy">
        <Text variant="body" accessibilityRole="alert" testID="mindmate-privacy-load-error">
          {MINDMATE_COPY.consentLoadFailed}
        </Text>
        <Button variant="secondary" onPress={consent.reload} testID="mindmate-privacy-retry">
          {MINDMATE_COPY.consentRetry}
        </Button>
      </View>
    );
  }

  const on = gate.status === 'current';

  const turnOff = async () => {
    if (busy !== null || !on) return;
    setBusy('withdraw');
    setActionError(null);
    try {
      await consent.withdraw();
    } catch {
      setActionError(MINDMATE_COPY.consentActionFailed);
    } finally {
      setBusy(null);
    }
  };

  const deleteAll = async () => {
    setBusy('delete');
    setActionError(null);
    setDeleted(false);
    try {
      await getConsentApi().deleteConversations();
      clearLocalMindMateConversations();
      setDeleted(true);
    } catch {
      setActionError(MINDMATE_COPY.consentActionFailed);
    } finally {
      setBusy(null);
    }
  };

  const confirmDeleteAll = () => {
    if (busy !== null) return;
    Alert.alert(p.deleteAll, MINDMATE_COPY.deleteConfirmBody, [
      { text: MINDMATE_COPY.deleteConfirmCancel, style: 'cancel' },
      { text: MINDMATE_COPY.deleteConfirmDelete, style: 'destructive', onPress: () => void deleteAll() },
    ]);
  };

  const statusLine = `${p.consentLabel} ${on ? p.on : p.off}`;

  return (
    <View className="gap-3 px-4 py-3" testID="mindmate-privacy">
      <View className="min-h-[44px] flex-row items-center gap-3">
        <Text variant="bodyLarge" className="flex-1" testID="mindmate-privacy-status">
          {statusLine}
        </Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={statusLine}
          accessibilityState={{ checked: on, disabled: !on || busy !== null }}
          value={on}
          // Off-only: the switch is disabled while consent is off, and only an OFF
          // transition is acted on.
          disabled={!on || busy !== null}
          onValueChange={(next) => {
            if (!next) void turnOff();
          }}
          trackColor={{ true: tc.primary }}
          testID="mindmate-privacy-toggle"
        />
      </View>
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        {p.body}
      </Text>
      {actionError ? (
        <Text
          variant="caption"
          accessibilityRole="alert"
          className="text-error dark:text-error-dark"
          testID="mindmate-privacy-error"
        >
          {actionError}
        </Text>
      ) : null}
      {deleted ? (
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark" testID="mindmate-privacy-deleted">
          {MINDMATE_COPY.deleteDone}
        </Text>
      ) : null}
      <Button
        variant="secondary"
        onPress={turnOff}
        disabled={!on || busy !== null}
        isLoading={busy === 'withdraw'}
        testID="mindmate-privacy-turn-off"
      >
        {p.turnOff}
      </Button>
      <Button
        variant="secondary"
        onPress={confirmDeleteAll}
        disabled={busy !== null}
        isLoading={busy === 'delete'}
        testID="mindmate-privacy-delete-all"
      >
        {p.deleteAll}
      </Button>
    </View>
  );
}

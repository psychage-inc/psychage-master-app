import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

import { MINDMATE_CONSENT_COPY, MINDMATE_HEALTH_DATA_POLICY_URL } from '../consent-copy';
import { MINDMATE_COPY } from '../copy';

// Compliance item 5 — shown before the first message to a signed-in user with no
// MindMate consent. Nothing is pre-ticked: there is no checkbox or switch, only an
// explicit agree button. "Not now" records nothing and leaves MindMate.
export function ConsentScreen({
  onAgree,
  onNotNow,
}: {
  /** grant_mindmate_consent; rejects on failure (shown here, the user stays put). */
  onAgree: () => Promise<void>;
  onNotNow: () => void;
}) {
  const c = MINDMATE_CONSENT_COPY;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAgree();
    } catch {
      setError(MINDMATE_COPY.consentActionFailed);
    } finally {
      setBusy(false);
    }
  };

  const openPolicy = () => {
    setError(null);
    Linking.openURL(MINDMATE_HEALTH_DATA_POLICY_URL).catch(() => {
      setError(MINDMATE_COPY.policyOpenFailed);
    });
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      testID="mindmate-consent-screen"
    >
      <Text variant="h2" accessibilityRole="header">
        {c.title}
      </Text>
      <Text variant="body">{c.intro}</Text>
      <Text variant="body">{c.sendLead}</Text>
      <View className="gap-2">
        {c.bullets.map((bullet) => (
          <View key={bullet} className="flex-row gap-2">
            <Text variant="body" importantForAccessibility="no" accessibilityElementsHidden>
              {'•'}
            </Text>
            <Text variant="body" className="flex-1">
              {bullet}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="body">{c.withdraw}</Text>
      <Text
        variant="body"
        accessibilityRole="link"
        onPress={openPolicy}
        className="text-text-interactive underline dark:text-text-interactive-dark"
        testID="mindmate-consent-policy-link"
      >
        {c.policyLink}
      </Text>

      {error ? (
        <Text
          variant="caption"
          accessibilityRole="alert"
          className="text-error dark:text-error-dark"
          testID="mindmate-consent-error"
        >
          {error}
        </Text>
      ) : null}

      <View className="gap-2 pt-2">
        <Button onPress={agree} isLoading={busy} disabled={busy} testID="mindmate-consent-agree">
          {c.agree}
        </Button>
        <Button variant="ghost" onPress={onNotNow} disabled={busy} testID="mindmate-consent-not-now">
          {c.notNow}
        </Button>
      </View>
    </ScrollView>
  );
}

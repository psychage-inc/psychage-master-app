import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

import { MINDMATE_RECONSENT_COPY, requireConsentChangeSummary } from '../consent-copy';
import { MINDMATE_COPY } from '../copy';

// Compliance item 5 — the server reports the user's consent as 'outdated' (the text
// they agreed to has changed). "Review and agree" opens the full consent screen;
// "Turn off MindMate" withdraws consent and leaves. With no change summary in this
// build the screen throws (requireConsentChangeSummary) rather than ask for an
// agreement to an unstated change.
export function ReconsentScreen({
  summary,
  onReview,
  onTurnOff,
}: {
  summary: string | null;
  onReview: () => void;
  /** withdraw_mindmate_consent, then leave; rejects on failure (shown here). */
  onTurnOff: () => Promise<void>;
}) {
  const r = MINDMATE_RECONSENT_COPY;
  const changeSummary = requireConsentChangeSummary(summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onTurnOff();
    } catch {
      setError(MINDMATE_COPY.consentActionFailed);
      setBusy(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      testID="mindmate-reconsent-screen"
    >
      <Text variant="body">
        <Text variant="body" className="font-sans-bold">
          {r.heading}
        </Text>{' '}
        {changeSummary} {r.closing}
      </Text>

      {error ? (
        <Text
          variant="caption"
          accessibilityRole="alert"
          className="text-error dark:text-error-dark"
          testID="mindmate-reconsent-error"
        >
          {error}
        </Text>
      ) : null}

      <View className="gap-2 pt-2">
        <Button onPress={onReview} disabled={busy} testID="mindmate-reconsent-review">
          {r.review}
        </Button>
        <Button
          variant="secondary"
          onPress={turnOff}
          isLoading={busy}
          disabled={busy}
          testID="mindmate-reconsent-turn-off"
        >
          {r.turnOff}
        </Button>
      </View>
    </ScrollView>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { THERAPIST_COPY } from '@/features/therapist/copy';
import type { Provider } from '@/features/therapist/use-provider';
import { DURATION, easingFn, useReducedMotion } from '@/lib/motion';

// S39 — Add provider (ONE provider in V1). Calm form: name (required) + optional
// contact. Reuses the calm AuthTextField (no shake on error). Router-agnostic body.
// Provider contact is PII — never logged (Sacred Rule #11).
//
// `initialName` / `initialContact` pre-seed the fields when the user arrived from
// the directory ("Use in my therapist record"). They are still editable, and the
// contact remains in-memory only — never persisted or logged.
type ProviderFormProps = {
  onSubmit: (provider: Provider) => void;
  initialName?: string;
  initialContact?: string;
};

export function ProviderForm({ onSubmit, initialName = '', initialContact = '' }: ProviderFormProps) {
  const reduced = useReducedMotion();
  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState(initialContact);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const handleSubmit = () => {
    if (name.trim().length === 0) {
      setNameError(THERAPIST_COPY.providerNameHint);
      return;
    }
    const trimmedContact = contact.trim();
    onSubmit({ name: name.trim(), contact: trimmedContact.length > 0 ? trimmedContact : undefined });
  };

  return (
    <ScreenShell>
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(DURATION.base).easing(easingFn('out'))}
        className="flex-1 justify-center gap-6"
      >
        <View className="gap-3">
          <Text variant="h1">{THERAPIST_COPY.consentTitle}</Text>
          {/* What sharing does / what the provider sees — the consent disclosure that
              previously lived only in the standalone S38 ConsentIntro screen. Surfaced
              here so the person sees it before entering provider details. */}
          <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
            {THERAPIST_COPY.consentBody}
          </Text>
        </View>
        <View className="gap-4">
          <AuthTextField
            label={THERAPIST_COPY.providerNameLabel}
            fieldAccessibilityHint={THERAPIST_COPY.providerNameHint}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError(undefined);
            }}
            errorText={nameError}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <AuthTextField
            label={THERAPIST_COPY.providerContactLabel}
            value={contact}
            onChangeText={setContact}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>
        <Button variant="primary" onPress={handleSubmit}>
          {THERAPIST_COPY.addProviderPrimary}
        </Button>
      </Animated.View>
    </ScreenShell>
  );
}

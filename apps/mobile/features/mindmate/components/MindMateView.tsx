import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ToolScreen } from '@/components/ui/ToolScreen';
import { localeDeviceRegionHint } from '@/features/crisis/device-region';
import { CRISIS_DATASET } from '@/features/crisis/helplines.fixtures';
import {
  defaultDeviceRegionHint,
  getHelplines,
  loadRegionOverride,
  resolveRegion,
} from '@/features/crisis/region';
import { useIsOnline } from '@/features/offline/useIsOnline';
import { AUTH_SIGN_IN_ROUTE } from '@/features/webview/auth-handshake';
import { storage } from '@/lib/adapters/storage';

import { MINDMATE_COPY } from '../copy';
import type { sendMessage } from '../mindmate-service';
import { type UseMindMateChatOptions, useMindMateChat } from '../useMindMateChat';
import { ChatInput } from './ChatInput';
import { ConsentBanner } from './ConsentBanner';
import { type CrisisHotline, CrisisCard } from './CrisisCard';
import { MessageList } from './MessageList';
import { MessageListBoundary } from './MessageListBoundary';

// S-MM MindMate screen. NATIVE chat (message list + composer), mascot-fronted.
// GlobalHeader carries the always-visible Help-now pill → the crisis surface is
// reachable throughout (SR-1). A CrisisCard also drops inline the instant a crisis
// is detected (client pre-check OR server verdict) and takes priority over the AI.
//
// Callback-driven (onRequestCrisis/onSignIn/onBack/sendImpl injectable) so the
// screen renders + tests without an expo-router or network context.

function resolveActiveRegion() {
  return resolveRegion({
    storedOverride: loadRegionOverride(storage),
    deviceHint: localeDeviceRegionHint() ?? defaultDeviceRegionHint(),
  });
}

/** The region's first voice-capable bundled hotline (name + number), or null. Read
 *  from the crisis lane's offline dataset — no network — so the inline Call action
 *  works with the network off. */
function resolvePrimaryHotline(region: string): CrisisHotline | null {
  const withCall = getHelplines(CRISIS_DATASET, region).find((r) => r.callNumber);
  return withCall?.callNumber ? { name: withCall.name, callNumber: withCall.callNumber } : null;
}

type MindMateViewProps = {
  region?: string;
  onRequestCrisis?: () => void;
  onSignIn?: () => void;
  onBack?: () => void;
  /** Injectable streaming impl for tests; defaults to the real service. */
  sendImpl?: typeof sendMessage;
  /** Injectable consent-gated persister for tests; defaults to the real writer. */
  persistImpl?: UseMindMateChatOptions['persistImpl'];
};

export function MindMateView({
  region,
  onRequestCrisis = () => router.push('/crisis'),
  onSignIn = () => router.push(AUTH_SIGN_IN_ROUTE),
  onBack = () => router.back(),
  sendImpl,
  persistImpl,
}: MindMateViewProps) {
  const activeRegion = region ?? resolveActiveRegion();
  const hotline = resolvePrimaryHotline(activeRegion);
  const online = useIsOnline();
  const [consentDismissed, setConsentDismissed] = useState(false);

  const { messages, status, error, crisisActive, needsSignIn, send, retry } = useMindMateChat({
    region: activeRegion,
    onCrisis: onRequestCrisis,
    sendImpl,
    persistImpl,
  });

  return (
    <ToolScreen scroll="none" keyboardAvoiding title="MindMate" onBack={onBack} edges={['top']}>
      {/* Live status — relocated out of the header into a thin strip atop the chat.
          Reflects real connectivity: neutral dot + calm "Offline" when disconnected. */}
      <View className="flex-row items-center justify-center gap-1.5 pb-2">
        <View
          className={
            online
              ? 'h-1.5 w-1.5 rounded-full bg-primary dark:bg-primary-dark'
              : 'h-1.5 w-1.5 rounded-full bg-text-tertiary dark:bg-text-tertiary-dark'
          }
        />
        <Text variant="caption" className="text-xs text-text-secondary dark:text-text-secondary-dark">
          {online ? 'Online' : 'Offline'}
        </Text>
      </View>

      {/* D-01: the list is boxed so a render failure inside it can never take the crisis
          card (below, outside the box) or the header's Help-now pill down with it. */}
      <MessageListBoundary>
        <MessageList messages={messages} />
      </MessageListBoundary>

        {crisisActive ? <CrisisCard onGetSupport={onRequestCrisis} hotline={hotline} /> : null}

        {!crisisActive && !needsSignIn && !consentDismissed ? (
          <ConsentBanner
            onDismiss={() => setConsentDismissed(true)}
            onRequireSignIn={onSignIn}
          />
        ) : null}

        {needsSignIn ? (
          <View
            className="mx-4 my-2 gap-3 rounded-2xl border border-border/50 bg-surface p-4 dark:border-border-dark/50 dark:bg-surface-dark"
            testID="mindmate-signin"
          >
            <Text variant="label" className="text-text-primary dark:text-text-primary-dark">
              {MINDMATE_COPY.signInTitle}
            </Text>
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              {MINDMATE_COPY.signInBody}
            </Text>
            <Button onPress={onSignIn} testID="mindmate-signin-cta">
              {MINDMATE_COPY.signInCta}
            </Button>
          </View>
        ) : error && !needsSignIn ? (
          <View className="mx-4 my-2 items-center gap-2" testID="mindmate-error">
            <Text
              variant="caption"
              className="text-center text-text-secondary dark:text-text-secondary-dark"
            >
              {error}
            </Text>
            <Button variant="secondary" size="sm" onPress={retry} testID="mindmate-retry">
              {MINDMATE_COPY.errorRetry}
            </Button>
          </View>
        ) : null}

        <ChatInput onSend={send} disabled={status === 'sending'} />
    </ToolScreen>
  );
}

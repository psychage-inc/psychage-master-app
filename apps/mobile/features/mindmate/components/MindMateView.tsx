import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

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
import { useAuth } from '@/features/auth';
import { AUTH_SIGN_IN_ROUTE } from '@/features/webview/auth-handshake';
import { storage } from '@/lib/adapters/storage';
import { useThemeColors } from '@/lib/use-theme-colors';

import type { MindMateConsentApi } from '../consent-api';
import { MINDMATE_CONSENT_CHANGE_SUMMARY } from '../consent-copy';
import { MINDMATE_COPY } from '../copy';
import type { sendMessage } from '../mindmate-service';
import { getMindMateConsentApi } from '../production-consent-api';
import { type UseMindMateChatOptions, useMindMateChat } from '../useMindMateChat';
import { useMindMateConsent } from '../useMindMateConsent';
import { ChatInput } from './ChatInput';
import { ConsentBanner } from './ConsentBanner';
import { ConsentScreen } from './ConsentScreen';
import { type CrisisHotline, CrisisCard } from './CrisisCard';
import { MessageList } from './MessageList';
import { MessageListBoundary } from './MessageListBoundary';
import { ReconsentScreen } from './ReconsentScreen';

// S-MM MindMate screen. NATIVE chat (message list + composer), mascot-fronted.
// GlobalHeader carries the always-visible Help-now pill → the crisis surface is
// reachable throughout (SR-1). A CrisisCard also drops inline the instant a crisis
// is detected (client pre-check OR server verdict) and takes priority over the AI.
//
// CONSENT GATE (compliance item 5): for a signed-in user the server's consent status
// decides what renders — 'current' → the chat; 'none' → the consent screen before
// any message; 'outdated' → the re-consent screen; a failed status load → an error
// with Retry, never the chat. A 403 CONSENT_REQUIRED from the chat endpoint re-checks
// the status and returns the user to the consent flow with the unsent text kept in
// the composer. Signed out, no consent RPC runs (it needs a session) and nothing can
// reach the model: the send path stops at the existing sign-in prompt.
//
// Callback-driven (onRequestCrisis/onSignIn/onBack/sendImpl/consentApi injectable) so
// the screen renders + tests without an expo-router or network context.

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
  /** Injectable consent RPCs for tests; defaults to the real Supabase-backed API. */
  getConsentApi?: () => MindMateConsentApi;
  /** Re-consent summary; defaults to this build's MINDMATE_CONSENT_CHANGE_SUMMARY. */
  consentChangeSummary?: string | null;
};

export function MindMateView({
  region,
  onRequestCrisis = () => router.push('/crisis'),
  onSignIn = () => router.push(AUTH_SIGN_IN_ROUTE),
  onBack = () => router.back(),
  sendImpl,
  persistImpl,
  getConsentApi = getMindMateConsentApi,
  consentChangeSummary = MINDMATE_CONSENT_CHANGE_SUMMARY,
}: MindMateViewProps) {
  const activeRegion = region ?? resolveActiveRegion();
  const hotline = resolvePrimaryHotline(activeRegion);
  const online = useIsOnline();
  const tc = useThemeColors();
  const [consentDismissed, setConsentDismissed] = useState(false);
  const { session } = useAuth();
  const consent = useMindMateConsent({ signedIn: session !== null, getApi: getConsentApi });
  // 'outdated' → the re-consent prompt first; "Review and agree" flips to the full text.
  const [reviewingConsent, setReviewingConsent] = useState(false);
  // Text the server refused with CONSENT_REQUIRED — returned to the composer.
  const [draft, setDraft] = useState('');

  const { messages, status, error, crisisActive, needsSignIn, send, retry } = useMindMateChat({
    region: activeRegion,
    onCrisis: onRequestCrisis,
    sendImpl,
    persistImpl,
    onConsentRequired: (unsentText) => {
      setDraft(unsentText);
      setReviewingConsent(false);
      consent.reload();
    },
  });

  const onSend = (text: string) => {
    setDraft('');
    void send(text);
  };

  const gate = consent.state;
  const chatOpen =
    gate.kind === 'signed-out' || (gate.kind === 'ready' && gate.status === 'current');

  let gateBody: ReactNode = null;
  if (gate.kind === 'loading') {
    gateBody = (
      <View className="flex-1 items-center justify-center" testID="mindmate-consent-loading">
        <ActivityIndicator accessibilityLabel={MINDMATE_COPY.consentLoadingLabel} color={tc.primary} />
      </View>
    );
  } else if (gate.kind === 'error') {
    gateBody = (
      <View className="flex-1 items-center justify-center gap-3 px-6" testID="mindmate-consent-load-error">
        <Text variant="body" className="text-center">
          {MINDMATE_COPY.consentLoadFailed}
        </Text>
        <Button variant="secondary" onPress={consent.reload} testID="mindmate-consent-retry">
          {MINDMATE_COPY.consentRetry}
        </Button>
      </View>
    );
  } else if (gate.kind === 'ready' && (gate.status === 'none' || reviewingConsent)) {
    gateBody = <ConsentScreen onAgree={consent.grant} onNotNow={onBack} />;
  } else if (gate.kind === 'ready' && gate.status === 'outdated') {
    gateBody = (
      <ReconsentScreen
        summary={consentChangeSummary}
        onReview={() => setReviewingConsent(true)}
        onTurnOff={async () => {
          await consent.withdraw();
          onBack();
        }}
      />
    );
  }

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

      {chatOpen ? (
        // D-01: the list is boxed so a render failure inside it can never take the crisis
        // card (below, outside the box) or the header's Help-now pill down with it.
        <MessageListBoundary>
          <MessageList messages={messages} onHelpNow={onRequestCrisis} />
        </MessageListBoundary>
      ) : (
        gateBody
      )}

        {crisisActive ? <CrisisCard onGetSupport={onRequestCrisis} hotline={hotline} /> : null}

        {chatOpen && !crisisActive && !needsSignIn && !consentDismissed ? (
          <ConsentBanner
            onDismiss={() => setConsentDismissed(true)}
            onRequireSignIn={onSignIn}
          />
        ) : null}

        {!chatOpen ? null : needsSignIn ? (
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

        {chatOpen ? (
          <ChatInput onSend={onSend} disabled={status === 'sending'} initialValue={draft} />
        ) : null}
    </ToolScreen>
  );
}

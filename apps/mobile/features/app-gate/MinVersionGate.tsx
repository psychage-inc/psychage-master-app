// Minimum-app-version startup gate. Mounted in the root layout AROUND the app's
// routes: nothing behind it renders until the check passes.
//
//   • checking          → neutral loading screen
//   • below the minimum → full-screen, non-dismissable "Update required" screen
//   • RPC error / not a valid semver / no client / unknown platform
//                       → error screen whose Retry re-runs the check (no fail-open)
//   • equal or above    → the app
//
// Crisis help is never gated (SR-2): every screen this gate renders carries a
// visible "call or text 988" action that opens the platform dialer / messages app
// directly — it cannot route to /crisis, because no app route renders behind the gate.

import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { dial } from '@/features/crisis/dialer';
import { smsUrl, telUrl } from '@/features/crisis/intents';
import { withTimeout } from '@/features/directory/queries';
import { evaluateVersionGate } from '@/lib/app-version/semver';
import { colors } from '@/lib/colors';
import { getSupabaseClient } from '@/lib/supabase';

export const MIN_VERSION_COPY = {
  checking: 'Checking for updates…',
  updateTitle: 'Update required',
  updateBody: 'Update Psychage to keep using it. This version is no longer supported.',
  errorTitle: "We couldn't check for updates",
  errorBody: 'Check your connection and try again.',
  retry: 'Retry',
  crisisLead: 'Help now: call or text 988',
  crisisCall: 'Call 988',
  crisisText: 'Text 988',
} as const;

const t = MIN_VERSION_COPY;
const CRISIS_NUMBER = '988';

/** Resolve the gate decision. Throws on every failure so the UI shows the retryable error. */
export async function checkMinAppVersion(): Promise<'ok' | 'update-required'> {
  const platform = Platform.OS;
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`Minimum version check is unsupported on ${platform}`);
  }
  const client = getSupabaseClient();
  if (!client) throw new Error('Minimum version check is unavailable: Supabase is not configured.');

  const { data, error } = await withTimeout(client.rpc('get_min_app_version', { p_platform: platform }));
  if (error) throw new Error(`get_min_app_version failed: ${error.message}`);

  const result = evaluateVersionGate(Application.nativeApplicationVersion, data);
  if (result === 'error') throw new Error('Installed or minimum app version is not a valid semver');
  return result;
}

function CrisisAction() {
  return (
    <View className="w-full items-center gap-2 border-t border-border pt-5 dark:border-border-dark" testID="gate-crisis">
      <Text variant="label" className="text-center">
        {t.crisisLead}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.crisisCall}
          onPress={() => dial(telUrl(CRISIS_NUMBER))}
          testID="gate-crisis-call"
          className="min-h-[44px] items-center justify-center rounded-xl border border-error px-5 active:opacity-80 dark:border-error-dark"
        >
          <Text variant="label" className="text-error dark:text-error-dark">
            {t.crisisCall}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.crisisText}
          onPress={() => dial(smsUrl(CRISIS_NUMBER))}
          testID="gate-crisis-text"
          className="min-h-[44px] items-center justify-center rounded-xl border border-error px-5 active:opacity-80 dark:border-error-dark"
        >
          <Text variant="label" className="text-error dark:text-error-dark">
            {t.crisisText}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GateScreen({ testID, children }: { testID: string; children: ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-8 bg-background px-6 dark:bg-background-dark" testID={testID}>
      <View className="w-full items-center gap-3">{children}</View>
      <CrisisAction />
    </View>
  );
}

export function MinVersionGate({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['app', 'min-version', Platform.OS],
    queryFn: checkMinAppVersion,
    // Fail fast: one attempt, then the error screen's Retry re-runs it.
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  const passed = query.data === 'ok';

  // The native splash otherwise hides only once auth hydrates — which never mounts
  // while the gate blocks. Hide it so the gate (and its crisis action) is visible.
  useEffect(() => {
    if (!passed) void SplashScreen.hideAsync();
  }, [passed]);

  if (passed) return <>{children}</>;

  if (query.data === 'update-required') {
    return (
      <GateScreen testID="gate-update-required">
        <Text variant="h1" className="text-center" accessibilityRole="header">
          {t.updateTitle}
        </Text>
        <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
          {t.updateBody}
        </Text>
      </GateScreen>
    );
  }

  if (query.isFetching || query.isPending) {
    return (
      <GateScreen testID="gate-checking">
        <ActivityIndicator color={colors.primary.default.light} />
        <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
          {t.checking}
        </Text>
      </GateScreen>
    );
  }

  return (
    <GateScreen testID="gate-error">
      <Text variant="h2" className="text-center" accessibilityRole="header">
        {t.errorTitle}
      </Text>
      <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
        {t.errorBody}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.retry}
        onPress={() => void query.refetch()}
        testID="gate-retry"
        className="mt-2 min-h-[44px] items-center justify-center rounded-xl bg-primary px-6 active:opacity-80 dark:bg-primary-dark"
      >
        <Text variant="label" className="text-white">
          {t.retry}
        </Text>
      </Pressable>
    </GateScreen>
  );
}

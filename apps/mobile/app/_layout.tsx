import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colorScheme, useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import '../global.css';

import { Text } from '@/components/ui/Text';

// Side-effect import: loading featureFlags.ts executes loadTierFlags(storage)
// at module init, which runs the SR-13 migrator before any consumer reads isTierEnabled.
import '@/lib/adapters/featureFlags';

import { AuthProvider, useAuth } from '@/features/auth';
import { useAuthDeepLinks } from '@/lib/auth/deep-link';
import { useSessionRevalidation } from '@/lib/auth/session-revalidate';
import { HapticProvider } from '@/lib/haptic-context';
import { queryClient } from '@/lib/query';
import { useAppearance } from '@/lib/use-appearance';
import { resolveColorScheme } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';

SplashScreen.preventAutoHideAsync();

// Root render-error fallback (Expo Router catches a thrown render here instead of
// showing a blank/red screen in production). Copy is generic chrome — never
// diagnostic. We do NOT log `error` anywhere: per Sacred Rule #11 the message could
// carry symptom/PII context, and Sentry's beforeSend hasn't been audited for this
// path. `retry` re-mounts the segment.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6 dark:bg-background-dark">
      <Text variant="h2" className="text-center text-text-primary dark:text-text-primary-dark">
        Something went wrong
      </Text>
      <Text
        variant="body"
        className="text-center text-text-secondary dark:text-text-secondary-dark"
      >
        Please try again. If it keeps happening, restarting the app usually helps.
      </Text>
      {__DEV__ ? (
        <Text variant="caption" className="text-center text-text-tertiary dark:text-text-tertiary-dark">
          {error.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={retry}
        className="mt-2 rounded-xl bg-primary px-5 py-3 active:opacity-80 dark:bg-primary-dark"
      >
        <Text variant="label" className="text-white">
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

// Bridges the persisted appearance `mode` onto NativeWind's runtime color scheme.
// Effect re-runs whenever the S45 toggle changes `mode`; `colorScheme.set` is the
// imperative apply that `darkMode: 'class'` (tailwind.config.js) makes legal.
function AppearanceSync() {
  const { mode } = useAppearance();
  useEffect(() => {
    colorScheme.set(resolveColorScheme(mode));
  }, [mode]);
  return null;
}

// Status-bar glyphs must contrast the canvas: light glyphs on the dark/true-black
// canvas, dark glyphs on the light canvas. Reads NativeWind's resolved scheme so
// it tracks both manual overrides and 'system'.
function ThemedStatusBar() {
  const { colorScheme: scheme } = useColorScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

// App-root auth wiring (mounted inside AuthProvider, under the navigator):
//   • deep links — verification + password-reset emails (WS-B)
//   • foreground >24h session revalidation (WS-C / rules/auth.md §6)
//   • splash gate — hold the native splash until session hydration completes (fonts are
//     already loaded by the time this mounts), so the app never flashes signed-out.
function AuthEffects() {
  const { hydrated } = useAuth();
  useAuthDeepLinks();
  useSessionRevalidation();
  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);
  return null;
}

export default function RootLayout() {
  const reduced = useReducedMotion();
  // DD-001 typography lock: IBM Plex Sans (OFL) body/UI, Fraunces (OFL) display.
  // Each cut registers under its expo-google-fonts export name; NativeWind's
  // `font-sans` → IBMPlexSans_400Regular and `font-display` → Fraunces_600SemiBold
  // resolve via tokens/mobile.tokens.json type.family. The mono token was dropped
  // (no production use). The prior bundled brand typeface was removed per DD-001 —
  // its ITF/Fontshare EULA does not clearly cover app-binary embedding.
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_700Bold,
    Fraunces_600SemiBold,
  });

  // Splash now hides on session hydration (AuthEffects), not on fonts alone — but we
  // still hold the tree until fonts SETTLE so AuthProvider mounts with type ready.
  // A font-load failure must not hang the native splash forever: per expo-font's
  // documented pattern, `loaded || error` counts as settled — on error we proceed
  // and render with system fonts.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <HapticProvider>
        <AppearanceSync />
        <ThemedStatusBar />
        {/* App-wide auth context (web parity): one provider at the root so every
            screen — Settings included — reads the same hydrated session. Replaces
            the former (auth)-group-local provider that left the rest of the app
            seeing session:null. */}
        <AuthProvider>
          <AuthEffects />
          <View className="flex-1 w-full max-w-[600px] mx-auto overflow-hidden bg-background dark:bg-background-dark sm:border-x sm:border-border/20 dark:sm:border-border-dark/20">
            <Stack
              screenOptions={{
                headerShown: false,
                animation: reduced ? 'fade' : 'slide_from_right',
                fullScreenGestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" />
            </Stack>
          </View>
        </AuthProvider>
      </HapticProvider>
    </QueryClientProvider>
  );
}

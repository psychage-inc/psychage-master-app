import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GlobalHeader } from '@/components/GlobalHeader';
import { Text } from '@/components/ui/Text';
import {
  AUTH_SIGN_IN_ROUTE,
  type WvtIssuer,
  WvtUnavailableError,
  stubWvtIssuer,
} from '@/features/webview/auth-handshake';
import { CT4_WEBVIEW } from '@/features/webview/copy';
import { type SurfaceSlug, SURFACES } from '@/features/webview/surfaces';
import { WebViewError } from '@/features/webview/WebViewError';
import { WebViewSkeleton } from '@/features/webview/WebViewSkeleton';
import {
  INITIAL_WV_LOAD_STATE,
  WV_LOAD_GRACE_MS,
  WV_STILL_LOADING_MS,
  type WvLoadEvent,
  wvLoadReducer,
} from '@/features/webview/wv-load-machine';
import { WV_ORIGIN, type WvTheme, buildWebViewUrl } from '@/features/webview/wv-url';
import { OfflineFallback } from '@/features/offline/OfflineFallback';
import { useIsOnline } from '@/features/offline/useIsOnline';
import { colorForScheme, resolveColorRef } from '@/lib/a1-tokens';

// SYS-S8 WebView chrome (reduced template — NATIVE CHROME ONLY; the embedded /m/
// page is the web workstream's). ONE component parameterized per surface: Global
// Header (with the Help-now pill) + native back + the C-WV-LOAD treatment + the
// theming handshake (paper/night base BEFORE the page attaches — no white flash) +
// the deep-link auth handshake (stubbed) + the offline hand-off.
//
// lang is hardcoded 'en' — packages/i18n is not created yet (root CLAUDE.md §2).

type WebViewSurfaceProps = {
  surface: SurfaceSlug;
  /** e.g. { id } for the provider detail — appended to the path. */
  params?: Record<string, string>;
  /** Injectable for tests; defaults to the B2 stub that throws → routes to sign-in. */
  issuer?: WvtIssuer;
};

export function WebViewSurface({ surface, params, issuer = stubWvtIssuer }: WebViewSurfaceProps) {
  const { colorScheme } = useColorScheme();
  const theme: WvTheme = colorScheme === 'dark' ? 'dark' : 'light';
  // The themed base shown BEHIND the (transparent, hidden-until-loaded) WebView, so
  // the user sees paper/night and never a white flash. Resolved via a1-tokens (the
  // documented dynamic-style exception — a native backgroundColor, not a class).
  const baseBg = colorForScheme(resolveColorRef('color.background'), colorScheme);
  const insets = useSafeAreaInsets();

  const online = useIsOnline();
  const [state, dispatch] = useReducer(wvLoadReducer, INITIAL_WV_LOAD_STATE);
  const [wvt, setWvt] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const def = SURFACES[surface];
  const path = params?.id ? `${def.path}/${encodeURIComponent(params.id)}` : def.path;

  // Begin a load attempt: start the machine, arm a fresh timer pair (via `attempt`),
  // and issue the wvt. An AUTH failure routes to sign-in (B1 S34) — generic, no
  // token leak. The B2 stub throws WvtUnavailableError, which is NOT an auth
  // problem: bouncing every user (signed-in included) to /sign-in and then a
  // forever-skeleton made all three WebView surfaces dead ends (PR-057). The
  // gated case now renders an honest "not available yet" state instead.
  const start = useCallback(async () => {
    dispatch({ type: 'START' });
    setAttempt((a) => a + 1);
    try {
      const issue = await issuer.issue(surface);
      setWvt(issue.wvt);
    } catch (error) {
      if (error instanceof WvtUnavailableError) {
        setUnavailable(true);
        return;
      }
      router.push(AUTH_SIGN_IN_ROUTE);
    }
  }, [issuer, surface]);

  useEffect(() => {
    start();
  }, [start]);

  // Timers are armed per attempt (not per phase) so the 4s "still loading" clock is
  // not cleared by the 400ms grace→skeleton transition. The reducer gates each event
  // to the phase it applies to.
  useEffect(() => {
    if (attempt === 0) return;
    const grace = setTimeout(() => dispatch({ type: 'GRACE_ELAPSED' }), WV_LOAD_GRACE_MS);
    const still = setTimeout(() => dispatch({ type: 'STILL_ELAPSED' }), WV_STILL_LOADING_MS);
    return () => {
      clearTimeout(grace);
      clearTimeout(still);
    };
  }, [attempt]);

  // Auth-expired → SILENT re-handshake: reissue + reload with no skeleton re-show.
  const onMessage = (event: WebViewMessageEvent) => {
    if (event.nativeEvent.data !== 'auth_expired') return;
    dispatch({ type: 'AUTH_EXPIRED' });
    issuer
      .issue(surface)
      .then((issue) => {
        setWvt(issue.wvt);
        dispatch({ type: 'REISSUE_OK' });
      })
      .catch(() => dispatch({ type: 'REISSUE_FAIL' }));
  };

  const showSkeleton = state.phase === 'skeleton' || state.phase === 'stillLoading';

  return (
    <View className="flex-1 bg-background dark:bg-background-dark" style={{ backgroundColor: baseBg }}>
      <GlobalHeader />
      <View className="flex-row items-center px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CT4_WEBVIEW.back}
          onPress={() => router.back()}
          hitSlop={8}
          testID="wv-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2"
        >
          <ChevronLeft
            size={20}
            color={colorForScheme(resolveColorRef('color.text.secondary'), colorScheme)}
            strokeWidth={2}
          />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {CT4_WEBVIEW.back}
          </Text>
        </Pressable>
      </View>

      {unavailable ? (
        <View className="flex-1 items-center justify-center gap-3 p-8" testID="wv-unavailable">
          <Text variant="h2" className="text-center">
            {CT4_WEBVIEW.unavailableTitle}
          </Text>
          <Text
            variant="body"
            className="text-center text-text-secondary dark:text-text-secondary-dark"
          >
            {CT4_WEBVIEW.unavailableBody}
          </Text>
        </View>
      ) : !online ? (
        <OfflineFallback variant="offline" onRetry={start} testID="wv-offline" />
      ) : state.phase === 'error' ? (
        <WebViewError onRetry={start} />
      ) : (
        <View className="flex-1" style={{ backgroundColor: baseBg }}>
          {showSkeleton ? (
            <View className="absolute inset-0" pointerEvents="none">
              <WebViewSkeleton />
            </View>
          ) : null}
          {state.phase === 'stillLoading' ? (
            <View style={{ bottom: Math.max(24, insets.bottom + 12) }} className="absolute left-0 right-0 items-center" pointerEvents="none">
              <Text
                variant="caption"
                className="text-text-tertiary dark:text-text-tertiary-dark"
                testID="wv-still-loading"
              >
                {CT4_WEBVIEW.stillLoading}
              </Text>
            </View>
          ) : null}
          {wvt !== undefined ? (
            <WebView
              testID="wv-webview"
              source={{ uri: buildWebViewUrl(WV_ORIGIN, path, { wvt, theme, lang: 'en' }) }}
              onLoadEnd={() => dispatch({ type: 'LOAD_END' } as WvLoadEvent)}
              onError={() => dispatch({ type: 'LOAD_ERROR' } as WvLoadEvent)}
              onHttpError={() => dispatch({ type: 'LOAD_ERROR' } as WvLoadEvent)}
              onMessage={onMessage}
              style={{ flex: 1, backgroundColor: 'transparent', opacity: state.phase === 'loaded' ? 1 : 0 }}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

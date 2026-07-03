import { View } from 'react-native';

import { ScreenShell } from '@/components/ui/ScreenShell';
import FindCareScreen from '@/features/find/FindCareScreen';
import { OfflineFallback } from '@/features/offline/OfflineFallback';
import { useIsOnline } from '@/features/offline/useIsOnline';

// S28 Find tab — the full provider-discovery experience (location → state → city →
// type → results → profile → compare), a faithful port of the FindCare prototype
// wired to real shared-Supabase data. It renders its own header (the tabs
// GlobalHeader is hidden for this tab in (tabs)/_layout.tsx). Online-only per
// rules/offline.md; offline shows the honest fallback — as an opaque OVERLAY, so
// FindCareScreen stays mounted and the wizard's step state survives a momentary
// connectivity blip (removed again on reconnect).
export default function FindScreen() {
  const online = useIsOnline();

  return (
    <View className="flex-1">
      {/* Hidden from assistive tech while the offline overlay covers it — the
          overlay only hides the wizard VISUALLY; without these props a screen-
          reader can swipe into covered controls that would fail offline. */}
      <View
        className="flex-1"
        importantForAccessibility={online ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!online}
      >
        <FindCareScreen />
      </View>
      {!online ? (
        <View className="absolute inset-0 bg-background dark:bg-background-dark" accessibilityViewIsModal>
          <ScreenShell edges={['top', 'bottom']}>
            <OfflineFallback variant="offline" testID="find-offline" />
          </ScreenShell>
        </View>
      ) : null}
    </View>
  );
}

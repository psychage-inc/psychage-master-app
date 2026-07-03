import { Stack } from 'expo-router';

import { GlobalHeader } from '@/components/GlobalHeader';
import { useReducedMotion } from '@/lib/motion';

// Today tab stack. The GlobalHeader (wordmark + Help-now pill + avatar) is the
// header for the landing only; pushed detail screens (history, reflection, read)
// render their own chrome. Nesting these under the tab is what keeps the bottom
// bar present when the user drills in — the former root-level placement rendered
// them outside the Tabs navigator, so the bar vanished. Animation mirrors the root
// stack and honors reduced motion. initialRouteName keeps deep links to nested
// routes (history, reflection) mounting the landing beneath them so Back works.
export const unstable_settings = { initialRouteName: 'index' };

export default function TodayStackLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'fade' : 'slide_from_right',
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: true, header: () => <GlobalHeader /> }} />
    </Stack>
  );
}

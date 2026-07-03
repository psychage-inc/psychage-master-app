import { Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { CT4_SETTINGS } from '@/features/settings/copy';
import { goBackOr } from '@/lib/nav';
import { useThemeColors } from '@/lib/use-theme-colors';
import { useReducedMotion } from '@/lib/motion';

// Settings stack (Flow 18). Pushed over the tabs as its own stack, so it carries
// a native header (back chevron + title) instead of the GlobalHeader. Titles +
// the S44 modal presentation are declared once here; PR B (privacy/delete) and
// PR C (supporter) add only their route FILES — these option entries are already
// in place so those PRs never touch this layout.
export default function SettingsLayout() {
  const t = CT4_SETTINGS;
  const tc = useThemeColors();
  const reduced = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        animation: reduced ? 'fade' : 'default',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t.hub.title,
          // `index` is the root of this stack, so it gets no native back chevron.
          // The settings stack is pushed over the tabs, so back pops to wherever the
          // user opened Settings from (GlobalHeader avatar → tabs). goBackOr covers a
          // deep-link cold start into /settings, where there is nothing to pop.
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => goBackOr('/')}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center"
            >
              <ChevronLeft size={24} color={tc.ink} strokeWidth={1.75} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="reminders" options={{ title: t.reminders.title }} />
      <Stack.Screen
        name="make-it-yours"
        options={{
          title: t.makeItYours.title,
          presentation: reduced ? 'transparentModal' : 'modal',
          animation: reduced ? 'fade' : 'default',
        }}
      />
      <Stack.Screen name="appearance" options={{ title: t.appearance.title }} />
      <Stack.Screen name="about" options={{ title: t.about.title }} />
      <Stack.Screen name="terms" options={{ title: t.legal.termsTitle }} />
      <Stack.Screen name="privacy-policy" options={{ title: t.legal.privacyTitle }} />
      <Stack.Screen name="disclaimer" options={{ title: t.legal.disclaimerTitle }} />
      <Stack.Screen name="acknowledgments" options={{ title: t.acknowledgments.title }} />
      {/* PR B */}
      <Stack.Screen name="privacy" options={{ title: t.hub.rows.privacy }} />
      <Stack.Screen name="delete" options={{ title: 'Delete' }} />
      <Stack.Screen
        name="delete-confirm"
        options={{
          title: 'Delete',
          presentation: reduced ? 'transparentModal' : 'modal',
          animation: reduced ? 'fade' : 'default',
        }}
      />
      {/* PR C */}
      <Stack.Screen name="supporter" options={{ title: t.hub.rows.supporter }} />
    </Stack>
  );
}

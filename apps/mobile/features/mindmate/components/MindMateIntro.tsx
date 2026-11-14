import { LifeBuoy } from 'lucide-react-native';
import { View } from 'react-native';

import { Mascot } from '@/components/home/Mascot';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Text } from '@/components/ui/Text';
import { MASCOT_CONTEXTUAL } from '@/features/mascot';
import { useThemeColors } from '@/lib/use-theme-colors';

import { MINDMATE_GREETING_HELP_NOW, MINDMATE_SESSION_GREETING } from '../consent-copy';
import { MINDMATE_COPY } from '../copy';

// Session start — the mascot fronts MindMate, followed by the AI-disclosure greeting
// (compliance item 5) with a Help Now control right next to it. It is the first row of
// every session's transcript, so it stays at the top of the conversation.
export function MindMateIntro({ onHelpNow }: { onHelpNow: () => void }) {
  const tc = useThemeColors();
  return (
    <View className="items-center gap-4 px-6 py-10" testID="mindmate-intro">
      {/* Contextual placement (see MASCOT_CONTEXTUAL): MindMate idle surface → 'listening',
          explicit because /tools/mindmate is not a route-auto presence. */}
      <Mascot testID="mindmate-mascot" state={MASCOT_CONTEXTUAL.mindmateIdle} />
      <Text
        variant="h1"
        accessibilityRole="header"
        className="text-center text-text-primary dark:text-text-primary-dark"
      >
        {MINDMATE_COPY.title}
      </Text>
      <Text
        variant="body"
        className="text-center text-text-secondary dark:text-text-secondary-dark"
        testID="mindmate-greeting"
      >
        {MINDMATE_SESSION_GREETING}
      </Text>
      {/* Crisis affordance: outline only, never a red fill, no haptic (CrisisPill parity). */}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={MINDMATE_GREETING_HELP_NOW}
        onPress={onHelpNow}
        hitSlop={4}
        scaleTo={0.96}
        activeOpacity={0.85}
        springPreset="subtle"
        className="min-h-[44px] flex-row items-center gap-1.5 rounded-full border border-crisis px-4 dark:border-crisis-dark"
        testID="mindmate-greeting-help-now"
      >
        <LifeBuoy size={18} color={tc.crisis} strokeWidth={1.75} />
        <Text variant="bodyLarge" className="text-[14px] text-crisis dark:text-crisis-dark">
          {MINDMATE_GREETING_HELP_NOW}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

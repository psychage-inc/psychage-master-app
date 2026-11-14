import { ArrowLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors } from '@/lib/colors';

import { CrisisCallRow } from './components/CrisisCallRow';
import { EmergencyButton } from './components/EmergencyButton';
import { CRISIS_COPY } from './copy';
import type { Dial } from './dialer';
import type { HelplineRow } from './helpline-schema';

// S11 — the crisis screen, presentational (no navigation hooks, so it unit-tests
// bare). PLAIN register: NO mascot, NO teal, NO gradient/softness/animation. Exactly
// ONE filled rust element (the emergency button); helpline actions are rust-outline.
// Reduced-motion == full-motion by design (there is no motion here).
//
// VoiceOver order: lead → call → helplines (the content sequence below). The Back
// control sits above as a standard nav affordance.
//
// All visible copy is VERBATIM Flow Book (Flow 6), now sourced from ./copy (CT4 §8).

const LEAD = CRISIS_COPY.lead;
const EMERGENCY_LABEL = CRISIS_COPY.callEmergency;
const HELPLINES_INTRO = CRISIS_COPY.helplinesIntro;

export interface CrisisViewProps {
  readonly regionName: string;
  readonly emergencyNumber: string;
  readonly helplines: readonly HelplineRow[];
  readonly onBack: () => void;
  readonly onChangeRegion: () => void;
  /** Injectable dialer for render tests; defaults to the platform dialer downstream. */
  readonly dial?: Dial;
}

export function CrisisView({
  regionName,
  emergencyNumber,
  helplines,
  onBack,
  onChangeRegion,
  dial,
}: CrisisViewProps) {
  const { colorScheme } = useColorScheme();
  // Ink (not teal) is the only accent in the crisis register.
  const ink = colorScheme === 'dark' ? colors.text.primary.dark : colors.text.primary.light;
  const hasHelp = helplines.length > 0;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-4 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CRISIS_COPY.back}
          onPress={onBack}
          hitSlop={8}
          className="min-h-[44px] w-11 justify-center"
        >
          <ArrowLeft size={24} color={ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 mt-2">
        <View className="gap-1">
          <Text variant="h1" accessibilityRole="header">
            {regionName}
          </Text>
          <Text variant="bodyLarge" className="text-text-secondary dark:text-text-secondary-dark">
            {CRISIS_COPY.heading}
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-surface p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <Text variant="body" className="mb-4">
            {LEAD}
          </Text>
          <EmergencyButton emergencyNumber={emergencyNumber} label={EMERGENCY_LABEL} dial={dial} />
        </View>

        {hasHelp ? (
          <View className="gap-2">
            <Text variant="bodyLarge" className="mb-2 text-text-secondary dark:text-text-secondary-dark">
              {HELPLINES_INTRO}
            </Text>
            {helplines.map((row) => (
              <CrisisCallRow key={`${row.region}:${row.name}`} row={row} dial={dial} />
            ))}
          </View>
        ) : (
          <View className="rounded-xl border border-border bg-surface p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark">
            <Text variant="body">{CRISIS_COPY.gapState(regionName)}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={CRISIS_COPY.notInRegion(regionName)}
          onPress={onChangeRegion}
          hitSlop={8}
          className="min-h-[44px] justify-center active:scale-[0.98]"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            variant="caption"
            className="text-text-secondary underline dark:text-text-secondary-dark"
          >
            {CRISIS_COPY.notInRegion(regionName)}
          </Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

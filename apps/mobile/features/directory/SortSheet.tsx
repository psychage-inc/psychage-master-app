import { Check } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/lib/use-theme-colors';

import { DIRECTORY_COPY } from './copy';

// Directory sort sheet. Renders UNDER the GlobalHeader so the Help-now pill stays
// reachable (SR-2). Options map to search_providers_v3 sort_by. There is no
// distance sort — the app never reads device location. Sorting is order, never a
// quality ranking.

const t = DIRECTORY_COPY;

export type SortOption = 'relevance' | 'name';

export function SortSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: SortOption;
  onSelect: (next: SortOption) => void;
  onClose: () => void;
}) {
  const tc = useThemeColors();
  const options: { key: SortOption; label: string }[] = [
    { key: 'relevance', label: t.sortRelevance },
    { key: 'name', label: t.sortName },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* @design-purpose: modal scrim dimming the screen behind the sort sheet */}
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-background px-4 pb-6 pt-4 dark:bg-background-dark">
          <View className="mb-1 flex-row items-center justify-between">
            <Text variant="h2">{t.sortTitle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
              <Text variant="caption" className="text-primary dark:text-primary-dark">
                Done
              </Text>
            </Pressable>
          </View>
          <Text variant="caption" className="mb-2 text-text-tertiary dark:text-text-tertiary-dark">
            {t.sortNote}
          </Text>

          {options.map((o) => {
            const selected = o.key === value;
            return (
              <Pressable
                key={o.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={o.label}
                onPress={() => onSelect(o.key)}
                testID={`sort-${o.key}`}
                className="min-h-[44px] flex-row items-center justify-between border-b border-border py-3 dark:border-border-dark"
              >
                <Text variant="body">{o.label}</Text>
                {selected ? <Check size={18} color={tc.primary} strokeWidth={2} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

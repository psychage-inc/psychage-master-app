import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors } from '@/lib/colors';

import { useSpecialties } from './hooks';

// Directory filter sheet (specialty / location / modality). Renders UNDER the
// GlobalHeader so the Help-now pill stays reachable (SR-2). All values map to
// search_providers_v3 inputs; nothing is persisted.

export interface FilterDraft {
  state: string;
  specialtySlugs: string[];
  telehealth: boolean;
  inPerson: boolean;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[36px] justify-center rounded-full border px-3 py-1.5 ${
        selected ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
    >
      <Text
        variant="caption"
        className={selected ? 'text-primary dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DirectoryFilters({
  visible,
  initial,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: FilterDraft;
  onApply: (next: FilterDraft) => void;
  onClose: () => void;
}) {
  const specialties = useSpecialties();
  const [draft, setDraft] = useState<FilterDraft>(initial);

  // Re-seed the draft each time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const toggleSpecialty = (slug: string) =>
    setDraft((d) => ({
      ...d,
      specialtySlugs: d.specialtySlugs.includes(slug)
        ? d.specialtySlugs.filter((s) => s !== slug)
        : [...d.specialtySlugs, slug],
    }));

  const clearAll = () =>
    setDraft({ state: '', specialtySlugs: [], telehealth: false, inPerson: false });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* @design-purpose: modal scrim dimming the screen behind the filter sheet */}
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[80%] rounded-t-2xl bg-background px-4 pb-6 pt-4 dark:bg-background-dark">
          <View className="mb-3 flex-row items-center justify-between">
            <Text variant="h2">Filters</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" onPress={clearAll} hitSlop={8}>
              <Text variant="caption" className="text-primary dark:text-primary-dark">
                Clear all
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 pb-2">
            <View className="gap-2">
              <Text variant="bodyLarge">Modality</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Telehealth" selected={draft.telehealth} onPress={() => setDraft((d) => ({ ...d, telehealth: !d.telehealth }))} />
                <Chip label="In person" selected={draft.inPerson} onPress={() => setDraft((d) => ({ ...d, inPerson: !d.inPerson }))} />
              </View>
            </View>

            <View className="gap-2">
              <Text variant="bodyLarge">State</Text>
              <TextInput
                accessibilityLabel="Filter by state"
                value={draft.state}
                onChangeText={(v) => setDraft((d) => ({ ...d, state: v.toUpperCase().slice(0, 2) }))}
                placeholder="e.g. CA"
                placeholderTextColor={colors.charcoal[400]}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={2}
                className="min-h-[44px] rounded-lg border border-border bg-surface px-3 font-sans text-base text-text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark"
              />
            </View>

            {specialties.data && specialties.data.length > 0 ? (
              <View className="gap-2">
                <Text variant="bodyLarge">Specialties</Text>
                <View className="flex-row flex-wrap gap-2">
                  {specialties.data.map((s) => (
                    <Chip
                      key={s.slug}
                      label={s.label}
                      selected={draft.specialtySlugs.includes(s.slug)}
                      onPress={() => toggleSpecialty(s.slug)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" onPress={onClose}>
                Cancel
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" onPress={() => onApply(draft)}>
                Apply
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { BookmarkSaveSlot } from '@/features/bookmarks/BookmarkSaveSlot';

import { Avatar } from './Avatar';
import { DIRECTORY_COPY } from './copy';
import { cleanDisplayName } from './mapping';
import { getTrustBadge } from './trust';
import type { ProviderCardData } from './types';

// One directory result row. Renders REAL, verbatim provider fields — null fields
// are simply omitted, never filled. Framing is informational: a badge reflects the
// provider's own DB status, not a Psychage endorsement.

const t = DIRECTORY_COPY;

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-surface px-2 py-0.5 dark:bg-surface-dark">
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        {label}
      </Text>
    </View>
  );
}

function badgeLabel(status: string, verifiedAt: string | null): string | null {
  const badge = getTrustBadge({ status, verified_at: verifiedAt });
  if (badge === 'verified') return t.badgeVerified;
  if (badge === 'claimed') return t.badgeClaimed;
  if (badge === 'unclaimed') return t.badgeUnclaimed;
  return null;
}

export const ProviderCard = memo(function ProviderCard({
  provider,
  onPress,
}: {
  provider: ProviderCardData;
  onPress: (id: string) => void;
}) {
  const name = cleanDisplayName(provider.display_name) || provider.display_name;
  const place = [provider.primary_city, provider.primary_state].filter(Boolean).join(', ');
  const typeLine = [provider.provider_type_label, place].filter(Boolean).join(' · ');
  const badge = badgeLabel(provider.status, provider.verified_at);
  const specialties = provider.specialty_tags.slice(0, 3);

  // One node for the screen reader — name, creds, type/place, badge.
  const a11y = [name, provider.credentials_suffix, typeLine, badge]
    .filter(Boolean)
    .join(', ');

  return (
    <View className="flex-row items-center gap-2 border-b border-border py-3 dark:border-border-dark">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => onPress(provider.id)}
        testID={`provider-card-${provider.id}`}
        className="min-h-[44px] flex-1 flex-row items-center gap-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Avatar name={name} photoUrl={provider.photo_url} />

        <View className="flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row flex-wrap items-baseline">
              <Text variant="bodyLarge">{name}</Text>
              {provider.credentials_suffix ? (
                <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                  {`, ${provider.credentials_suffix}`}
                </Text>
              ) : null}
            </View>
            {badge ? <Tag label={badge} /> : null}
          </View>

          {typeLine ? (
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              {typeLine}
            </Text>
          ) : null}

          {(specialties.length > 0 || provider.telehealth_available || provider.in_person_available) && (
            <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
              {provider.telehealth_available ? <Tag label={t.telehealth} /> : null}
              {provider.in_person_available ? <Tag label={t.inPerson} /> : null}
              {specialties.map((s) => (
                <Tag key={s.slug} label={s.label} />
              ))}
            </View>
          )}
        </View>
      </Pressable>

      {/* Save from the list — anon tap opens the sign-in sheet (BookmarkSaveSlot). */}
      <BookmarkSaveSlot resourceType="provider" resourceId={provider.id} testID={`provider-card-save-${provider.id}`} />
    </View>
  );
});

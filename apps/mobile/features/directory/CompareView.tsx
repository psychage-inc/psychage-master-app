import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { GlobalHeader } from '@/components/GlobalHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useBookmarkedIds, useToggleBookmark } from '@/features/bookmarks/hooks';
import { colors } from '@/lib/colors';

import { Avatar } from './Avatar';
import { DIRECTORY_COPY } from './copy';
import { cleanDisplayName } from './mapping';
import { getProviderById } from './queries';
import { getTrustBadge } from './trust';
import type { ProviderWithDetails } from './types';

// S-compare — side-by-side comparison of the user's saved providers (max 3, the
// most recently saved). Reads REAL provider rows; null fields show an em dash,
// never a fabricated value. Informational only — no ranking, no endorsement.
// A pushed route (own GlobalHeader + back), so the crisis pill stays reachable.

const t = DIRECTORY_COPY;
const MAX_COMPARE = 3;

function formatVerified(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <GlobalHeader />
      <View className="flex-row items-center px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
          testID="compare-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2"
        >
          <ChevronLeft size={20} color={colors.charcoal[600]} strokeWidth={2} />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            Back
          </Text>
        </Pressable>
      </View>
      <Text variant="h1" className="px-4 pb-2">
        {t.compareTitle}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5 border-t border-border py-2 dark:border-border-dark">
      <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
        {label}
      </Text>
      <Text variant="caption">{value}</Text>
    </View>
  );
}

function Column({ p, onRemove }: { p: ProviderWithDetails; onRemove: () => void }) {
  const name = cleanDisplayName(p.display_name) || p.display_name;
  const loc = p.locations.find((l) => l.is_primary) ?? p.locations[0] ?? null;
  const place = loc ? [loc.city, loc.state_province].filter(Boolean).join(', ') : t.none;
  const modality = [p.telehealth_available ? t.telehealth : null, p.in_person_available ? t.inPerson : null]
    .filter(Boolean)
    .join(', ');
  const badge = getTrustBadge({ status: p.status, verified_at: p.verified_at });
  const verified = formatVerified(p.verified_at);
  const contact = p.phone ?? p.email ?? p.website_url ?? undefined;

  return (
    <View className="w-52 rounded-xl border border-border p-3 dark:border-border-dark">
      <View className="items-center gap-1.5">
        <Avatar name={name} photoUrl={p.photo_url} size="lg" />
        <Text variant="bodyLarge" numberOfLines={2} className="text-center">
          {name}
        </Text>
        {p.credentials_suffix ? (
          <Text variant="caption" className="text-center text-text-secondary dark:text-text-secondary-dark">
            {p.credentials_suffix}
          </Text>
        ) : null}
      </View>

      <View className="mt-2">
        <Field label={t.fieldType} value={p.provider_type?.label ?? t.none} />
        <Field label={t.fieldLocation} value={place} />
        <Field label={t.fieldModality} value={modality || t.none} />
        <Field label={t.npiLabel} value={p.npi_number ?? t.none} />
        <Field
          label={t.licenseLabel}
          value={[p.license_number, p.license_state].filter(Boolean).join(' · ') || t.none}
        />
        <Field
          label={t.fieldVerified}
          value={badge === 'verified' && verified ? verified : (badge ?? t.none)}
        />
      </View>

      <View className="mt-3 gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.useAsTherapist}
          onPress={() =>
            router.push({
              pathname: '/add-provider',
              params: { name, ...(contact ? { contact } : {}) },
            })
          }
          testID={`compare-link-${p.id}`}
          className="min-h-[44px] items-center justify-center rounded-lg border border-border py-2 dark:border-border-dark"
        >
          <Text variant="caption">{t.useAsTherapist}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.compareRemove} ${name}`}
          onPress={onRemove}
          testID={`compare-remove-${p.id}`}
          className="min-h-[44px] items-center justify-center py-2"
        >
          <Text variant="caption" className="text-primary dark:text-primary-dark">
            {t.compareRemove}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CompareView() {
  const { data: savedIds } = useBookmarkedIds('provider');
  const toggle = useToggleBookmark();

  const idList = useMemo(() => Array.from(savedIds ?? []).slice(0, MAX_COMPARE), [savedIds]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['providers', 'compare', idList],
    queryFn: async () => {
      // Settled per-id: one transient failure must not discard the columns that DID
      // load — the failed provider drops out with a notice. Only when nothing loads
      // at all do we throw, so TanStack Query surfaces the retryable error path.
      const settled = await Promise.allSettled(idList.map((id) => getProviderById(id)));
      const providers = settled
        .filter((r): r is PromiseFulfilledResult<ProviderWithDetails | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((r): r is ProviderWithDetails => r != null);
      const failedCount = settled.filter((r) => r.status === 'rejected').length;
      if (providers.length === 0 && failedCount > 0) {
        throw new Error('Saved providers could not be loaded.');
      }
      return { providers, failedCount };
    },
    enabled: idList.length > 0,
  });

  const remove = (id: string) =>
    toggle.mutate({ ref: { resource_type: 'provider', resource_id: id }, wasSaved: true });

  if (idList.length < 2) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Text variant="h2" className="text-center">
            {t.compareEmptyTitle}
          </Text>
          <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
            {t.compareEmptyBody}
          </Text>
        </View>
      </Chrome>
    );
  }

  // Load failure (connection / RPC) — recoverable, so offer a retry. Distinct from
  // the loader (still fetching) and the empty prompt (nothing saved yet).
  if (isError) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center gap-2 px-6" testID="compare-error">
          <Text variant="h2" className="text-center">
            Couldn't load these providers
          </Text>
          <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
            Check your connection and try again.
          </Text>
          <View className="pt-1">
            <Button variant="secondary" size="sm" onPress={() => void refetch()} testID="compare-retry">
              Try again
            </Button>
          </View>
        </View>
      </Chrome>
    );
  }

  if (isLoading || !data) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center" testID="compare-loading">
          <AppLoader />
        </View>
      </Chrome>
    );
  }

  return (
    <Chrome>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      >
        {data.providers.map((p) => (
          <Column key={p.id} p={p} onRemove={() => remove(p.id)} />
        ))}
      </ScrollView>
      {data.failedCount > 0 ? (
        <Text
          variant="caption"
          className="px-4 pb-1 text-text-tertiary dark:text-text-tertiary-dark"
          testID="compare-partial-notice"
        >
          Some saved providers couldn't be loaded right now.
        </Text>
      ) : null}
      {(savedIds?.size ?? 0) > MAX_COMPARE ? (
        <Text variant="caption" className="px-4 pb-3 text-text-tertiary dark:text-text-tertiary-dark">
          {t.compareCap}
        </Text>
      ) : null}
    </Chrome>
  );
}

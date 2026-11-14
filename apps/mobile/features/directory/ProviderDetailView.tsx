import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarCheck, ChevronLeft, Globe, Mail, MapPin, Navigation, Phone } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { GlobalHeader } from '@/components/GlobalHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { BookmarkSaveSlot } from '@/features/bookmarks/BookmarkSaveSlot';
import { dial } from '@/features/crisis/dialer';
import { colors } from '@/lib/colors';
import { useHaptics } from '@/lib/haptic-context';
import { useRecentlyViewed } from '@/lib/use-recently-viewed';

import { Avatar } from './Avatar';
import { directionsUrl, formatAddress, mailtoUrl, telUrl, webUrl } from './contact';
import { DIRECTORY_COPY } from './copy';
import { cleanDisplayName } from './mapping';
import { getProviderById } from './queries';
import { getTrustBadge } from './trust';
import type { ProviderLocation, ProviderWithDetails } from './types';

// S27 Provider detail — NATIVE (replaces the WebView wrapper). Renders REAL, verbatim
// provider fields from the shared Supabase. Contact actions open the platform handler
// from the provider's OWN stored values — never a typed-in or inferred number. Framing
// is informational only: no endorsement, no "verified by Psychage". GlobalHeader keeps
// the crisis pill reachable (SR-2).

const t = DIRECTORY_COPY;

function badgeLabel(p: { status: string; verified_at: string | null }): string | null {
  const badge = getTrustBadge({ status: p.status, verified_at: p.verified_at });
  if (badge === 'verified') return t.badgeVerified;
  if (badge === 'claimed') return t.badgeClaimed;
  if (badge === 'unclaimed') return t.badgeUnclaimed;
  return null;
}

function primaryLocation(p: ProviderWithDetails): ProviderLocation | null {
  return p.locations.find((l) => l.is_primary) ?? p.locations[0] ?? null;
}

/** ISO verified_at → "Jun 2025", or null when absent/unparseable. */
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
          testID="provider-back"
          className="min-h-[44px] flex-row items-center gap-1 px-2"
        >
          <ChevronLeft size={20} color={colors.charcoal[600]} strokeWidth={2} />
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            Back
          </Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

// A contact-action tile (call / website / directions / email / booking). Fires
// haptic.affirm before opening the platform handler — initiating contact is a
// meaningful commit, so it meets the sensorial floor (DESIGN.mobile.md §3.3).
function ContactActionTile({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { fireHaptic } = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        fireHaptic('affirm');
        onPress();
      }}
      testID={testID}
      className="min-h-[44px] flex-1 items-center gap-1 rounded-lg border border-border py-2 dark:border-border-dark"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {icon}
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text variant="bodyLarge">{title}</Text>
      {children}
    </View>
  );
}

function TagRow({ items }: { items: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {items.map((label) => (
        <View key={label} className="rounded-full bg-surface px-2.5 py-1 dark:bg-surface-dark">
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProviderDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['providers', 'detail', id],
    queryFn: () => getProviderById(id),
    enabled: !!id,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  // Record this view for the directory's "recently viewed" rail (local, capped).
  const { record } = useRecentlyViewed();
  useEffect(() => {
    if (!data) return;
    record({
      id: data.id,
      name: cleanDisplayName(data.display_name) || data.display_name,
      photoUrl: data.photo_url,
    });
  }, [data, record]);

  if (isLoading) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center" testID="provider-loading">
          <AppLoader />
        </View>
      </Chrome>
    );
  }

  // Load failure (connection/RPC) is recoverable — offer a retry, kept distinct from a
  // genuine not-found (listing removed), which is not.
  if (isError) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center gap-4 px-6" testID="provider-error">
          <Text variant="h2" className="text-center">
            This listing didn't load
          </Text>
          <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
            Check your connection and try again.
          </Text>
          <Button onPress={() => void refetch()}>Try again</Button>
        </View>
      </Chrome>
    );
  }

  if (!data) {
    return (
      <Chrome>
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Text variant="h2" className="text-center">
            {t.notFoundTitle}
          </Text>
          <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
            {t.notFoundBody}
          </Text>
        </View>
      </Chrome>
    );
  }

  const p = data;
  const name = cleanDisplayName(p.display_name) || p.display_name;
  const loc = primaryLocation(p);
  const badge = badgeLabel(p);
  const place = loc ? [loc.city, loc.state_province].filter(Boolean).join(', ') : '';
  const typeLine = [p.provider_type?.label, place].filter(Boolean).join(' · ');
  const address = formatAddress(loc);
  const mapsUrl = directionsUrl(loc);
  const site = webUrl(p.website_url);
  const booking = webUrl(p.appointment_url);

  // Best single contact to seed the My-Therapist record (real values only).
  const linkContact = p.phone ?? p.email ?? p.website_url ?? undefined;

  return (
    <Chrome>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-1" showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View className="flex-row gap-3">
          <Avatar name={name} photoUrl={p.photo_url} size="lg" />
          <View className="flex-1 gap-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text variant="h1" className="flex-1">
                {name}
              </Text>
              <View className="flex-row items-center gap-1">
                {badge ? (
                  <View className="rounded-full bg-surface px-2.5 py-1 dark:bg-surface-dark">
                    <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                      {badge}
                    </Text>
                  </View>
                ) : null}
                {/* Save this provider — resource_id is the provider id (T-008). */}
                <BookmarkSaveSlot resourceType="provider" resourceId={id} testID="provider-save" />
              </View>
            </View>
            {p.credentials_suffix ? (
              <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
                {p.credentials_suffix}
              </Text>
            ) : null}
            {typeLine ? (
              <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
                {typeLine}
              </Text>
            ) : null}
            {p.practice_name ? (
              <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
                {p.practice_name}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Modality */}
        {(p.telehealth_available || p.in_person_available) && (
          <TagRow
            items={[
              ...(p.telehealth_available ? [t.telehealth] : []),
              ...(p.in_person_available ? [t.inPerson] : []),
            ]}
          />
        )}

        {/* Contact actions — REAL stored values only, conditional on presence */}
        {(p.phone || site || mapsUrl || p.email || booking) && (
          <Section title={t.contact}>
            <View className="flex-row flex-wrap gap-2">
              {p.phone ? (
                <ContactActionTile
                  testID="provider-call"
                  icon={<Phone size={18} color={colors.primary.default.light} strokeWidth={1.75} />}
                  label={t.call}
                  onPress={() => dial(telUrl(p.phone as string))}
                />
              ) : null}
              {site ? (
                <ContactActionTile
                  testID="provider-website"
                  icon={<Globe size={18} color={colors.primary.default.light} strokeWidth={1.75} />}
                  label={t.website}
                  onPress={() => dial(site)}
                />
              ) : null}
              {mapsUrl ? (
                <ContactActionTile
                  testID="provider-directions"
                  icon={<Navigation size={18} color={colors.primary.default.light} strokeWidth={1.75} />}
                  label={t.directions}
                  onPress={() => dial(mapsUrl)}
                />
              ) : null}
              {p.email ? (
                <ContactActionTile
                  testID="provider-email"
                  icon={<Mail size={18} color={colors.primary.default.light} strokeWidth={1.75} />}
                  label={t.email}
                  onPress={() => dial(mailtoUrl(p.email as string))}
                />
              ) : null}
              {booking ? (
                <ContactActionTile
                  testID="provider-booking"
                  icon={<CalendarCheck size={18} color={colors.primary.default.light} strokeWidth={1.75} />}
                  label={t.booking}
                  onPress={() => dial(booking)}
                />
              ) : null}
            </View>
          </Section>
        )}

        {p.bio ? (
          <Section title={t.about}>
            <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
              {p.bio}
            </Text>
          </Section>
        ) : null}

        {p.specialties.length > 0 ? (
          <Section title={t.specialties}>
            <TagRow items={p.specialties.map((s) => s.label)} />
          </Section>
        ) : null}

        {p.languages.length > 0 ? (
          <Section title={t.languages}>
            <TagRow items={p.languages.map((l) => l.label)} />
          </Section>
        ) : null}

        {p.insurance_plans.length > 0 ? (
          <Section title={t.insurance}>
            <TagRow items={p.insurance_plans.map((i) => i.name)} />
          </Section>
        ) : null}

        {address ? (
          <Section title={t.locations}>
            <View className="flex-row items-start gap-1.5">
              <MapPin size={16} color={colors.charcoal[500]} strokeWidth={1.75} />
              <Text variant="body" className="flex-1 text-text-secondary dark:text-text-secondary-dark">
                {address}
              </Text>
            </View>
          </Section>
        ) : null}

        {/* Credentials & verification — provider's own registry data (informational). */}
        {(p.npi_number || p.license_number || p.verified_at) && (
          <Section title={t.credentialsTitle}>
            {p.npi_number ? (
              <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                {`${t.npiLabel} ${p.npi_number}`}
              </Text>
            ) : null}
            {p.license_number ? (
              <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
                {`${t.licenseLabel} ${[p.license_number, p.license_state].filter(Boolean).join(' · ')}`}
              </Text>
            ) : null}
            <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
              {(() => {
                const when = formatVerified(p.verified_at);
                return when ? `${t.npiSource} · ${t.lastConfirmed(when)}` : t.npiSource;
              })()}
            </Text>
          </Section>
        )}

        {/* Linkage → My Therapist (S39 pre-fill). Contact stays in-memory, never logged. */}
        <View className="pt-1">
          <Button
            variant="secondary"
            testID="provider-use-as-therapist"
            onPress={() =>
              router.push({
                pathname: '/add-provider',
                params: { name, ...(linkContact ? { contact: linkContact } : {}) },
              })
            }
          >
            {t.useAsTherapist}
          </Button>
          <Text variant="caption" className="pt-1.5 text-text-tertiary dark:text-text-tertiary-dark">
            {t.shareClarifier}
          </Text>
        </View>

        <Text variant="caption" className="pt-1 text-text-tertiary dark:text-text-tertiary-dark">
          {t.disclaimer}
        </Text>
      </ScrollView>
    </Chrome>
  );
}

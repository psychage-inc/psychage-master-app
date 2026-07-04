import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ArrowUpDown, ChevronDown, ChevronLeft, MapPin, Search, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { GlobalHeader } from '@/components/GlobalHeader';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useBookmarkedIds } from '@/features/bookmarks/hooks';
import { OfflineFallback } from '@/features/offline/OfflineFallback';
import { useIsOnline } from '@/features/offline/useIsOnline';
import { colors } from '@/lib/colors';

import { useRecentlyViewed } from '@/lib/use-recently-viewed';

import { DirectoryFilters, type FilterDraft } from './DirectoryFilters';
import { DIRECTORY_COPY } from './copy';
import { hasActiveSearch, useFeaturedProviders, useProviderSearch, useSpecialties } from './hooks';
import { DEFAULT_RADIUS_MILES, requestAndGetCoords, type Coords } from './location';
import { DirectorySkeleton } from './DirectorySkeleton';
import { ProviderCard } from './ProviderCard';
import { RecentlyViewedRail } from './RecentlyViewedRail';
import { SortSheet, type SortOption } from './SortSheet';
import type { ProviderSearchParams } from './types';

// Below this result count a scope is "thin" — we nudge the user to widen.
const COVERAGE_MIN = 25;

// S26 Provider Directory — NATIVE list (replaces the WebView wrapper). Reads REAL
// providers live from the shared Supabase. Filter-first: the paginated search runs
// only once the user narrows; the default surface is a small featured slice (the
// RPC cannot scan all 423k rows unscoped). GlobalHeader keeps the crisis pill one
// tap away (SR-2). Online-only per rules/offline.md.

const t = DIRECTORY_COPY;

const EMPTY_FILTERS: FilterDraft = {
  state: '',
  specialtySlugs: [],
  telehealth: false,
  inPerson: false,
  accepting: false,
};

// `embedded` = rendered as the Find tab root (the tabs GlobalHeader already sits
// above it, so we skip our own header + the back row). The standalone
// /find/directory deep-link route renders it un-embedded (own header + back).
// initialState/initialCity seed the browse scope from the persisted home location.
export function DirectoryView({
  embedded = false,
  initialState = null,
  initialCity = null,
  scopeLabel,
  onEditLocation,
}: {
  embedded?: boolean;
  initialState?: string | null;
  initialCity?: string | null;
  /** Human label for the current home scope (e.g. "California · San Francisco"). */
  scopeLabel?: string;
  /** Re-open the one-time location setup (tapping the scope chip). */
  onEditLocation?: () => void;
} = {}) {
  const online = useIsOnline();
  const recent = useRecentlyViewed();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<FilterDraft>(() => ({
    ...EMPTY_FILTERS,
    state: initialState ?? '',
  }));
  const [city] = useState<string>(initialCity ?? '');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locNotice, setLocNotice] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>('relevance');
  const [searchFocused, setSearchFocused] = useState(false);
  const specialties = useSpecialties();
  const savedProviderIds = useBookmarkedIds('provider');
  const savedCount = savedProviderIds.data?.size ?? 0;

  // Debounce the text query so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  const params = useMemo<ProviderSearchParams>(
    () => ({
      query: debounced || undefined,
      state: filters.state || undefined,
      city: city || undefined,
      specialty_slugs: filters.specialtySlugs.length ? filters.specialtySlugs : undefined,
      telehealth: filters.telehealth || undefined,
      in_person: filters.inPerson || undefined,
      accepting_patients: filters.accepting || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      radius_miles: coords ? DEFAULT_RADIUS_MILES : undefined,
      sort_by: sort,
      per_page: 20,
    }),
    [debounced, filters, city, coords, sort],
  );

  const active = hasActiveSearch(params);
  const search = useProviderSearch(params, active && online);
  const featured = useFeaturedProviders(!active && online);

  const providers = active ? search.providers : (featured.data ?? []);
  const loading = active ? search.isLoading : featured.isLoading;
  // searchProviders deliberately THROWS when the backend is unreachable (a genuine
  // zero-result resolves to an empty list), so an outage must render as an error
  // with a retry — never as "No matching providers".
  const errored = active && search.isError;
  const filterCount =
    (filters.state ? 1 : 0) +
    filters.specialtySlugs.length +
    (filters.telehealth ? 1 : 0) +
    (filters.inPerson ? 1 : 0) +
    (filters.accepting ? 1 : 0);

  const toggleNearMe = async () => {
    if (coords) {
      setCoords(null);
      setLocNotice(false);
      if (sort === 'distance') setSort('relevance');
      return;
    }
    const res = await requestAndGetCoords();
    if (res.status === 'granted') {
      setCoords(res.coords);
      setLocNotice(false);
      setSort('distance'); // a geo search defaults to nearest-first
    } else {
      // Coords are used only for the query; nothing is persisted or logged.
      setLocNotice(true);
    }
  };

  // Quick specialty suggestions under the search box — tapping one runs a fast
  // slug-scoped search instead of a free-text scan. Hidden once a specialty is set.
  const suggestions =
    text.trim().length >= 2 && !filters.specialtySlugs.length
      ? (specialties.data ?? [])
          .filter((s) => s.label.toLowerCase().includes(text.trim().toLowerCase()))
          .slice(0, 3)
      : [];

  const applySpecialty = (slug: string) => {
    setFilters((f) => ({ ...f, specialtySlugs: [slug] }));
    setText('');
  };

  const showCoverage =
    active && !loading && search.total > 0 && search.total <= COVERAGE_MIN && !!filters.state;

  const onEndReached = () => {
    if (active && search.hasNextPage && !search.isFetchingNextPage) {
      void search.fetchNextPage();
    }
  };

  if (!online) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        {embedded ? null : <GlobalHeader />}
        <OfflineFallback variant="offline" testID="directory-offline" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {embedded ? null : <GlobalHeader />}

      {embedded ? null : (
        <View className="flex-row items-center px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={8}
            testID="directory-back"
            className="min-h-[44px] flex-row items-center gap-1 px-2"
          >
            <ChevronLeft size={20} color={colors.charcoal[600]} strokeWidth={2} />
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              Back
            </Text>
          </Pressable>
        </View>
      )}

      <View className="gap-3 px-4 pb-2">
        <Text variant="h1">{t.title}</Text>

        {/* Scope chip — shows the home location and re-opens setup on tap. */}
        {embedded && onEditLocation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.editScope}
            onPress={onEditLocation}
            testID="directory-scope"
            className="min-h-[36px] flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5 dark:border-border-dark"
          >
            <MapPin size={16} color={colors.primary.default.light} strokeWidth={1.75} />
            <Text variant="caption" className="text-text-primary dark:text-text-primary-dark">
              {scopeLabel || t.scopeAllStates}
            </Text>
            <ChevronDown size={14} color={colors.charcoal[500]} strokeWidth={2} />
          </Pressable>
        ) : null}

        {/* Search */}
        <View
          className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark"
          style={searchFocused ? { borderColor: colors.primary.default.light } : undefined}
        >
          <Search size={18} color={colors.charcoal[400]} strokeWidth={1.75} />
          <TextInput
            accessibilityLabel={t.searchAccessibilityLabel}
            value={text}
            onChangeText={setText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.charcoal[400]}
            autoCorrect={false}
            returnKeyType="search"
            className="min-h-[44px] flex-1 font-sans text-base text-text-primary dark:text-text-primary-dark"
          />
        </View>

        {/* Near me + Filters */}
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !!coords }}
            accessibilityLabel={t.nearMe}
            onPress={toggleNearMe}
            testID="directory-near-me"
            className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              coords ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
            }`}
          >
            <MapPin
              size={16}
              color={coords ? colors.primary.default.light : colors.charcoal[500]}
              strokeWidth={1.75}
            />
            <Text
              variant="caption"
              className={coords ? 'text-primary dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark'}
            >
              {t.nearMe}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.filtersButton}
            onPress={() => setSheetOpen(true)}
            testID="directory-filters"
            className="min-h-[36px] flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5 dark:border-border-dark"
          >
            <SlidersHorizontal size={16} color={colors.charcoal[500]} strokeWidth={1.75} />
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              {filterCount > 0 ? `${t.filtersButton} (${filterCount})` : t.filtersButton}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.sortButton}
            onPress={() => setSortOpen(true)}
            testID="directory-sort"
            className="min-h-[36px] flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5 dark:border-border-dark"
          >
            <ArrowUpDown size={16} color={colors.charcoal[500]} strokeWidth={1.75} />
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              {t.sortButton}
            </Text>
          </Pressable>
        </View>

        {/* Specialty quick-suggestions */}
        {suggestions.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((s) => (
              <Pressable
                key={s.slug}
                accessibilityRole="button"
                accessibilityLabel={t.searchSpecialtyHint(s.label)}
                onPress={() => applySpecialty(s.slug)}
                testID={`suggest-${s.slug}`}
                className="min-h-[36px] flex-row items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 dark:border-primary-dark"
              >
                <Search size={14} color={colors.primary.default.light} strokeWidth={1.75} />
                <Text variant="caption" className="text-primary dark:text-primary-dark">
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {locNotice ? (
          <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
            {t.locationDenied}
          </Text>
        ) : null}

        {active && search.dropped?.includes('state') ? (
          <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
            {t.droppedState}
          </Text>
        ) : null}

        {active && !loading && !errored ? (
          <Text variant="caption" className="text-text-tertiary dark:text-text-tertiary-dark">
            {t.resultCount(search.total)}
          </Text>
        ) : null}

        {showCoverage ? (
          <View className="flex-row flex-wrap items-center gap-1.5 rounded-lg bg-surface-accent px-3 py-2 dark:bg-surface-accent-dark">
            <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
              {t.coverageNote(scopeLabel || filters.state, search.total)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.coverageAction}
              onPress={() => setFilters((f) => ({ ...f, state: '' }))}
              testID="directory-coverage-widen"
            >
              <Text variant="caption" className="text-primary dark:text-primary-dark">
                {t.coverageAction}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1" testID="directory-loading">
          <DirectorySkeleton />
        </View>
      ) : errored ? (
        <View className="flex-1 items-center justify-center gap-3 px-6" testID="directory-error">
          <Text variant="h2" className="text-center">
            Couldn't load providers
          </Text>
          <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
            The directory didn't respond. This is usually a connection hiccup — please try again.
          </Text>
          <View className="pt-1">
            <Button variant="secondary" size="sm" onPress={() => void search.refetch()} testID="directory-retry">
              Try again
            </Button>
          </View>
        </View>
      ) : (
        <FlashList
          data={providers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={onEndReached}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={(id) => router.push(`/find/provider/${id}`)} />}
          ListHeaderComponent={
            <View>
              {!active ? (
                <RecentlyViewedRail
                  items={recent.items}
                  onPress={(id) => router.push(`/find/provider/${id}`)}
                />
              ) : null}
              <Text variant="caption" className="pb-2 text-text-tertiary dark:text-text-tertiary-dark">
                {t.disclaimer}
              </Text>
            </View>
          }
          ListEmptyComponent={
            active ? (
              <View className="items-center gap-3 px-6 pt-10" testID="directory-empty">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface dark:bg-surface-dark">
                  <Search size={22} color={colors.charcoal[500]} strokeWidth={1.75} />
                </View>
                <Text variant="h2" className="text-center">
                  {t.emptyTitle}
                </Text>
                <Text variant="body" className="text-center text-text-secondary dark:text-text-secondary-dark">
                  {t.noResults}
                </Text>
                <View className="w-full gap-2 pt-1">
                  {debounced ? (
                    <Button variant="secondary" onPress={() => setText('')} testID="directory-empty-clear">
                      {t.emptyClearSearch}
                    </Button>
                  ) : null}
                  {filters.state ? (
                    <Button
                      variant="secondary"
                      onPress={() => setFilters((f) => ({ ...f, state: '' }))}
                      testID="directory-empty-widen"
                    >
                      {t.emptyWiden}
                    </Button>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text variant="body" className="py-6 text-center text-text-secondary dark:text-text-secondary-dark">
                {t.emptyPrompt}
              </Text>
            )
          }
          ListFooterComponent={
            search.isFetchingNextPage ? (
              <View className="py-4" testID="directory-loading-more">
                <ActivityIndicator color={colors.primary.default.light} />
              </View>
            ) : null
          }
        />
      )}

      {/* Floating compare — appears once 2+ providers are saved. */}
      {savedCount >= 2 ? (
        <View className="absolute inset-x-4 bottom-4">
          <Button
            variant="primary"
            onPress={() => router.push('/find/compare')}
            testID="directory-compare"
          >
            {t.compareCta(Math.min(savedCount, 3))}
          </Button>
        </View>
      ) : null}

      <DirectoryFilters
        visible={sheetOpen}
        initial={filters}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />

      <SortSheet
        visible={sortOpen}
        value={sort}
        geoEnabled={!!coords}
        onSelect={(next) => {
          setSort(next);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}

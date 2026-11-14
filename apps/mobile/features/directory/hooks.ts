// Server-state hooks for the directory (TanStack Query — stack rule: server data
// never lives in useState). The directory is filter-first: the paginated search
// query only runs once the user has set at least one filter / text (the
// RPC times out on a wholly-unscoped scan of the 423k-row table), and the default
// browse surface uses a small featured slice.

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getCityCounts,
  getFeaturedProviders,
  getProviderTypes,
  getSpecialties,
  getStateCounts,
  getTypeCounts,
  searchProviders,
} from './queries';
import type { ProviderCardData, ProviderSearchParams } from './types';

/** True when the user has narrowed the directory in any way. */
export function hasActiveSearch(p: ProviderSearchParams): boolean {
  return Boolean(
    (p.query && p.query.trim().length > 0) ||
      p.state ||
      p.city ||
      p.specialty_slugs?.length ||
      p.telehealth ||
      p.in_person,
  );
}

export function useProviderSearch(params: ProviderSearchParams, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ['providers', 'search', params],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchProviders({ ...params, page: pageParam as number }),
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 60_000,
    // searchProviders throws when the RPC fails (there is no fallback source), so a
    // transient timeout is retried instead of being cached as "0 results"; a
    // persistent failure surfaces isError → the directory's error state + retry.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  const providers: ProviderCardData[] = query.data?.pages.flatMap((p) => p.providers) ?? [];
  const total = query.data?.pages[0]?.total_count ?? 0;
  const dropped = query.data?.pages[0]?.dropped_filters;
  return { ...query, providers, total, dropped };
}

export function useFeaturedProviders(enabled: boolean) {
  return useQuery({
    queryKey: ['providers', 'featured'],
    enabled,
    queryFn: () => getFeaturedProviders(12),
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: ['providers', 'specialties'],
    queryFn: () => getSpecialties(),
    staleTime: 30 * 60_000,
  });
}

export function useProviderTypes() {
  return useQuery({
    queryKey: ['providers', 'types'],
    queryFn: () => getProviderTypes(),
    staleTime: 30 * 60_000,
  });
}

// --- facet counts (honest coverage) — power the State / City / Type pickers ------

/** Provider count per state (2-char code → count). */
export function useStateCounts() {
  return useQuery({
    queryKey: ['providers', 'facets', 'states'],
    queryFn: () => getStateCounts(),
    staleTime: 30 * 60_000,
  });
}

/** Real cities (with counts) for a state — replaces any hardcoded city list. */
export function useCityCounts(stateAbbr: string | undefined) {
  return useQuery({
    queryKey: ['providers', 'facets', 'cities', stateAbbr],
    enabled: Boolean(stateAbbr),
    queryFn: () => getCityCounts(stateAbbr as string),
    staleTime: 30 * 60_000,
  });
}

/** Provider count per provider_type_id within the current state/city scope. */
export function useTypeCounts(stateAbbr: string | undefined, city: string | undefined) {
  return useQuery({
    queryKey: ['providers', 'facets', 'types', stateAbbr, city],
    queryFn: () => getTypeCounts(stateAbbr, city && city !== 'all' ? city : undefined),
    staleTime: 30 * 60_000,
  });
}

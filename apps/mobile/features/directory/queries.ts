// =============================================================================
// Provider Directory — live Supabase queries
//
// Reads REAL provider data from the shared Supabase project via the app's anon
// read-only client (lib/supabase.ts). Providers are PUBLIC reference data (RLS:
// anon SELECT restricted to status IN ('active','seeded')) — SR-4 compliant, this
// is NOT symptom / mood / navigator state.
//
// Search is ONE path: the search_providers_v3 RPC (server-side filtered +
// paginated). There is no direct-query or mock fallback — when the RPC fails,
// searchProviders throws and the directory shows an error state with a retry,
// never other data (mirrors the web decision). Location scope is State + City
// only; no coordinates are ever sent.
//
// The RPC times out if called with no scope at all (423k rows). Callers therefore
// query only once at least one filter / text is set; the default browse surface
// uses getFeaturedProviders (a small, fast, ordered slice).
// =============================================================================

import { getSupabaseClient } from '@/lib/supabase';

import { mapProviderRow, mapRpcRow, mapToCardData } from './mapping';
import type {
  CulturalCompetency,
  InsurancePlan,
  LanguageLookup,
  ProviderCardData,
  ProviderCardSearchResult,
  ProviderSearchParams,
  ProviderType,
  ProviderWithDetails,
  Specialty,
} from './types';

const PAGE_SIZE = 20;

// A hung TCP connection would otherwise stall the directory UI indefinitely —
// TanStack Query's retries only engage once the promise settles. Rejecting with an
// Error routes the stall into the normal retry/error path. Local helper, no deps.
const REQUEST_TIMEOUT_MS = 15_000;

/** Reject `promise` with an Error if it hasn't settled within `ms`. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Embedded join for direct provider queries (PostgREST resource embedding).
const PROVIDER_SELECT = `
  *,
  provider_type:provider_types(*),
  locations:provider_locations(*),
  specialties:provider_specialties(specialty:specialties(*)),
  languages:provider_languages(language:languages_lookup(*), proficiency),
  cultural_competencies:provider_cultural_competencies(competency:cultural_competencies(*)),
  insurance_plans:provider_insurance(plan:insurance_plans(*))
`;

// Crisis Service provider type — surfaced via /crisis, never in directory browse
// (mirrors the web's HIDDEN_PROVIDER_TYPE_IDS).
const HIDDEN_PROVIDER_TYPE_IDS: ReadonlySet<string> = new Set([
  'e3e49ec2-4ab6-45e0-87f5-40bc9f3931fe',
]);

const EMPTY = (page: number, perPage: number): ProviderCardSearchResult => ({
  providers: [],
  total_count: 0,
  page,
  per_page: perPage,
  has_more: false,
});

// --- search ---------------------------------------------------------------------

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;

/**
 * Build the search_providers_v3 argument object. Coordinates, radius and the
 * accepting-patients flag are deliberately NOT sent (the keys are omitted, not
 * nulled): every remaining parameter has a server default, and a later migration
 * drops those parameters from the function.
 */
export function buildSearchRpcArgs(params: ProviderSearchParams, perPage: number, offset: number) {
  return {
    p_query: params.query || null,
    p_provider_type_ids: params.provider_type_ids?.length ? params.provider_type_ids : null,
    p_specialty_slugs: params.specialty_slugs?.length ? params.specialty_slugs : null,
    p_language_ids: params.language_ids?.length ? params.language_ids : null,
    p_competency_ids: params.competency_ids?.length ? params.competency_ids : null,
    p_insurance_plan_ids: params.insurance_plan_ids?.length ? params.insurance_plan_ids : null,
    p_telehealth: params.telehealth ?? null,
    p_in_person: params.in_person ?? null,
    p_state: params.state || null,
    p_city: params.city || null,
    p_verification_status: params.verification_status || null,
    p_sort: params.sort_by === 'name' ? 'name' : 'relevance',
    p_limit: perPage,
    p_offset: offset,
  };
}

async function searchViaRPC(client: Client, params: ProviderSearchParams): Promise<ProviderCardSearchResult> {
  const page = params.page || 1;
  const perPage = params.per_page || PAGE_SIZE;
  const offset = (page - 1) * perPage;
  const { data, error } = await withTimeout(
    client.rpc('search_providers_v3', buildSearchRpcArgs(params, perPage, offset)),
  );

  // Throw so TanStack Query retries and the UI surfaces `isError` (error state +
  // retry) — a genuine zero-result resolves with an empty list below instead.
  if (error) throw new Error(`Provider search failed: ${error.message}`);

  const rows = (data || []) as Array<Record<string, unknown> & { total_count?: number }>;
  const totalCount = (rows[0]?.total_count as number | undefined) ?? 0;
  const providers = rows.map(mapRpcRow);
  return {
    providers,
    total_count: totalCount,
    page,
    per_page: perPage,
    has_more: offset + perPage < totalCount,
  };
}

/**
 * True when at least one narrowing param is set (text / state / city / service
 * flag / lookup id / verification). The `search_providers_v3` RPC times out on a
 * wholly-unscoped scan of the 423k-row table, so an all-empty scope must never
 * reach the backend. Intentionally BROAD (counts every narrowing field) — it only
 * blocks the truly-empty case and never a legitimately scoped search. Distinct from
 * hooks.hasActiveSearch (a UI toggle), which deliberately ignores the lookup arrays.
 */
export function hasSearchScope(p: ProviderSearchParams): boolean {
  return Boolean(
    (p.query && p.query.trim().length > 0) ||
      p.state ||
      p.city ||
      p.verification_status ||
      p.telehealth ||
      p.in_person ||
      p.provider_type_ids?.length ||
      p.specialty_slugs?.length ||
      p.language_ids?.length ||
      p.competency_ids?.length ||
      p.insurance_plan_ids?.length,
  );
}

/**
 * Main search entry: the search_providers_v3 RPC only. THROWS when the client is
 * unconfigured or the RPC errors (the directory then shows its error state with a
 * retry); there is no fallback data source. An all-empty scope returns an empty
 * result without calling the RPC. If a city+state combo yields zero, drops state
 * and re-runs the same RPC city-only (surfaces dropped_filters).
 */
export async function searchProviders(params: ProviderSearchParams): Promise<ProviderCardSearchResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Provider search is unavailable: Supabase is not configured.');
  // Defensive: never issue an unscoped RPC (would time out scanning 423k rows). The
  // UI already gates on a scope, but a future caller could reach here unscoped.
  if (!hasSearchScope(params)) return EMPTY(params.page || 1, params.per_page || PAGE_SIZE);

  const result = await searchViaRPC(client, params);

  if (params.city && params.state && result.total_count === 0) {
    const retry = await searchViaRPC(client, { ...params, state: undefined });
    if (retry.total_count > 0) return { ...retry, dropped_filters: ['state'] };
  }
  return result;
}

// --- single provider (detail screen) --------------------------------------------

export async function getProviderById(id: string): Promise<ProviderWithDetails | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('providers').select(PROVIDER_SELECT).eq('id', id).maybeSingle();
  // Distinguish a transient failure (throw → TanStack Query retries + shows a load
  // error with retry) from a genuine not-found (null → "this listing is unavailable").
  if (error) throw error;
  if (!data) return null;
  return mapProviderRow(data as Record<string, unknown>);
}

// --- featured (default browse surface) ------------------------------------------

/**
 * Small, fast, ordered slice for the directory's default state (avoids the
 * unfiltered-RPC timeout). Verified/claimed/pro/elite first, then high-completeness
 * seeded. Returns [] when unreachable — never mock data.
 */
export async function getFeaturedProviders(limit = 12): Promise<ProviderCardData[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('providers')
    .select(PROVIDER_SELECT)
    .in('status', ['active', 'verified', 'claimed', 'seeded'])
    .not('bio', 'is', null)
    .order('tier', { ascending: false })
    .order('display_name')
    .limit(limit * 2);

  if (error || !data || data.length === 0) {
    const fallback = await client
      .from('providers')
      .select(PROVIDER_SELECT)
      .in('status', ['active', 'verified', 'claimed', 'seeded'])
      .order('tier', { ascending: false })
      .order('display_name')
      .limit(limit * 2);
    if (fallback.error || !fallback.data || fallback.data.length === 0) return [];
    return (fallback.data as Record<string, unknown>[]).map((r) => mapToCardData(mapProviderRow(r))).slice(0, limit);
  }

  const cards = (data as Record<string, unknown>[]).map((r) => mapToCardData(mapProviderRow(r)));
  const withPhoto = cards.filter((c) => c.photo_url);
  const withoutPhoto = cards.filter((c) => !c.photo_url);
  return [...withPhoto, ...withoutPhoto].slice(0, limit);
}

// --- facet counts (honest coverage: never hardcode, never fabricate) ------------
//
// Back the State / City / Type pickers. Each wraps a directory_facets RPC that
// GROUPs on the SAME columns search_providers_v3 filters on, so a count shown next
// to an option always matches the result list that selecting it produces (the
// "filters can't dead-end the user" rule). Empty map on any failure — never faked.

/**
 * Provider count per state (2-char code → count), primary-location based.
 * THROWS on RPC error so the query surfaces `isError` (data undefined) rather than
 * an empty map: an empty map would make the picker disable EVERY state as "None
 * listed". On failure the picker leaves states tappable with no count instead.
 */
export async function getStateCounts(): Promise<Record<string, number>> {
  const client = getSupabaseClient();
  if (!client) return {};
  const { data, error } = await client.rpc('directory_state_counts');
  if (error) throw error;
  if (!data) return {};
  const out: Record<string, number> = {};
  for (const row of data as { state: string; provider_count: number }[]) {
    if (row.state) out[row.state.toUpperCase()] = Number(row.provider_count) || 0;
  }
  return out;
}

/** Real cities (with counts) for a state, busiest first. Empty when none/unreachable. */
export async function getCityCounts(state: string): Promise<{ city: string; count: number }[]> {
  const client = getSupabaseClient();
  if (!client || !state) return [];
  const { data, error } = await client.rpc('directory_city_counts', { p_state: state });
  if (error || !data) return [];
  return (data as { city: string; provider_count: number }[])
    .filter((r) => Boolean(r.city))
    .map((r) => ({ city: r.city, count: Number(r.provider_count) || 0 }));
}

/** Provider count per provider_type_id within the current state/city scope. */
export async function getTypeCounts(state?: string, city?: string): Promise<Record<string, number>> {
  const client = getSupabaseClient();
  if (!client) return {};
  const { data, error } = await client.rpc('directory_type_counts', {
    p_state: state || null,
    p_city: city || null,
  });
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const row of data as { provider_type_id: string; provider_count: number }[]) {
    if (row.provider_type_id) out[row.provider_type_id] = Number(row.provider_count) || 0;
  }
  return out;
}

export async function getProviderCount(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;
  const { count, error } = await client
    .from('providers')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'seeded']);
  return error ? 0 : (count ?? 0);
}

// --- lookup tables (filter options) ---------------------------------------------

export async function getProviderTypes(): Promise<ProviderType[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('provider_types').select('*').order('sort_order');
  if (error) return [];
  return ((data as ProviderType[]) || []).filter((t) => !HIDDEN_PROVIDER_TYPE_IDS.has(t.id));
}

export async function getSpecialties(): Promise<Specialty[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('specialties').select('*').order('sort_order');
  if (error) return [];
  return (data as Specialty[]) || [];
}

export async function getLanguages(): Promise<LanguageLookup[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('languages_lookup').select('*').order('label');
  if (error) return [];
  return (data as LanguageLookup[]) || [];
}

export async function getCulturalCompetencies(): Promise<CulturalCompetency[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('cultural_competencies').select('*').order('label');
  if (error) return [];
  return (data as CulturalCompetency[]) || [];
}

export async function getInsurancePlans(): Promise<InsurancePlan[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('insurance_plans').select('*').order('carrier').order('name');
  if (error) return [];
  return (data as InsurancePlan[]) || [];
}

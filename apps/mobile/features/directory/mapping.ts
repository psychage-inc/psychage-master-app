// =============================================================================
// Provider Directory — row → card / detail mapping
//
// Ported VERBATIM from psychage-v2/src/lib/providers/queries.ts (cleanDisplayName,
// mapProviderRow, mapToCardData). "Verbatim to what psychage.com shows" includes
// the web's display transform: the web strips leading/trailing junk punctuation
// from raw NPI-sourced names before rendering, so porting cleanDisplayName keeps
// mobile and web pixel-identical. We do NOT otherwise alter, infer, or complete
// any field — null stays null.
// =============================================================================

import type {
  CulturalCompetency,
  InsurancePlan,
  LanguageLookup,
  ProviderCardData,
  ProviderLocation,
  ProviderType,
  ProviderWithDetails,
  Specialty,
} from './types';

/**
 * Strip leading/trailing junk punctuation from raw NPI-sourced display names
 * (e.g. "/STALBURN VANSLUYTMAN, L.C.S.W" → "STALBURN VANSLUYTMAN, L.C.S.W").
 * Mirrors the web exactly — this is the canonical display form, not a fabrication.
 */
export function cleanDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/^[\s/:.-]+|[\s/:.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map a raw Supabase joined row (PROVIDER_SELECT) into ProviderWithDetails. */
export function mapProviderRow(row: Record<string, unknown>): ProviderWithDetails {
  const raw = row;
  return {
    ...(raw as object),
    provider_type: (raw.provider_type as ProviderType | null) ?? null,
    locations: (raw.locations as ProviderLocation[]) || [],
    specialties: ((raw.specialties as { specialty: Specialty }[]) || []).map((s) => s.specialty),
    languages: ((raw.languages as { language: LanguageLookup; proficiency: string }[]) || []).map((l) => ({
      ...l.language,
      proficiency: l.proficiency,
    })),
    cultural_competencies: ((raw.cultural_competencies as { competency: CulturalCompetency }[]) || []).map(
      (c) => c.competency,
    ),
    insurance_plans: ((raw.insurance_plans as { plan: InsurancePlan }[]) || []).map((i) => i.plan),
  } as ProviderWithDetails;
}

/** Map a ProviderWithDetails (direct query) into the ProviderCardData list shape. */
export function mapToCardData(p: ProviderWithDetails): ProviderCardData {
  const loc = p.locations.find((l) => l.is_primary) || p.locations[0] || null;
  return {
    id: p.id,
    display_name: cleanDisplayName(p.display_name) || p.display_name,
    credentials_suffix: p.credentials_suffix,
    bio: p.bio,
    photo_url: p.photo_url,
    status: p.status,
    tier: p.tier,
    practice_name: p.practice_name,
    phone: p.phone,
    email: p.email,
    website_url: p.website_url,
    appointment_url: p.appointment_url,
    npi_number: p.npi_number,
    telehealth_available: p.telehealth_available,
    in_person_available: p.in_person_available,
    is_accepting_patients: p.is_accepting_patients,
    verified_at: p.verified_at,
    trust_score_cached: p.trust_score_cached ?? null,
    provider_type_slug: p.provider_type?.slug || '',
    provider_type_label: p.provider_type?.label || '',
    primary_city: loc?.city || null,
    primary_state: loc?.state_province || null,
    specialty_tags: (p.specialties || []).map((s) => ({ slug: s.slug, label: s.label, category: s.category })),
    language_tags: (p.languages || []).map((l) => ({ code: l.code, label: l.label, native_label: l.native_label })),
    competency_tags: (p.cultural_competencies || []).map((c) => ({ slug: c.slug, label: c.label })),
    insurance_tags: (p.insurance_plans || []).map((i) => ({ name: i.name, carrier: i.carrier })),
  };
}

/** Map a raw RPC row (already flattened by search_providers_v3) into ProviderCardData. */
export function mapRpcRow(row: Record<string, unknown>): ProviderCardData {
  const r = row as Record<string, unknown> & ProviderCardData;
  return {
    id: r.id,
    display_name: cleanDisplayName(r.display_name) || r.display_name,
    credentials_suffix: r.credentials_suffix,
    bio: r.bio,
    photo_url: r.photo_url,
    status: r.status,
    tier: r.tier,
    practice_name: r.practice_name,
    phone: r.phone,
    email: r.email,
    website_url: r.website_url,
    appointment_url: r.appointment_url,
    npi_number: r.npi_number,
    telehealth_available: r.telehealth_available,
    in_person_available: r.in_person_available,
    is_accepting_patients: r.is_accepting_patients,
    verified_at: r.verified_at,
    trust_score_cached: r.trust_score_cached ?? null,
    provider_type_slug: r.provider_type_slug,
    provider_type_label: r.provider_type_label,
    primary_city: r.primary_city,
    primary_state: r.primary_state,
    specialty_tags: r.specialty_tags || [],
    language_tags: r.language_tags || [],
    competency_tags: r.competency_tags || [],
    insurance_tags: r.insurance_tags || [],
  };
}

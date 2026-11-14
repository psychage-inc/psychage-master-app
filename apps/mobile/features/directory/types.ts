// =============================================================================
// Provider Directory — TypeScript types
//
// Ported VERBATIM (field-for-field) from the web at
// psychage-v2/src/lib/providers/types.ts so a native card renders identically to
// what psychage.com shows. The directory is the SAME shared-Supabase data the web
// reads (public reference data, RLS-gated to status IN ('active','seeded')). Do not
// rename fields, do not "complete" missing values — entries are real and verbatim.
// =============================================================================

// --- Enums (match the DB) ---

export type ProviderStatus =
  | 'seeded'
  | 'claimed'
  | 'submitted'
  | 'verified'
  | 'active'
  | 'suspended'
  | 'rejected';

export type ProviderTier = 'free' | 'pro' | 'elite';

export type ProviderSource = 'npi_registry' | 'samhsa' | 'hrsa_hc' | 'manual' | 'claim';

// --- Lookup tables ---

export interface ProviderType {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
}

export interface Specialty {
  id: string;
  slug: string;
  label: string;
  category: 'condition' | 'treatment_approach' | 'population';
  psychage_condition_id: string | null;
  sort_order: number;
}

export interface LanguageLookup {
  id: string;
  code: string;
  label: string;
  native_label: string;
}

export interface CulturalCompetency {
  id: string;
  slug: string;
  label: string;
  description: string | null;
}

export interface InsurancePlan {
  id: string;
  name: string;
  carrier: string;
  plan_type: 'commercial' | 'medicaid' | 'medicare' | 'tricare' | 'other' | null;
}

// --- Provider row + location ---

export interface ProviderRow {
  id: string;
  user_id: string | null;
  npi_number: string | null;
  license_number: string | null;
  license_state: string | null;
  provider_type_id: string;
  status: ProviderStatus;
  tier: ProviderTier;
  source: ProviderSource;
  display_name: string;
  credentials_suffix: string | null;
  bio: string | null;
  photo_url: string | null;
  practice_name: string | null;
  practice_type: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  appointment_url: string | null;
  is_accepting_patients: boolean;
  telehealth_available: boolean;
  in_person_available: boolean;
  verified_at: string | null;
  taxonomy_code: string | null;
  taxonomy_description: string | null;
  facility_type: string | null;
  sliding_fee_scale: boolean;
  emergency_services: boolean;
  data_last_synced_at: string | null;
  claimed_at: string | null;
  trust_score_cached: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderLocation {
  id: string;
  provider_id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
}

// --- Joined / enriched (detail screen) ---

export interface ProviderWithDetails extends ProviderRow {
  provider_type: ProviderType | null;
  locations: ProviderLocation[];
  specialties: Specialty[];
  languages: (LanguageLookup & { proficiency: string })[];
  cultural_competencies: CulturalCompetency[];
  insurance_plans: InsurancePlan[];
}

// --- Rich card (list screen; shape returned by search_providers_v3) ---

export interface ProviderCardData {
  id: string;
  display_name: string;
  credentials_suffix: string | null;
  bio: string | null;
  photo_url: string | null;
  status: ProviderStatus;
  tier: ProviderTier;
  practice_name: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  appointment_url: string | null;
  npi_number: string | null;
  telehealth_available: boolean;
  in_person_available: boolean;
  is_accepting_patients: boolean;
  verified_at: string | null;
  trust_score_cached: number | null;
  provider_type_slug: string;
  provider_type_label: string;
  primary_city: string | null;
  primary_state: string | null;
  specialty_tags: { slug: string; label: string; category: string }[];
  language_tags: { code: string; label: string; native_label: string }[];
  competency_tags: { slug: string; label: string }[];
  insurance_tags: { name: string; carrier: string }[];
}

export interface ProviderCardSearchResult {
  providers: ProviderCardData[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
  /** Filter keys auto-removed by recovery (e.g. ['state'] when city+state had 0 hits). */
  dropped_filters?: string[];
}

// --- Search params (mirror search_providers_v3 inputs) ---

export interface ProviderSearchParams {
  query?: string;
  provider_type_ids?: string[];
  specialty_slugs?: string[];
  language_ids?: string[];
  competency_ids?: string[];
  insurance_plan_ids?: string[];
  state?: string;
  city?: string;
  telehealth?: boolean;
  in_person?: boolean;
  verification_status?: 'verified' | 'listed';
  sort_by?: 'relevance' | 'name';
  page?: number;
  per_page?: number;
}

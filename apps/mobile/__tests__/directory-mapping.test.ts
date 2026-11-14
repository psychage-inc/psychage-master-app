import { describe, expect, it } from 'vitest';

import { cleanDisplayName, mapProviderRow, mapRpcRow, mapToCardData } from '@/features/directory/mapping';

describe('cleanDisplayName (verbatim port — matches web rendering)', () => {
  it('strips leading/trailing junk punctuation and collapses spaces', () => {
    expect(cleanDisplayName('/STALBURN VANSLUYTMAN, L.C.S.W')).toBe('STALBURN VANSLUYTMAN, L.C.S.W');
    expect(cleanDisplayName('  BRIAN   SWANSON  ')).toBe('BRIAN SWANSON');
    expect(cleanDisplayName('-Dr. Lee-')).toBe('Dr. Lee');
  });

  it('returns empty string for nullish (never invents a name)', () => {
    expect(cleanDisplayName(null)).toBe('');
    expect(cleanDisplayName(undefined)).toBe('');
  });

  it('preserves interior content verbatim', () => {
    expect(cleanDisplayName('ARNOLD SWILLER')).toBe('ARNOLD SWILLER');
  });
});

describe('mapProviderRow — joined row → detail shape', () => {
  it('flattens junction joins and defaults missing collections to []', () => {
    const row = {
      id: 'p1',
      display_name: 'BRIAN SWANSON',
      status: 'seeded',
      tier: 'free',
      provider_type: { id: 't1', slug: 'psychologist', label: 'Psychologist' },
      locations: [{ id: 'l1', city: 'Reseda', state_province: 'CA', is_primary: true }],
      specialties: [{ specialty: { id: 's1', slug: 'anxiety', label: 'Anxiety', category: 'condition' } }],
      languages: [{ language: { id: 'lg1', code: 'en', label: 'English', native_label: 'English' }, proficiency: 'native' }],
    };
    const mapped = mapProviderRow(row);
    expect(mapped.provider_type?.slug).toBe('psychologist');
    expect(mapped.specialties).toEqual([{ id: 's1', slug: 'anxiety', label: 'Anxiety', category: 'condition' }]);
    expect(mapped.languages[0]).toMatchObject({ code: 'en', proficiency: 'native' });
    expect(mapped.cultural_competencies).toEqual([]);
    expect(mapped.insurance_plans).toEqual([]);
  });
});

describe('mapToCardData — detail → card', () => {
  it('picks the primary location and keeps null fields null', () => {
    const detail = mapProviderRow({
      id: 'p1',
      display_name: '/BRIAN SWANSON',
      status: 'seeded',
      tier: 'free',
      phone: '8189719446',
      practice_name: null,
      website_url: null,
      trust_score_cached: 0,
      provider_type: { id: 't1', slug: 'psychologist', label: 'Psychologist' },
      locations: [
        { id: 'l0', city: 'Other', state_province: 'NY', is_primary: false },
        { id: 'l1', city: 'Reseda', state_province: 'CA', is_primary: true },
      ],
      specialties: [],
      languages: [],
    });
    const card = mapToCardData(detail);
    expect(card.display_name).toBe('BRIAN SWANSON'); // cleaned, matching web
    expect(card.primary_city).toBe('Reseda');
    expect(card.primary_state).toBe('CA');
    expect(card.phone).toBe('8189719446');
    expect(card.practice_name).toBeNull();
    expect(card.website_url).toBeNull();
    expect(card.provider_type_label).toBe('Psychologist');
  });
});

describe('mapRpcRow — flattened RPC row → card', () => {
  it('passes tags through and cleans the name', () => {
    const card = mapRpcRow({
      id: 'p2',
      display_name: 'SHANA SWIMMER',
      credentials_suffix: 'Ph.D.',
      status: 'seeded',
      tier: 'free',
      telehealth_available: false,
      in_person_available: true,
      is_accepting_patients: true,
      provider_type_slug: 'psychologist',
      provider_type_label: 'Psychologist',
      primary_city: 'Los Angeles',
      primary_state: 'CA',
      specialty_tags: [{ slug: 'anxiety', label: 'Anxiety', category: 'condition' }],
      language_tags: [],
      total_count: 5,
    });
    expect(card.display_name).toBe('SHANA SWIMMER');
    expect(card.credentials_suffix).toBe('Ph.D.');
    expect(card.specialty_tags[0]?.label).toBe('Anxiety');
    expect(card.competency_tags).toEqual([]); // defaulted, not fabricated
    expect(Object.hasOwn(card, 'is_accepting_patients')).toBe(false); // never surfaced
  });
});

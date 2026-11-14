import { fireEvent, screen } from '@testing-library/react-native';

// The card mounts BookmarkSaveSlot, which calls useFocusEffect (needs a nav
// context the test renderer has none of) and router on the sign-in path.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: () => undefined,
}));

import { ProviderCard } from '@/features/directory/ProviderCard';
import type { ProviderCardData } from '@/features/directory/types';

import { renderWithProviders } from './_helpers';

const base: ProviderCardData = {
  id: 'p1',
  display_name: 'BRIAN SWANSON',
  credentials_suffix: 'Psy.D., J.D.',
  bio: null,
  photo_url: null,
  status: 'seeded',
  tier: 'free',
  practice_name: null,
  phone: '8189719446',
  email: null,
  website_url: null,
  appointment_url: null,
  npi_number: null,
  telehealth_available: true,
  in_person_available: false,
  is_accepting_patients: true,
  verified_at: null,
  trust_score_cached: null,
  provider_type_slug: 'psychologist',
  provider_type_label: 'Psychologist',
  primary_city: 'Reseda',
  primary_state: 'CA',
  specialty_tags: [{ slug: 'anxiety', label: 'Anxiety', category: 'condition' }],
  language_tags: [],
  competency_tags: [],
  insurance_tags: [],
};

// query: true — the card now mounts BookmarkSaveSlot (a save-from-list toggle),
// which reads the auth uid via TanStack Query.
const opts = { query: true, haptics: true } as const;

describe('ProviderCard', () => {
  it('renders the real name, credentials and location verbatim', () => {
    renderWithProviders(<ProviderCard provider={base} onPress={() => {}} />, opts);
    expect(screen.getByText('BRIAN SWANSON')).toBeTruthy();
    expect(screen.getByText(', Psy.D., J.D.')).toBeTruthy();
    expect(screen.getByText('Psychologist · Reseda, CA')).toBeTruthy();
    expect(screen.getByText('Telehealth')).toBeTruthy();
    expect(screen.getByText('Anxiety')).toBeTruthy();
    expect(screen.getByText('Accepting new patients')).toBeTruthy();
    expect(screen.getByText('Listed')).toBeTruthy(); // seeded → "Listed", not an endorsement
  });

  it('never shows a distance, even if a row carries one', () => {
    const withDistance = { ...base, distance_miles: 4.2 } as ProviderCardData;
    renderWithProviders(<ProviderCard provider={withDistance} onPress={() => {}} />, opts);
    expect(screen.getByText('Psychologist · Reseda, CA')).toBeTruthy();
    expect(screen.queryByText(/ mi$/)).toBeNull();
  });

  it('omits absent fields without inventing them', () => {
    renderWithProviders(
      <ProviderCard provider={{ ...base, credentials_suffix: null }} onPress={() => {}} />,
      opts,
    );
    expect(screen.queryByText(/Psy\.D/)).toBeNull();
  });

  it('fires onPress with the provider id', () => {
    const onPress = jest.fn();
    renderWithProviders(<ProviderCard provider={base} onPress={onPress} />, opts);
    fireEvent.press(screen.getByTestId('provider-card-p1'));
    expect(onPress).toHaveBeenCalledWith('p1');
  });
});

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/components/GlobalHeader', () => ({ GlobalHeader: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('@/features/crisis/dialer', () => ({ dial: jest.fn() }));
jest.mock('@/features/directory/queries', () => ({ getProviderById: jest.fn() }));

import { router } from 'expo-router';
import { dial } from '@/features/crisis/dialer';
import { ProviderDetailView } from '@/features/directory/ProviderDetailView';
import { getProviderById } from '@/features/directory/queries';
import type { ProviderWithDetails } from '@/features/directory/types';

import { renderWithProviders } from './_helpers';

const getByIdMock = getProviderById as unknown as jest.Mock;
const dialMock = dial as unknown as jest.Mock;
const pushMock = router.push as unknown as jest.Mock;

const provider = {
  id: 'p1',
  display_name: '/BRIAN SWANSON',
  credentials_suffix: 'Psy.D., J.D.',
  bio: 'Works with adults on anxiety.',
  status: 'seeded',
  tier: 'free',
  phone: '8189719446',
  email: 'dr@clinic.org',
  website_url: 'drsmith.com',
  appointment_url: null,
  telehealth_available: true,
  in_person_available: true,
  is_accepting_patients: true,
  verified_at: null,
  trust_score_cached: 0,
  provider_type: { id: 't1', slug: 'psychologist', label: 'Psychologist', description: null, sort_order: 0 },
  locations: [
    {
      id: 'l1',
      provider_id: 'p1',
      address_line1: '1 Main St',
      address_line2: null,
      city: 'Reseda',
      state_province: 'CA',
      postal_code: '91335',
      country_code: 'US',
      latitude: 34.2,
      longitude: -118.5,
      is_primary: true,
    },
  ],
  specialties: [{ id: 's1', slug: 'anxiety', label: 'Anxiety', category: 'condition', psychage_condition_id: null, sort_order: 0 }],
  languages: [],
  cultural_competencies: [],
  insurance_plans: [],
} as unknown as ProviderWithDetails;

function withQuery(ui: ReactElement) {
  // gcTime: 0 so react-query leaves no lingering cache timer (worker exits clean);
  // haptics:true supplies the HapticProvider the detail view's Button needs.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return renderWithProviders(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, { haptics: true });
}

beforeEach(() => {
  getByIdMock.mockReset();
  dialMock.mockReset();
  pushMock.mockReset();
});

describe('S27 provider detail', () => {
  it('renders the cleaned name + real bio, and dials the REAL stored number', async () => {
    getByIdMock.mockResolvedValue(provider);
    withQuery(<ProviderDetailView id="p1" />);

    expect(await screen.findByText('BRIAN SWANSON')).toBeTruthy(); // cleaned, matches web
    expect(screen.getByText('Works with adults on anxiety.')).toBeTruthy();
    // The fixture row still carries is_accepting_patients: true; it is never shown.
    expect(screen.queryByText(/accepting/i)).toBeNull();

    fireEvent.press(screen.getByTestId('provider-call'));
    expect(dialMock).toHaveBeenCalledWith('tel:8189719446');

    fireEvent.press(screen.getByTestId('provider-website'));
    expect(dialMock).toHaveBeenCalledWith('https://drsmith.com'); // scheme added, host verbatim
  });

  it('links the real name + best contact into the My Therapist add-provider flow', async () => {
    getByIdMock.mockResolvedValue(provider);
    withQuery(<ProviderDetailView id="p1" />);
    await screen.findByText('BRIAN SWANSON');

    fireEvent.press(screen.getByTestId('provider-use-as-therapist'));
    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/add-provider',
      params: { name: 'BRIAN SWANSON', contact: '8189719446' },
    });
  });

  it('shows the honest not-found state (never a stub) when the listing is missing', async () => {
    getByIdMock.mockResolvedValue(null);
    withQuery(<ProviderDetailView id="missing" />);
    expect(await screen.findByText('Provider unavailable')).toBeTruthy();
  });
});

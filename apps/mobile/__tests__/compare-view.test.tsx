import { fireEvent, screen, waitFor } from '@testing-library/react-native';

jest.mock('@/components/GlobalHeader', () => ({ GlobalHeader: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/features/directory/queries', () => ({ getProviderById: jest.fn() }));
jest.mock('@/features/bookmarks/hooks', () => ({
  useBookmarkedIds: jest.fn(),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));

import { CompareView } from '@/features/directory/CompareView';
import { useBookmarkedIds } from '@/features/bookmarks/hooks';
import { getProviderById } from '@/features/directory/queries';

import { renderWithProviders } from './_helpers';

const idsMock = useBookmarkedIds as unknown as jest.Mock;
const getByIdMock = getProviderById as unknown as jest.Mock;

const NAMES: Record<string, string> = { a: 'Maya Feldman', b: 'Daniel O' };
const mk = (id: string) => ({
  id,
  display_name: NAMES[id] ?? id,
  credentials_suffix: 'LCSW',
  status: 'seeded',
  tier: 'free',
  photo_url: null,
  npi_number: '1234567890',
  license_number: 'CA 99999',
  license_state: 'CA',
  verified_at: null,
  telehealth_available: true,
  in_person_available: false,
  phone: null,
  email: null,
  website_url: null,
  provider_type: { label: 'Clinical Social Worker' },
  locations: [],
  specialties: [],
  languages: [],
  insurance_plans: [],
  cultural_competencies: [],
});

beforeEach(() => {
  getByIdMock.mockImplementation((id: string) => Promise.resolve(mk(id)));
});

describe('CompareView', () => {
  it('prompts to save more when fewer than two are saved', () => {
    idsMock.mockReturnValue({ data: new Set(['a']) });
    renderWithProviders(<CompareView />, { query: true, haptics: true });
    expect(screen.getByText('Nothing to compare yet')).toBeTruthy();
  });

  it('renders a column per saved provider', async () => {
    idsMock.mockReturnValue({ data: new Set(['a', 'b']) });
    renderWithProviders(<CompareView />, { query: true, haptics: true });
    expect(await screen.findByText('Maya Feldman')).toBeTruthy();
    expect(await screen.findByText('Daniel O')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('Clinical Social Worker').length).toBe(2));
  });

  // PR-009 — one transient per-id failure must not discard the columns that loaded.
  it('keeps loaded columns and shows a notice when one provider fetch fails', async () => {
    idsMock.mockReturnValue({ data: new Set(['a', 'b']) });
    getByIdMock.mockImplementation((id: string) =>
      id === 'b' ? Promise.reject(new Error('transient')) : Promise.resolve(mk(id)),
    );
    renderWithProviders(<CompareView />, { query: true, haptics: true });
    expect(await screen.findByText('Maya Feldman')).toBeTruthy();
    expect(screen.getByTestId('compare-partial-notice')).toBeTruthy();
    expect(screen.queryByText('Daniel O')).toBeNull();
  });

  // PR-009 — when nothing loads, surface a retryable error, never an eternal loader.
  it('shows a retryable error when nothing loads, then recovers on retry', async () => {
    idsMock.mockReturnValue({ data: new Set(['a', 'b']) });
    getByIdMock.mockRejectedValue(new Error('down'));
    renderWithProviders(<CompareView />, { query: true, haptics: true });
    expect(await screen.findByText("Couldn't load these providers")).toBeTruthy();
    expect(screen.queryByTestId('compare-loading')).toBeNull();

    getByIdMock.mockImplementation((id: string) => Promise.resolve(mk(id)));
    fireEvent.press(screen.getByTestId('compare-retry'));
    expect(await screen.findByText('Maya Feldman')).toBeTruthy();
    expect(await screen.findByText('Daniel O')).toBeTruthy();
  });
});

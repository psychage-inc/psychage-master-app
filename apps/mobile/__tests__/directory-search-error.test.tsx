import { fireEvent, screen, waitFor } from '@testing-library/react-native';

// Provider search has ONE path (the RPC). When it fails, the directory must show
// an error state whose retry re-runs the SAME search — never other data.

jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: () => true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useFocusEffect: () => undefined }));

const mockSearchProviders = jest.fn();
const mockGetFeaturedProviders = jest.fn();
jest.mock('@/features/directory/queries', () => ({
  ...jest.requireActual('@/features/directory/queries'),
  searchProviders: (...args: unknown[]) => mockSearchProviders(...args),
  getFeaturedProviders: (...args: unknown[]) => mockGetFeaturedProviders(...args),
  getSpecialties: () => Promise.resolve([]),
}));

import { DirectoryView } from '@/features/directory/DirectoryView';

import { renderWithProviders } from './_helpers';

describe('DirectoryView — search failure', () => {
  beforeEach(() => {
    mockSearchProviders.mockReset();
    mockGetFeaturedProviders.mockReset();
  });
  it('shows an error with a retry that re-runs the same search, and no fallback data', async () => {
    mockSearchProviders.mockRejectedValue(new Error('Provider search failed: timeout'));
    renderWithProviders(<DirectoryView embedded initialState="CA" />, { query: true, haptics: true });

    // useProviderSearch retries twice with backoff (~3s) before surfacing isError.
    await waitFor(() => expect(screen.getByTestId('directory-error')).toBeTruthy(), { timeout: 8000 });
    expect(screen.queryByTestId('directory-empty')).toBeNull();
    expect(mockGetFeaturedProviders).not.toHaveBeenCalled();
    const attempts = mockSearchProviders.mock.calls.length;
    const firstParams = mockSearchProviders.mock.calls[0]?.[0];
    expect(firstParams).toMatchObject({ state: 'CA', page: 1 });

    mockSearchProviders.mockResolvedValue({ providers: [], total_count: 0, page: 1, per_page: 20, has_more: false });
    fireEvent.press(screen.getByTestId('directory-retry'));
    await waitFor(() => expect(screen.queryByTestId('directory-error')).toBeNull());

    expect(mockSearchProviders.mock.calls.length).toBe(attempts + 1);
    expect(mockSearchProviders.mock.calls[attempts]?.[0]).toEqual(firstParams);
  }, 15_000);
});

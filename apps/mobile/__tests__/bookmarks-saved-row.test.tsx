import { fireEvent, screen } from '@testing-library/react-native';

// PR-089 — SavedRow must distinguish a FAILED resolution fetch (transient →
// "Couldn't load right now" + tap-to-retry, Remove still available) from a
// RESOLVED null (genuinely gone → "No longer available", inert).
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/directory/queries', () => ({ getProviderById: jest.fn() }));
jest.mock('@/lib/articles', () => ({ getArticleBySlug: jest.fn() }));
jest.mock('@/features/bookmarks/hooks', () => ({ useToggleBookmark: jest.fn() }));
jest.mock('@/lib/use-theme-colors', () => ({
  useThemeColors: () => ({ inkSecondary: '#5f6c72', primary: '#1A9B8C' }),
}));

import { router } from 'expo-router';

import { SavedRow } from '@/features/bookmarks/SavedRow';
import { useToggleBookmark } from '@/features/bookmarks/hooks';
import type { Bookmark } from '@/features/bookmarks/types';
import { getProviderById } from '@/features/directory/queries';

import { renderWithProviders } from './_helpers';

const getByIdMock = getProviderById as unknown as jest.Mock;
const toggleMock = useToggleBookmark as unknown as jest.Mock;
const mutate = jest.fn();

const ITEM: Bookmark = {
  id: 'b1',
  user_id: 'u',
  resource_type: 'provider',
  resource_id: 'pid',
  created_at: 't1',
};

beforeEach(() => {
  jest.clearAllMocks();
  toggleMock.mockReturnValue({ mutate });
});

describe('SavedRow resolution states (PR-089)', () => {
  it('shows the resolved title and routes on tap', async () => {
    getByIdMock.mockResolvedValue({ display_name: 'Maya Feldman' });
    renderWithProviders(<SavedRow item={ITEM} />, { query: true });
    expect(await screen.findByText('Maya Feldman')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-row-b1'));
    expect(router.push).toHaveBeenCalledWith('/find/provider/pid');
  });

  it('labels a RESOLVED null "No longer available" and stays inert', async () => {
    getByIdMock.mockResolvedValue(null);
    renderWithProviders(<SavedRow item={ITEM} />, { query: true });
    expect((await screen.findAllByText('No longer available')).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('saved-row-b1'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('labels a FAILED fetch as transient, retries on tap, and keeps Remove available', async () => {
    getByIdMock.mockRejectedValue(new Error('transient'));
    renderWithProviders(<SavedRow item={ITEM} />, { query: true });
    expect(await screen.findByText("Couldn't load right now")).toBeTruthy();
    expect(screen.getByText('Tap to retry')).toBeTruthy();
    expect(screen.queryByText('No longer available')).toBeNull();

    // Remove stays available while errored.
    fireEvent.press(screen.getByLabelText('Remove'));
    expect(mutate).toHaveBeenCalledWith({
      ref: { resource_type: 'provider', resource_id: 'pid' },
      wasSaved: true,
    });

    // Tapping the row retries the fetch instead of navigating.
    getByIdMock.mockResolvedValue({ display_name: 'Maya Feldman' });
    fireEvent.press(screen.getByTestId('saved-row-b1'));
    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByText('Maya Feldman')).toBeTruthy();
  });
});

import { act, fireEvent, screen } from '@testing-library/react-native';
import { useSyncExternalStore } from 'react';

jest.mock('@/features/offline/useIsOnline', () => ({ useIsOnline: jest.fn() }));
jest.mock('@/components/HeaderAvatar', () => ({ HeaderAvatar: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useFocusEffect: () => undefined }));

import FindScreen from '@/app/(tabs)/(find)/find';
import { useIsOnline } from '@/features/offline/useIsOnline';
import {
  __resetDirectoryLocationCacheForTests,
  resetDirectoryLocation,
} from '@/lib/persistence/directory-location';

import { renderWithProviders } from './_helpers';

const onlineMock = useIsOnline as unknown as jest.Mock;

describe('S28 Find — prototype port', () => {
  beforeEach(() => {
    // Fresh, unconfigured location so the screen starts on the location step.
    __resetDirectoryLocationCacheForTests();
    resetDirectoryLocation();
    __resetDirectoryLocationCacheForTests();
  });

  it('offline: shows the honest fallback instead of the directory', () => {
    onlineMock.mockReturnValue(false);
    renderWithProviders(<FindScreen />, { haptics: true, query: true });
    expect(screen.getByTestId('find-offline')).toBeTruthy();
  });

  it('online + first visit: shows the location hero', () => {
    onlineMock.mockReturnValue(true);
    renderWithProviders(<FindScreen />, { haptics: true, query: true });
    expect(screen.getByText('Find care')).toBeTruthy();
    expect(screen.getByText('Use my location')).toBeTruthy();
    expect(screen.getByText('Enter my state instead')).toBeTruthy();
  });

  // PR-061 — offline renders as an overlay ON TOP of the still-mounted wizard, so a
  // momentary connectivity blip cannot destroy the user's step state.
  it('a connectivity blip overlays the fallback without losing wizard state', () => {
    const listeners = new Set<() => void>();
    let netOnline = true;
    const setNetOnline = (v: boolean) => {
      netOnline = v;
      act(() => {
        for (const l of listeners) l();
      });
    };
    onlineMock.mockImplementation(() =>
      useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => netOnline,
      ),
    );

    renderWithProviders(<FindScreen />, { haptics: true, query: true });
    // Walk one step into the wizard.
    fireEvent.press(screen.getByText('Enter my state instead'));
    expect(screen.getByText('Which state?')).toBeTruthy();

    // Blip offline: fallback overlays, wizard stays mounted underneath —
    // hidden from the a11y tree (importantForAccessibility/no-hide-descendants,
    // second-pass a11y fix), so the query must opt into hidden elements.
    setNetOnline(false);
    expect(screen.getByTestId('find-offline')).toBeTruthy();
    expect(screen.getByText('Which state?', { includeHiddenElements: true })).toBeTruthy();

    // Reconnect: overlay gone, step state preserved.
    setNetOnline(true);
    expect(screen.queryByTestId('find-offline')).toBeNull();
    expect(screen.getByText('Which state?')).toBeTruthy();
  });
});

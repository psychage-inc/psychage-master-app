// Root-layout cold-start smoke. Proves the provider / font-gate / cold-start
// chain in app/_layout.tsx mounts without throwing, AND that rendering it fires
// the side-effect `@/lib/adapters/featureFlags` import — the behavioral half of
// the F-12 replacement (the cold-start vitest test covers the adapter's own
// module-init effect; this proves _layout.tsx actually pulls that adapter in).
//
// Minimum off-device mocks: useFonts → loaded (no font binaries in jest), the
// Expo Router Stack → passthrough (no navigation container in a unit render),
// splash-screen → noop native module. Storage stays the real in-memory seam.
import { render } from '@testing-library/react-native';

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true]) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('expo-router', () => {
  // Return children directly — no JSX / createElement in the factory, or
  // NativeWind's babel transform leaks an out-of-scope css-interop ref into it
  // (jest forbids out-of-scope vars in a mock factory).
  const Stack = ({ children }: { children?: unknown }) => children ?? null;
  Stack.Screen = () => null;
  // RootLayout mounts <AuthEffects/>, which calls useRouter() via the
  // deep-link + session-revalidate hooks (both use router.replace). Provide a
  // no-op router stub so the cold-start chain mounts without throwing.
  const router = {
    replace: () => {},
    push: () => {},
    back: () => {},
    navigate: () => {},
    dismiss: () => {},
  };
  return { Stack, router, useRouter: () => router };
});

import { useFonts } from 'expo-font';

import RootLayout from '@/app/_layout';
import { storage } from '@/lib/adapters/storage';
import { STORAGE_KEY } from '@/lib/persistence/tier-flags';

describe('RootLayout — cold-start smoke', () => {
  beforeEach(() => {
    (useFonts as jest.Mock).mockReturnValue([true]);
  });

  it('mounts the provider/font/cold-start chain without throwing', () => {
    expect(() => render(<RootLayout />)).not.toThrow();
  });

  it('a font-load ERROR still mounts the app (system fonts) instead of hanging the gate', () => {
    (useFonts as jest.Mock).mockReturnValue([false, new Error('font failed to load')]);
    const { toJSON } = render(<RootLayout />);
    // The gate treats `loaded || error` as settled — the tree renders, it is not held at null.
    expect(toJSON()).not.toBeNull();
  });

  it('its side-effect featureFlags import hydrated tier flags into the storage seam', () => {
    render(<RootLayout />);
    expect(storage.get(STORAGE_KEY)).not.toBeNull();
  });
});

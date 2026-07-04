import type { EngagementStore, Moment, MomentDraft } from '@psychage/shared/engagement';
import { act, screen } from '@testing-library/react-native';

// Route render needs a focus-capable router shim (no navigation container in a
// unit render). Redirect records its target into mockRedirects (rendering a RN
// element in the factory would trip NativeWind's out-of-scope css-interop ref —
// see app-layout-smoke.test); useFocusEffect runs on mount AND captures the
// callback so tests can re-fire "focus".
const mockFocus: { cb: (() => void) | null } = { cb: null };
const mockRedirects: string[] = [];
let mockAuthValue: { session: unknown; hydrated: boolean };

jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
  return {
    router,
    useRouter: () => router,
    usePathname: () => '/',
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        mockFocus.cb = cb;
        cb();
      }, [cb]);
    },
    Redirect: ({ href }: { href: string }) => {
      mockRedirects.push(href);
      return null;
    },
  };
});

jest.mock('@/features/auth', () => ({ useAuth: () => mockAuthValue }));

let mockMomentStore: EngagementStore;
jest.mock('@/lib/moment-store', () => ({ getMomentStore: () => mockMomentStore }));

import TodayScreen from '@/app/(tabs)/(today)/index';
import { storage } from '@/lib/adapters/storage';
import { markTourSeen } from '@/lib/persistence/tour';

import { renderWithProviders } from './_helpers';

// In-memory EngagementStore double (same shape as HomeContainer.test) closing over
// a mutable array so tests can add moments between focus events.
function makeStore(moments: Moment[]): EngagementStore {
  let n = 0;
  return {
    append: (draft: MomentDraft) => {
      const m: Moment = {
        id: `m${n++}`,
        timestamp: new Date().toISOString(),
        valence: draft.valence,
        labels: draft.labels ?? [],
        context: draft.context ?? [],
        routedToSupport: draft.routedToSupport ?? false,
        ...(draft.note !== undefined ? { note: draft.note } : {}),
      };
      moments.push(m);
      return m;
    },
    getAll: () => [...moments],
    getRecent: (count) => [...moments].slice(-count).reverse(),
    getRange: () => [...moments],
    dayRollup: () => [],
    ingestRemote: () => {},
  };
}

function moment(id: string, ts: string, valence: Moment['valence']): Moment {
  return { id, timestamp: ts, valence, labels: [], context: [], routedToSupport: false };
}

const CAPTURE_CTA = 'Check in — 30 seconds';

describe('TodayScreen route gates', () => {
  beforeEach(() => {
    mockFocus.cb = null;
    mockRedirects.length = 0;
  });

  // PR-083: an iOS reinstall with a keychain session boots with session=null until
  // hydration resolves — the welcome gate must not decide on that transient null.
  it('holds (renders nothing, no redirect) while the auth session is still hydrating', () => {
    mockAuthValue = { session: null, hydrated: false };
    mockMomentStore = makeStore([]);
    renderWithProviders(<TodayScreen />, { haptics: true });

    expect(mockRedirects).toHaveLength(0);
    expect(screen.queryByText(CAPTURE_CTA)).toBeNull();
  });

  it('redirects a signed-out first visit to /welcome once hydration has settled', () => {
    mockAuthValue = { session: null, hydrated: true };
    mockMomentStore = makeStore([]);
    renderWithProviders(<TodayScreen />, { haptics: true });

    expect(mockRedirects).toContain('/welcome');
  });

  // PR-071: the home model derives from the store at render — regaining tab focus
  // must re-derive it (a Moment captured on Compass, date rollover), mirroring
  // compass.tsx's focus re-read.
  it('re-derives the home model when the tab regains focus', () => {
    markTourSeen(storage); // keep the one-time tour out of this render
    const yesterdayNoon = new Date();
    yesterdayNoon.setDate(yesterdayNoon.getDate() - 1);
    yesterdayNoon.setHours(12, 0, 0, 0);
    const moments: Moment[] = [moment('a', yesterdayNoon.toISOString(), 3)];
    mockAuthValue = { session: { userId: 'u1' }, hydrated: true };
    mockMomentStore = makeStore(moments);

    renderWithProviders(<TodayScreen />, { haptics: true });

    // Not checked in today → the capture CTA is offered.
    expect(screen.getByText(CAPTURE_CTA)).toBeTruthy();

    // A Moment lands from elsewhere (e.g. Compass), then the tab regains focus.
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    moments.push(moment('b', todayNoon.toISOString(), 3));
    act(() => {
      mockFocus.cb?.();
    });

    // The model re-derived: today is now checked in, the capture CTA is replaced.
    expect(screen.queryByText(CAPTURE_CTA)).toBeNull();
  });
});

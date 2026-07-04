import { fireEvent, screen } from '@testing-library/react-native';

// Route render needs a focus-capable router shim: Stack.Screen → null (no
// navigation container in a unit render), useFocusEffect → plain mount effect.
jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = ({ children }: { children?: unknown }) => (children as never) ?? null;
  Stack.Screen = () => null;
  return {
    Stack,
    router: {
      push: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      canGoBack: () => true,
    },
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

import ClarityRoute from '@/app/tools/clarity';
import { CLARITY_QUESTIONS } from '@/features/clarity/questions';
import { CLARITY_STORAGE_KEY } from '@/features/clarity/result-store';
import { storage } from '@/lib/adapters/storage';
import { getClarityStore, resetClarityStore } from '@/lib/clarity-store';

import { renderWithProviders } from './_helpers';

/** Narrow an indexed access to a definite value (tsc noUncheckedIndexedAccess). */
function req<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

// PR-034 regression: `hasHistory` used to be a one-shot `store.count > 0` read at
// route render, so a first-ever assessment → Retake landed on an intro with no
// "past snapshots" link until the screen was re-entered. The route now tracks it
// in state (saveResult flips it; focus re-reads it).
describe('ClarityRoute (store wiring)', () => {
  beforeEach(() => {
    storage.remove(CLARITY_STORAGE_KEY);
    resetClarityStore();
  });

  it('offers "See your past snapshots" on the intro right after a first-ever run’s Retake, having persisted exactly one snapshot', async () => {
    renderWithProviders(<ClarityRoute />, { haptics: true });

    // First-ever visit: empty store → no history link.
    expect(screen.queryByText('See your past snapshots')).toBeNull();

    press('Begin');
    for (const q of CLARITY_QUESTIONS) {
      press(req(q.options[0], q.id).label);
    }
    await screen.findByText('/ 100', {}, { timeout: 4000 });

    // The route persisted the run once (once-per-run guard, PR-024).
    expect(getClarityStore().count).toBe(1);

    press('Retake assessment');

    // Same mount, no re-entry — the intro now offers the history link.
    expect(screen.getByText('See your past snapshots')).toBeTruthy();
  }, 15000);
});

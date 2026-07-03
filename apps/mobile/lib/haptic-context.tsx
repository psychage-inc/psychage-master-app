import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { storage } from '@/lib/adapters/storage';
import { loadHapticsEnabled, saveHapticsEnabled } from '@/lib/persistence/haptics';

import { fireHaptic, type HapticEvent } from './haptics';

type HapticContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  fireHaptic: (event: HapticEvent) => void;
};

const HapticContext = createContext<HapticContextValue | null>(null);

// `enabled` is persisted through the DI storage seam behind an SR-13 versioned
// envelope (lib/persistence/haptics.ts — reseed-on-anomaly, default ON). The
// lazy initializer runs the migrator once at mount; every toggle writes back a
// clean v1 envelope, so an OFF choice survives app relaunch (PR-001).
export function HapticProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => loadHapticsEnabled(storage));
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    saveHapticsEnabled(storage, value);
  }, []);

  const fire = useCallback((event: HapticEvent) => {
    fireHaptic(event, () => enabledRef.current);
  }, []);

  const value = useMemo<HapticContextValue>(
    () => ({ enabled, setEnabled, fireHaptic: fire }),
    [enabled, setEnabled, fire],
  );

  return <HapticContext.Provider value={value}>{children}</HapticContext.Provider>;
}

const fallbackValue: HapticContextValue = {
  enabled: false,
  setEnabled: () => {},
  fireHaptic: () => {},
};

export function useHaptics(): HapticContextValue {
  const value = useContext(HapticContext);
  return value ?? fallbackValue;
}

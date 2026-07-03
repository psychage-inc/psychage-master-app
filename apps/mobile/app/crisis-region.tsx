import { Stack } from 'expo-router';

import { localeDeviceRegionHint } from '@/features/crisis/device-region';
import type { RegionCode } from '@/features/crisis/helpline-schema';
import { CRISIS_DATASET } from '@/features/crisis/helplines.fixtures';
import {
  defaultDeviceRegionHint,
  loadRegionOverride,
  resolveRegion,
  saveRegionOverride,
} from '@/features/crisis/region';
import { RegionPickerView } from '@/features/crisis/RegionPickerView';
import { storage } from '@/lib/adapters/storage';
import { useReducedMotion } from '@/lib/motion';
import { goBackOr } from '@/lib/nav';

// S12 route. The C-SEARCH-LIST region picker. Selecting persists the override
// (local-only) and returns to S11, which re-resolves on focus. Slides on top of S11
// (slide_from_right, fade under reduced-motion) — consistent with the crisis register.

export default function CrisisRegionScreen() {
  const reduced = useReducedMotion();
  const current = resolveRegion({
    storedOverride: loadRegionOverride(storage),
    deviceHint: localeDeviceRegionHint() ?? defaultDeviceRegionHint(),
  });

  const handleSelect = (code: RegionCode) => {
    saveRegionOverride(storage, code);
    goBackOr('/crisis');
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, animation: reduced ? 'fade' : 'slide_from_right' }}
      />
      <RegionPickerView
        regions={CRISIS_DATASET.regions}
        currentRegion={current}
        onSelect={handleSelect}
        onBack={() => goBackOr('/crisis')}
      />
    </>
  );
}

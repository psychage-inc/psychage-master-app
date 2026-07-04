import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { HomeContainer } from '@/components/home/HomeContainer';
import { FirstRunTour } from '@/features/onboarding/FirstRunTour';
import { useAuth } from '@/features/auth';
import { storage } from '@/lib/adapters/storage';
import { getMomentStore } from '@/lib/moment-store';
import { isOnboardingSeen, isWelcomeSeen } from '@/lib/persistence/onboarding';
import { isTourSeen, markTourSeen } from '@/lib/persistence/tour';

// S3 "Today" home. Binds the real (MMKV-backed) CheckInRecordStore to HomeContainer.
//
// First-launch routing (in order):
//   1. Front-door Welcome gate (S0) — shown once, only when NOT signed in and the gate
//      hasn't been engaged. "Continue" there enters anonymously (Tier-1 intact); signed-in
//      users skip it (anonymous-first invariant, Amendment 2026-06-16).
//   2. Product onboarding (S1) — on first run before onboarding is seen.
// The `checkin` param (set by S2's "Do your first check-in") opens S4 over the first-run
// home via HomeContainer's autoOpenCheckIn seam — and suppresses both redirects, since the
// user is arriving FROM onboarding. Importing the shared package at runtime keeps this
// file off the Jest path (Jest does not transform the workspace TS package).
export default function TodayScreen() {
  const { checkin } = useLocalSearchParams<{ checkin?: string }>();
  const { session, hydrated } = useAuth();
  const store = getMomentStore();
  const firstRun = store.getRecent(1).length === 0;
  const arrivingFromOnboarding = checkin === '1';
  // One-time cross-tab tour: after onboarding, on a normal launch (never over the
  // auto-opened first check-in sheet). Skippable; never blocks crisis.
  const [showTour, setShowTour] = useState(() => !arrivingFromOnboarding && !isTourSeen(storage));

  // Mirror compass.tsx's focus re-read: bump state on tab focus so the home model
  // re-derives from the store on every re-entry (a Moment captured on Compass, date
  // rollover while the app sat on another tab) instead of staying mount-stale.
  const [, setFocusTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusTick((t) => t + 1);
    }, []),
  );

  // Session hydration (secure-store getSession) may still be in flight on a cold
  // start — e.g. an iOS reinstall that kept the keychain session. Deciding the
  // welcome redirect on a transiently-null session would bounce a signed-in user to
  // /welcome, so hold. The native splash stays up until hydration (AuthEffects), so
  // rendering nothing here paints no visible frame.
  if (!hydrated) return null;

  if (!session && !arrivingFromOnboarding && !isWelcomeSeen(storage)) {
    return <Redirect href="/welcome" />;
  }

  if (firstRun && !arrivingFromOnboarding && !isOnboardingSeen(storage)) {
    return <Redirect href="/onboarding/welcome" />;
  }

  return (
    <>
      <HomeContainer store={store} autoOpenCheckIn={arrivingFromOnboarding} />
      {showTour && (
        <FirstRunTour
          onDone={() => {
            markTourSeen(storage);
            setShowTour(false);
          }}
        />
      )}
    </>
  );
}

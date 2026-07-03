import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { ClarityFlow } from '@/features/clarity/ClarityFlow';
import { CLARITY_HISTORY_CAP } from '@/features/clarity/result-store';
import { getScoreLabel } from '@/features/clarity/scoring';
import type { ClarityHistoryItem, ClarityResult } from '@/features/clarity/types';
import { getClarityStore } from '@/lib/clarity-store';
import { useReducedMotion } from '@/lib/motion';
import { goBackOr } from '@/lib/nav';

// S32 Clarity Score — NATIVE flow (supersedes the former WebView embed of
// /m/clarity-score). The store is wired here at the route so ClarityFlow stays free
// of the store import (render tests inject a double). LOCAL-ONLY: results are saved to
// the device's MMKV-backed store and never sent anywhere (SR-4). Crisis is reachable
// on every screen via the flow's Help-now pill and the mid-flow interstitial (SR-2).
export default function ClarityRoute() {
  const reduced = useReducedMotion();
  const store = getClarityStore();

  // "Past snapshots" link on the intro. Held in state (not a one-shot render read) so
  // it stays fresh across a first-ever save → Retake within one mount; the focus
  // re-read keeps it fresh on re-entry to this screen.
  const [hasHistory, setHasHistory] = useState(() => store.count > 0);
  useFocusEffect(
    useCallback(() => {
      setHasHistory(store.count > 0);
    }, [store]),
  );

  const saveResult = (result: ClarityResult): number | null => {
    const previous = store.getRecent(1)[0]?.composite ?? null;
    store.save(result);
    setHasHistory(true);
    return previous;
  };

  // Same-sitting re-completion (BACK from results → re-answer) replaces the
  // just-saved snapshot so the persisted record matches the dashboard.
  const replaceLatestResult = (result: ClarityResult): void => {
    store.replaceLatest(result);
  };

  // History for the dashboard's History tab — newest first, adapted to the web's
  // ClarityHistoryItem shape (label derived from the composite). Reads the FULL
  // stored history (the store caps at CLARITY_HISTORY_CAP): the History tab's
  // "since your first assessment" comparisons need the true earliest snapshot,
  // not the oldest of a shorter window.
  const getHistory = (): ClarityHistoryItem[] =>
    store.getRecent(CLARITY_HISTORY_CAP).map((s) => ({
      id: s.id,
      date: s.date,
      score: s.composite,
      label: getScoreLabel(s.composite).label,
      domainScores: s.domains,
    }));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: reduced ? 'fade' : 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <ClarityFlow
        onExit={() => goBackOr('/compass')}
        onCrisisResources={() => router.push('/crisis')}
        onRecommend={(route) => router.push(route as never)}
        onViewHistory={() => router.push('/tools/clarity-history')}
        saveResult={saveResult}
        replaceLatestResult={replaceLatestResult}
        getHistory={getHistory}
        hasHistory={hasHistory}
      />
    </>
  );
}

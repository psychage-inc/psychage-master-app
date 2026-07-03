import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { SessionPrepView, type SessionPrepWindow } from '@/components/therapist/SessionPrepView';
import {
  buildSessionPrepSummary,
  buildUnifiedExportHtml,
  enumerateDays,
  generateAndShare,
  THERAPIST_COPY,
} from '@/features/therapist';
import { expoPdfPrinter } from '@/features/therapist/pdf/expo-printer';
import { PDF_SHARE_FAILED_COPY } from '@/features/therapist/pdf/printer';
import { storage } from '@/lib/adapters/storage';
import { getMomentStore } from '@/lib/moment-store';
import { getNavigatorStore } from '@/lib/navigator-store';
import { loadPersonalization } from '@/lib/persistence/personalization';
import { getSleepStore } from '@/lib/sleep-store';

// "Prepare for your session" — ONE summary the person generates on demand before an
// appointment and shares THEMSELVES (system share sheet; Psychage never transmits — SR-4).
// The document bundles every tool with data in the window: Moments, Sleep, and the latest
// Symptom Navigator run (SUMMARY-ONLY — labels, never raw answers — SR-1/SR-4). A tool with
// nothing in the window is omitted. Lives under the settings stack so it inherits the
// native header + back chevron. Thin route: reads the LOCAL stores, builds the PDF locally
// (expo-print), hands it to the platform sheet. No provider gate — the person's own record.
// `expoPdfPrinter` is imported directly (the barrel excludes the native printer so Vitest
// never pulls expo-print/expo-sharing).
const uc = THERAPIST_COPY.unifiedExport;

// Window-scoped reads from the local-only tool stores. Navigator/Sleep are point-in-time
// records, so each is included only when it falls inside the chosen window.
function gather(window: SessionPrepWindow) {
  const moments = getMomentStore().getRange(window.from, window.to);
  const sleep = getSleepStore()
    .getRecent(400)
    .filter((e) => e.date >= window.from && e.date <= window.to);
  const latestRun = getNavigatorStore().getRecent(1)[0];
  const navigatorRun =
    latestRun && latestRun.date >= window.from && latestRun.date <= window.to
      ? latestRun
      : undefined;
  return { moments, sleep, navigatorRun };
}

export default function SessionPrepScreen() {
  // Double-tap guard: one generate/share at a time (a second share sheet rejects on Android).
  const [busy, setBusy] = useState(false);

  const countForWindow = (window: SessionPrepWindow) => {
    const { moments, sleep, navigatorRun } = gather(window);
    const includes: string[] = [];
    if (sleep.length > 0) includes.push(uc.sleepTitle);
    if (navigatorRun && navigatorRun.results.results.length > 0) includes.push(uc.navigatorTitle);
    return {
      dayCount: enumerateDays(window.from, window.to).length,
      momentCount: moments.length,
      includes,
    };
  };

  const onGenerate = async (fullName: string, window: SessionPrepWindow) => {
    if (busy) return;
    setBusy(true);
    try {
      const { moments, sleep, navigatorRun } = gather(window);
      const name = fullName || loadPersonalization(storage).name || uc.nameFallback;
      const navigatorSummary = navigatorRun
        ? {
            date: navigatorRun.date,
            areas: navigatorRun.results.results
              .slice(0, 5)
              .map((r) => ({ name: r.name, relevance: r.relevance_label })),
          }
        : undefined;
      const html = buildUnifiedExportHtml({
        fullName: name,
        from: window.from,
        to: window.to,
        generatedAt: new Date(),
        moments: moments.length > 0 ? buildSessionPrepSummary(moments, window) : undefined,
        sleep: sleep.length > 0 ? sleep : undefined,
        navigator: navigatorSummary,
      });
      const { ok } = await generateAndShare(html, expoPdfPrinter);
      if (!ok) Alert.alert(PDF_SHARE_FAILED_COPY.title, PDF_SHARE_FAILED_COPY.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: THERAPIST_COPY.sessionPrep.screenTitle }} />
      <SessionPrepView countForWindow={countForWindow} onGenerate={onGenerate} />
    </>
  );
}

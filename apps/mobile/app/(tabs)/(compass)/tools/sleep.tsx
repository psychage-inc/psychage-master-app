import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  buildSleepPdfHtml,
  type SleepPdfInput,
} from '@/features/sleep-architect/export/build-sleep-html';
import { SleepArchitectView } from '@/features/sleep-architect/SleepArchitectView';
import { generateAndShare } from '@/features/therapist';
import { expoPdfPrinter } from '@/features/therapist/pdf/expo-printer';
import { PDF_SHARE_FAILED_COPY } from '@/features/therapist/pdf/printer';

// S29 Sleep Architect — NATIVE. Replaces the former WebView wrapper around
// /m/sleep-architect (the 'sleep-architect' surface is retired). Pushed full-screen
// OUTSIDE the tabs → chrome-minimal (no tab bar, no GlobalHeader); the view carries
// its own crisis pill (SR-2) and back affordance. LOCAL-ONLY (SR-4).
//
// P59 export: the route owns the native PDF egress (build the HTML locally, hand it to
// the OS share sheet). `expoPdfPrinter` is imported directly — the therapist barrel
// excludes it so Vitest never pulls expo-print into a component render test.
export default function SleepRoute() {
  // Double-tap guard: one generate/share at a time (a second share sheet rejects on Android).
  const [exporting, setExporting] = useState(false);

  const onExport = async (input: SleepPdfInput) => {
    if (exporting) return;
    setExporting(true);
    try {
      const html = buildSleepPdfHtml(input);
      const { ok } = await generateAndShare(html, expoPdfPrinter);
      if (!ok) Alert.alert(PDF_SHARE_FAILED_COPY.title, PDF_SHARE_FAILED_COPY.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SleepArchitectView onClose={() => router.back()} onExport={onExport} />
    </>
  );
}

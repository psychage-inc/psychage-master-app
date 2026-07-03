import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import {
  generateProviderQuestions,
  runSymptomNavigator,
  type NavigatorResults,
  type UserSymptomInput,
} from '@psychage/shared/navigator';

import { localeDeviceRegionHint } from '@/features/crisis/device-region';
import { CRISIS_DATASET } from '@/features/crisis/helplines.fixtures';
import {
  defaultDeviceRegionHint,
  getEmergencyNumber,
  getHelplines,
  loadRegionOverride,
  resolveRegion,
} from '@/features/crisis/region';
import { NAVIGATOR_COPY } from '@/features/navigator/copy';
import { NAVIGATOR_KB } from '@/features/navigator/knowledge-base';
import { NavigatorFlow } from '@/features/navigator/NavigatorFlow';
import {
  buildNavigatorSummaryHtml,
  type NavigatorSummaryArea,
} from '@/features/navigator/pdf/build-navigator-html';
import { generateAndShare } from '@/features/therapist';
import { expoPdfPrinter } from '@/features/therapist/pdf/expo-printer';
import { PDF_SHARE_FAILED_COPY } from '@/features/therapist/pdf/printer';
import { isTierEnabled } from '@/lib/adapters';
import { storage } from '@/lib/adapters/storage';
import { useReducedMotion } from '@/lib/motion';
import { goBackOr } from '@/lib/nav';
import { getNavigatorStore } from '@/lib/navigator-store';
import { loadPersonalization } from '@/lib/persistence/personalization';

/** Device-local calendar day (YYYY-MM-DD) for the summary PDF — the run just completed. */
function localToday(): string {
  const d = new Date();
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// S — Symptom Navigator route. The ONLY place the shared navigator engine +
// provider-question generator are imported as VALUES — both are injected into
// NavigatorFlow so the flow + its tests stay off the Jest path (the shared TS package is
// not Jest-transformed; mirrors dev-navigator.tsx). The KB is the real, clinically-
// reviewed data (knowledge-base.ts). Fully on-device, fully offline; the flow's reducer
// state is in-memory, so navigating away leaves zero residue (SR-4).

export default function NavigatorScreen() {
  const reduced = useReducedMotion();
  // Double-tap guard for the PDF share — a second generateAndShare while the
  // sheet is opening resolves {ok:false} on Android and would fire a spurious
  // failure alert (second-pass review of PR-025).
  const sharingRef = useRef(false);
  const region = resolveRegion({
    storedOverride: loadRegionOverride(storage),
    deviceHint: localeDeviceRegionHint() ?? defaultDeviceRegionHint(),
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: reduced ? 'fade' : 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <NavigatorFlow
        kb={NAVIGATOR_KB}
        runNavigator={(inputs: UserSymptomInput[]) =>
          runSymptomNavigator(inputs, NAVIGATOR_KB, region, isTierEnabled)
        }
        getProviderQuestions={(results: NavigatorResults, inputs: UserSymptomInput[]) =>
          generateProviderQuestions({
            results,
            selectedSymptoms: new Map(inputs.map((i) => [i.symptom_id, i])),
            knowledgeBase: NAVIGATOR_KB,
          })
        }
        onResults={(inputs, results) => getNavigatorStore().save(inputs, results)}
        onExit={() => goBackOr('/compass')}
        emergencyNumber={getEmergencyNumber(CRISIS_DATASET, region)}
        helplines={getHelplines(CRISIS_DATASET, region)}
        onFindCare={() => router.push('/find')}
        onDownloadSummary={async (areas: NavigatorSummaryArea[]) => {
          if (sharingRef.current) return;
          sharingRef.current = true;
          // Build LOCALLY (offline) + hand to the platform share sheet (SR-4: Psychage
          // never transmits). Summary-only — LABELS, no raw answers, no confidence number.
          const html = buildNavigatorSummaryHtml({
            fullName: loadPersonalization(storage).name ?? NAVIGATOR_COPY.summaryDocTitle,
            date: localToday(),
            areas,
          });
          const { ok } = await generateAndShare(html, expoPdfPrinter);
          sharingRef.current = false;
          if (!ok) Alert.alert(PDF_SHARE_FAILED_COPY.title, PDF_SHARE_FAILED_COPY.message);
        }}
        onHome={() => router.replace('/')}
        onViewHistory={() => router.push('/tools/navigator-history')}
        onRemoveLast={() => {
          const last = getNavigatorStore().getRecent(1)[0];
          if (last) getNavigatorStore().delete(last.id);
        }}
      />
    </>
  );
}

import { useEffect, useMemo, useReducer, useRef } from 'react';
import { ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import type {
  KnowledgeBase,
  NavigatorResults,
  SymptomDomain,
  UserSymptomInput,
} from '@psychage/shared/navigator';

import type { RadarDatum } from '@/components/ui/charts';
import { Text } from '@/components/ui/Text';
import { ToolScreen } from '@/components/ui/ToolScreen';
import type { HelplineRow } from '@/features/crisis/helpline-schema';
import { useReducedMotion } from '@/lib/motion';

import type { NavigatorSummaryArea } from './pdf/build-navigator-html';

import { stepEnter } from './animations';
import { ChipXL } from './components/ChipXL';
import { NAVIGATOR_COPY } from './copy';
import {
  buildUserInputs,
  initialNavigatorState,
  isExitOnBack,
  type NavStep,
  navigatorReducer,
} from './flow';
import { HaltView } from './HaltView';
import { DetailScreen } from './screens/DetailScreen';
import { DomainSelectionScreen, DOMAINS } from './screens/DomainSelectionScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultsScreen, type ResultSymptomVM } from './screens/ResultsScreen';
import { SymptomSelectionScreen } from './screens/SymptomSelectionScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

// The Symptom Navigator flow — web-V2 parity (welcome → domains → symptoms → per-symptom
// details → safety → processing → results | halt). Fully ON-DEVICE and in-memory (SR-4).
// The scoring engine + provider-question generator are INJECTED (`runNavigator` /
// `getProviderQuestions`) so the shared package stays off every Jest path — this
// container imports only TYPES from @psychage/shared. The KB is passed as DATA.

export type RunNavigator = (inputs: UserSymptomInput[]) => NavigatorResults;
export type GetProviderQuestions = (
  results: NavigatorResults,
  inputs: UserSymptomInput[],
) => string[];

const ALL_DOMAINS = DOMAINS.map((d) => d.id);
const DOMAIN_LABEL = new Map<SymptomDomain, string>(DOMAINS.map((d) => [d.id, d.label]));

const STEP_ORDER: NavStep[] = [
  'welcome',
  'domains',
  'symptoms',
  'details',
  'safety',
  'processing',
  'results',
  'halt',
];

export interface NavigatorFlowProps {
  readonly kb: KnowledgeBase;
  readonly runNavigator: RunNavigator;
  readonly getProviderQuestions: GetProviderQuestions;
  readonly onExit: () => void;
  readonly emergencyNumber: string;
  readonly helplines: readonly HelplineRow[];
  readonly onFindCare: () => void;
  /**
   * Fired once when a NON-crisis results screen is reached, with the inputs and
   * computed results. The route uses this to persist the run to the local-only
   * history store (SR-4: never leaves the device). Optional so render tests and
   * dev harnesses can omit it.
   */
  readonly onResults?: (inputs: UserSymptomInput[], results: NavigatorResults) => void;
  /** P39 — build + share the summary-only PDF for the just-completed run (the route owns
   *  native print). Receives the surfaced areas as LABELS only (SR-1/SR-4). */
  readonly onDownloadSummary?: (areas: NavigatorSummaryArea[]) => void;
  /** P41 — results actions fulfilled by the route (navigation + local-history delete). */
  readonly onHome?: () => void;
  readonly onViewHistory?: () => void;
  readonly onRemoveLast?: () => void;
}

export function NavigatorFlow({
  kb,
  runNavigator,
  getProviderQuestions,
  onExit,
  emergencyNumber,
  helplines,
  onFindCare,
  onResults,
  onDownloadSummary,
  onHome,
  onViewHistory,
  onRemoveLast,
}: NavigatorFlowProps) {
  const [state, dispatch] = useReducer(navigatorReducer, initialNavigatorState);
  const reduced = useReducedMotion();

  // Direction for the step slide (forward = +1, back = -1).
  const prevIdx = useRef(STEP_ORDER.indexOf(state.step));
  const idx = STEP_ORDER.indexOf(state.step);
  const direction = idx >= prevIdx.current ? 1 : -1;
  prevIdx.current = idx;

  // Symptoms scoped to the selected domains (active only) — the symptom-screen source.
  const domainSymptoms = useMemo(
    () =>
      kb.symptoms.filter((s) => s.is_active && state.selectedDomains.includes(s.domain)),
    [kb.symptoms, state.selectedDomains],
  );

  // Selected symptom objects in selection order — drives the Detail pager.
  const orderedSelected = useMemo(
    () =>
      state.selectedSymptomIds
        .map((id) => kb.symptoms.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => s != null),
    [kb.symptoms, state.selectedSymptomIds],
  );

  // "Areas your experience touches" — domain COVERAGE of the selected symptoms: count per
  // domain, normalized to the busiest domain (= 100). A DESCRIPTIVE breadth measure (where
  // what you reported clusters), NEVER confidence or severity. Drives the results
  // DomainRadar (P39); the screen renders it only when ≥3 areas have data.
  const areaPoints = useMemo<RadarDatum[]>(() => {
    const counts = new Map<SymptomDomain, number>();
    for (const id of state.selectedSymptomIds) {
      const def = kb.symptoms.find((s) => s.id === id);
      if (!def) continue;
      counts.set(def.domain, (counts.get(def.domain) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].map(([domain, count]) => ({
      label: DOMAIN_LABEL.get(domain) ?? domain,
      value: Math.round((count / max) * 100),
    }));
  }, [kb.symptoms, state.selectedSymptomIds]);

  // Engine runs only once results are needed (processing / results / halt-by-engine).
  const needsEngine = state.step === 'processing' || state.step === 'results';
  const engineResult = useMemo<NavigatorResults | null>(
    () => (needsEngine ? runNavigator(buildUserInputs(state)) : null),
    [needsEngine, runNavigator, state],
  );

  // Persist exactly once per completed run: when a non-crisis results screen is
  // reached. Crisis-halt runs (should_halt) are never stored. Local-only (SR-4).
  const savedRef = useRef(false);
  useEffect(() => {
    if (
      state.step === 'results' &&
      engineResult &&
      !engineResult.safety.should_halt &&
      onResults &&
      !savedRef.current
    ) {
      savedRef.current = true;
      onResults(buildUserInputs(state), engineResult);
    }
  }, [state, engineResult, onResults]);

  const handleBack = () => {
    if (isExitOnBack(state)) onExit();
    else dispatch({ type: 'BACK' });
  };

  // ── Halt: explicit "Yes" OR the engine's red-flag screen ───────────────────────
  const engineHalts = engineResult?.safety.should_halt ?? false;
  if (state.step === 'halt' || engineHalts) {
    return (
      <HaltView
        emergencyNumber={emergencyNumber}
        helplines={helplines}
        onGoBack={() => dispatch({ type: 'BACK' })}
      />
    );
  }

  // ── Processing (engine did not halt) ───────────────────────────────────────────
  if (state.step === 'processing') {
    return (
      <ToolScreen scroll="none">
        <ProcessingScreen onDone={() => dispatch({ type: 'SHOW_RESULTS' })} />
      </ToolScreen>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────────
  if (state.step === 'results' && engineResult) {
    const symptomDetails: ResultSymptomVM[] = state.selectedSymptomIds.map((id) => {
      const def = kb.symptoms.find((s) => s.id === id);
      const detail = state.details[id];
      return {
        id,
        name: def?.name ?? id,
        severity: detail?.severity,
        frequency: detail?.frequency,
      };
    });
    const questions = getProviderQuestions(engineResult, buildUserInputs(state));
    // Summary areas for the PDF — LABELS only (SR-1: never a numeric confidence; SR-4:
    // no raw answers). Mirrors the therapist tool-summary shape.
    const summaryAreas: NavigatorSummaryArea[] = engineResult.results
      .slice(0, 5)
      .map((r) => ({ name: r.name, relevance: r.relevance_label }));

    return (
      <ToolScreen scroll="none" onBack={handleBack}>
        <ResultsScreen
          results={engineResult}
          symptomDetails={symptomDetails}
          questions={questions}
          areaPoints={areaPoints}
          emergencyNumber={emergencyNumber}
          helplines={helplines}
          onFindCare={onFindCare}
          onStartOver={() => {
            // "Start over" begins a NEW run — re-arm the once-per-run persist guard.
            // The guard previously held for the component's lifetime, so a second
            // completed run was never saved to history while ResultsScreen still
            // claimed "Saved on this device", and "Remove this exploration" deleted
            // the PREVIOUS run's record (PR-019).
            savedRef.current = false;
            dispatch({ type: 'RESET' });
          }}
          onDownloadSummary={onDownloadSummary ? () => onDownloadSummary(summaryAreas) : undefined}
          onHome={onHome}
          onViewHistory={onViewHistory}
          onRemoveSaved={onRemoveLast}
        />
      </ToolScreen>
    );
  }

  // ── Input steps (welcome → domains → symptoms → details → safety) ───────────────
  const current = orderedSelected[state.detailIndex];

  return (
    <ToolScreen scroll="none" onBack={state.step === 'welcome' ? undefined : handleBack}>
      <Animated.View
        key={`${state.step}:${state.detailIndex}:${state.symptomPage}`}
        entering={stepEnter(direction, reduced)}
        className="flex-1"
      >
        {state.step === 'welcome' ? <WelcomeScreen onStart={() => dispatch({ type: 'START' })} /> : null}

        {state.step === 'domains' ? (
          <DomainSelectionScreen
            selected={state.selectedDomains}
            onToggle={(domain) => dispatch({ type: 'TOGGLE_DOMAIN', domain })}
            onSelectAll={() => dispatch({ type: 'SELECT_ALL_DOMAINS', domains: ALL_DOMAINS })}
            onNext={() => dispatch({ type: 'DOMAINS_NEXT' })}
          />
        ) : null}

        {state.step === 'symptoms' ? (
          <SymptomSelectionScreen
            symptoms={domainSymptoms}
            selectedIds={state.selectedSymptomIds}
            emergencyNumber={emergencyNumber}
            page={state.symptomPage}
            onToggle={(id) => dispatch({ type: 'TOGGLE_SYMPTOM', id })}
            onAddMany={(ids) => dispatch({ type: 'ADD_SYMPTOMS', ids })}
            onRemoveMany={(ids) => dispatch({ type: 'REMOVE_SYMPTOMS', ids })}
            onPageNext={() => dispatch({ type: 'SYMPTOMS_PAGE_NEXT' })}
            onContinue={() => dispatch({ type: 'SYMPTOMS_NEXT' })}
          />
        ) : null}

        {state.step === 'details' && current ? (
          <DetailScreen
            symptom={current}
            index={state.detailIndex}
            total={orderedSelected.length}
            detail={state.details[current.id]}
            onSet={(patch) => dispatch({ type: 'SET_DETAIL', id: current.id, patch })}
            onNext={() => dispatch({ type: 'DETAIL_NEXT' })}
          />
        ) : null}

        {state.step === 'safety' ? (
          <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-2">
            <Text variant="h1" accessibilityRole="header">
              {NAVIGATOR_COPY.severityQuestion}
            </Text>
            <ChipXL
              label={NAVIGATOR_COPY.severityNo}
              onPress={() => dispatch({ type: 'ANSWER_SAFETY', answer: 'no' })}
            />
            <ChipXL
              label={NAVIGATOR_COPY.severityYes}
              onPress={() => dispatch({ type: 'ANSWER_SAFETY', answer: 'yes' })}
            />
          </ScrollView>
        ) : null}
      </Animated.View>
    </ToolScreen>
  );
}

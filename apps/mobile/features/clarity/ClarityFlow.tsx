import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ToolScreen } from '@/components/ui/ToolScreen';
import { ChipXL } from '@/features/navigator/components/ChipXL';

import { ClarityResultsDashboard } from './components/ClarityResultsDashboard';
import {
  type ClarityFlowState,
  clarityReducer,
  initialClarityState,
  isExitOnBack,
} from './flow';
import { CLARITY_QUESTION_COUNT, CLARITY_QUESTIONS } from './questions';
import { getRecommendations, scoreClarity } from './scoring';
import type { ClarityHistoryItem, ClarityResult } from './types';

// The Clarity Score flow (intro → 20 questions → optional crisis interstitial →
// 2s calculating interlude → results dashboard). Fully ON-DEVICE: the reducer holds the
// in-progress answers in component state, so leaving unmounts them and nothing raw is
// persisted (SR-4). Only the COMPLETED result (composite + tier + domains) is saved, via
// the injected `saveResult`. Crisis is reachable on every screen via the chrome's
// Help-now pill and the mid-flow interstitial (SR-2).
//
// Web-parity override: results render the raw 0–100 score, animated gauge, radar, and the
// 4-tab dashboard. Release-gated on Dr. Dobson + Apple review (see types.ts).

const INTRO_TITLE = 'Clarity Score';
const INTRO_BODY =
  'A short set of questions about how the last couple of weeks have felt. Your answers stay on this device.';
const INTRO_META = 'About 20 questions. There are no right answers.';
const BEGIN = 'Begin';
const SEE_HISTORY = 'See your past snapshots';

const CRISIS_TITLE = 'Support is available';
const CRISIS_BODY =
  'Your responses suggest you may be going through a lot right now. Reaching out can help — and you do not need to do it alone.';
const CRISIS_PRIMARY = 'See support resources';
const CRISIS_CONTINUE = 'I’m safe right now — continue';

const CALCULATING_TITLE = 'Analyzing your responses…';
const CALCULATING_BODY = 'Computing your Clarity Score across five dimensions';

export interface ClarityFlowProps {
  readonly onExit: () => void;
  /** Crisis interstitial primary action → the crisis surface. (The chrome Help-now
   *  pill is provided by ToolScreen / CrisisPill, so no onHelp prop is needed.) */
  readonly onCrisisResources: () => void;
  /** A recommendation's action → a mobile route. */
  readonly onRecommend: (route: string) => void;
  readonly onViewHistory: () => void;
  /** Persist the completed result; called once per completion. */
  readonly saveResult: (result: ClarityResult) => number | null;
  /**
   * Replace the just-saved snapshot when the SAME sitting re-completes after a
   * BACK from results (keeps one row per run while matching the display).
   * Optional so existing callers/tests keep the first-snapshot behavior.
   */
  readonly replaceLatestResult?: (result: ClarityResult) => void;
  /** Read recent snapshots for the History tab (called after saveResult). */
  readonly getHistory?: () => ClarityHistoryItem[];
  /** Whether to offer the "see past snapshots" link on the intro. */
  readonly hasHistory?: boolean;
}

export function ClarityFlow({
  onExit,
  onCrisisResources,
  onRecommend,
  onViewHistory,
  saveResult,
  replaceLatestResult,
  getHistory,
  hasHistory = false,
}: ClarityFlowProps) {
  const [state, dispatch] = useReducer(clarityReducer, initialClarityState);

  const handleBack = () => {
    if (isExitOnBack(state)) onExit();
    else dispatch({ type: 'BACK' });
  };

  // Score once answers are complete (the calculating interlude + results both need it).
  const result = useMemo<ClarityResult | null>(
    () =>
      state.step === 'calculating' || state.step === 'results' ? scoreClarity(state.answers) : null,
    [state.step, state.answers],
  );

  const recommendations = useMemo(
    () => (result ? getRecommendations(result.domainScores) : []),
    [result],
  );

  // Persist exactly once per run (on entering the calculating interlude), then
  // snapshot history (which now includes this result) for the History tab. The guard
  // deliberately does NOT re-arm on BACK from calculating/results — walking back to
  // q20 and re-answering it in the same sitting must not persist a SECOND snapshot.
  // It re-arms only when an explicitly new run starts (Retake → RESET, below).
  // A re-answered run in the same sitting REPLACES the just-saved snapshot instead
  // (one row per run, and the persisted record always matches the dashboard the
  // user is looking at — second-pass review of PR-024).
  const savedForResults = useRef(false);
  const [history, setHistory] = useState<ClarityHistoryItem[]>([]);
  useEffect(() => {
    if (state.step !== 'calculating' && state.step !== 'results') return;
    if (!result) return;
    if (!savedForResults.current) {
      savedForResults.current = true;
      saveResult(result);
    } else if (replaceLatestResult) {
      replaceLatestResult(result);
    } else {
      return; // no replace seam injected — keep the first snapshot (old behavior)
    }
    setHistory(getHistory ? getHistory() : []);
  }, [state.step, result, saveResult, replaceLatestResult, getHistory]);

  // The 2s calculating delay (web parity). The timer is the only side effect; the reducer
  // just models 'calculating' → 'results'.
  useEffect(() => {
    if (state.step !== 'calculating') return;
    const t = setTimeout(() => dispatch({ type: 'FINISH_CALCULATING' }), 2000);
    return () => clearTimeout(t);
  }, [state.step]);

  // ── Results ────────────────────────────────────────────────────────────────────
  if (state.step === 'results' && result) {
    return (
      <ToolScreen scroll="none" onBack={handleBack}>
        <ClarityResultsDashboard
          results={result}
          recommendations={recommendations}
          history={history}
          onRecommend={onRecommend}
          onRetake={() => {
            // Explicit new run: re-arm the once-per-run persist guard, then reset.
            savedForResults.current = false;
            dispatch({ type: 'RESET' });
          }}
        />
      </ToolScreen>
    );
  }

  // ── Calculating interlude (web parity) ───────────────────────────────────────────
  if (state.step === 'calculating') {
    return (
      <ToolScreen scroll="none" onBack={handleBack}>
        <View className="flex-1 items-center justify-center px-8" accessibilityRole="progressbar">
          <ActivityIndicator size="large" color="#1A9B8C" />
          <Text variant="h1" className="mt-8 text-center">
            {CALCULATING_TITLE}
          </Text>
          <Text variant="body" className="mt-2 text-center text-text-secondary dark:text-text-secondary-dark">
            {CALCULATING_BODY}
          </Text>
        </View>
      </ToolScreen>
    );
  }

  // ── Crisis interstitial (SR-2) ───────────────────────────────────────────────────
  if (state.step === 'crisis') {
    return (
      <ToolScreen scroll="none" onBack={handleBack}>
        <ScrollView contentContainerClassName="gap-5 px-4 pb-12 pt-4" showsVerticalScrollIndicator={false}>
          <Text variant="h1" accessibilityRole="header">
            {CRISIS_TITLE}
          </Text>
          <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
            {CRISIS_BODY}
          </Text>
          <Button variant="primary" onPress={onCrisisResources}>
            {CRISIS_PRIMARY}
          </Button>
          <Button variant="ghost" onPress={() => dispatch({ type: 'ACK_CRISIS' })}>
            {CRISIS_CONTINUE}
          </Button>
        </ScrollView>
      </ToolScreen>
    );
  }

  // ── Intro ────────────────────────────────────────────────────────────────────────
  if (state.step === 'intro') {
    return (
      <ToolScreen scroll="none" onBack={handleBack}>
        <ScrollView contentContainerClassName="gap-5 px-4 pb-12 pt-4" showsVerticalScrollIndicator={false}>
          <Text variant="h1" accessibilityRole="header">
            {INTRO_TITLE}
          </Text>
          <Text variant="body" className="text-text-secondary dark:text-text-secondary-dark">
            {INTRO_BODY}
          </Text>
          <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
            {INTRO_META}
          </Text>
          <Button variant="primary" onPress={() => dispatch({ type: 'START' })}>
            {BEGIN}
          </Button>
          {hasHistory ? (
            <Button variant="ghost" onPress={onViewHistory}>
              {SEE_HISTORY}
            </Button>
          ) : null}
        </ScrollView>
      </ToolScreen>
    );
  }

  // ── Question (one per screen) ─────────────────────────────────────────────────────
  return (
    <ToolScreen scroll="none" onBack={handleBack}>
      <QuestionStep state={state} onAnswer={(value) => dispatch({ type: 'ANSWER', value })} />
    </ToolScreen>
  );
}

function QuestionStep({
  state,
  onAnswer,
}: {
  state: ClarityFlowState;
  onAnswer: (value: number) => void;
}) {
  const question = CLARITY_QUESTIONS[state.index];
  if (!question) return null;
  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2" showsVerticalScrollIndicator={false}>
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        Question {state.index + 1} of {CLARITY_QUESTION_COUNT}
      </Text>
      <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
        {question.lead}
      </Text>
      <Text variant="h1" accessibilityRole="header">
        {question.prompt}
      </Text>
      <View className="gap-3 pt-1">
        {question.options.map((o) => (
          <ChipXL key={o.value} label={o.label} onPress={() => onAnswer(o.value)} />
        ))}
      </View>
    </ScrollView>
  );
}

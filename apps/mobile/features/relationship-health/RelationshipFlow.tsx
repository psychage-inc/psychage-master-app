import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { ToolScreen } from '@/components/ui/ToolScreen';

import { CT4_RELATIONSHIP } from './copy';
import { LandingView } from './components/LandingView';
import { HistoryView } from './components/HistoryView';
import { ResultsView } from './components/ResultsView';
import { WizardView } from './components/WizardView';
import { getActiveQuestions } from './questions';
import type { RelationshipResultStore } from './result-store';
import { computeResult, type ComputedRelationshipResult } from './scoring';
import type { RelationshipHealthResult } from './types';

// Orchestrates the four states of the Relationship Health flow. The pure scoring
// module + the injected store are the only data dependencies — this component is
// just state + routing between Landing → Wizard → Results → History. The store is
// a prop so Jest render tests can inject an in-memory double (no MMKV).

type View = 'landing' | 'wizard' | 'results' | 'history';
type ResultsSource = 'fresh' | 'history';

export interface RelationshipFlowProps {
  readonly store: RelationshipResultStore;
  /** Leave the whole flow (router.back). */
  readonly onExit: () => void;
  /** Open the crisis surface (router.push('/crisis')) — Help-now + safety links. */
  readonly onCrisis: () => void;
  /** Initial view — defaults to 'landing'. A dedicated history route passes 'history'. */
  readonly initialView?: View;
}

export function RelationshipFlow({ store, onExit, onCrisis, initialView = 'landing' }: RelationshipFlowProps) {
  const [view, setView] = useState<View>(initialView);
  const [skipPartner, setSkipPartner] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ComputedRelationshipResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [resultsSource, setResultsSource] = useState<ResultsSource>('fresh');
  const [history, setHistory] = useState<RelationshipHealthResult[]>(() => store.loadHistory());

  const questions = useMemo(() => getActiveQuestions(skipPartner), [skipPartner]);
  const currentQuestion = questions[index];

  const handleStart = useCallback((skip: boolean) => {
    setSkipPartner(skip);
    setAnswers({});
    setIndex(0);
    setResult(null);
    setSaved(false);
    setView('wizard');
  }, []);

  const finish = useCallback(
    (finalAnswers: Record<string, number>) => {
      // PR-020: a run where EVERY question was skipped carries no signal — scoring
      // it would fabricate a composite/tier/patterns from zero answers (and a
      // savable, exportable result). Land back on the intro with a calm note.
      if (Object.keys(finalAnswers).length === 0) {
        Alert.alert(
          'Nothing to reflect on yet',
          'Every question was skipped, so there are no responses to summarize. You can try again whenever it feels right.',
        );
        setView('landing');
        return;
      }
      setResult(computeResult(finalAnswers, skipPartner));
      setSaved(false);
      setResultsSource('fresh');
      setView('results');
    },
    [skipPartner],
  );

  // Commit the chosen answer, then advance — or finish on the last question.
  // The next-answers map is threaded explicitly into finish() so the final
  // selection is never lost to setAnswers' async flush (stale-closure guard).
  const handleAnswer = useCallback(
    (value: number) => {
      if (!currentQuestion) return;
      const nextAnswers = { ...answers, [currentQuestion.id]: value };
      setAnswers(nextAnswers);
      if (index >= questions.length - 1) {
        finish(nextAnswers);
      } else {
        setIndex((i) => i + 1);
      }
    },
    [currentQuestion, answers, index, questions.length, finish],
  );

  // Move on without recording an answer for the current question.
  const handleSkip = useCallback(() => {
    if (index >= questions.length - 1) {
      finish(answers);
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, questions.length, answers, finish]);

  const handleSave = useCallback(() => {
    if (!result || saved) return;
    store.saveResult(result);
    setHistory(store.loadHistory());
    setSaved(true);
  }, [result, saved, store]);

  const handleRetake = useCallback(() => {
    setResult(null);
    setAnswers({});
    setIndex(0);
    setView('landing');
  }, []);

  const handleViewHistory = useCallback(() => {
    setHistory(store.loadHistory());
    setView('history');
  }, [store]);

  const handleSelectHistory = useCallback((picked: RelationshipHealthResult) => {
    setResult(picked);
    setSaved(true); // already persisted
    setResultsSource('history');
    setView('results');
  }, []);

  const handleDeleteHistory = useCallback(
    (id: string) => {
      setHistory(store.deleteResult(id));
    },
    [store],
  );

  // The chrome's top-Back is contextual.
  const handleBack = useCallback(() => {
    switch (view) {
      case 'landing':
        onExit();
        return;
      case 'wizard':
        if (index > 0) setIndex((i) => i - 1);
        else setView('landing');
        return;
      case 'results':
        setView(resultsSource === 'history' ? 'history' : 'landing');
        return;
      case 'history':
        setView('landing');
        return;
    }
  }, [view, index, resultsSource, onExit]);

  const backLabel = view === 'landing' ? CT4_RELATIONSHIP.title : CT4_RELATIONSHIP.back;

  return (
    <ToolScreen scroll="none" onBack={handleBack} backLabel={backLabel}>
      {view === 'landing' ? (
        <LandingView onStart={handleStart} onViewHistory={handleViewHistory} historyCount={history.length} />
      ) : null}

      {view === 'wizard' && currentQuestion ? (
        <WizardView
          key={currentQuestion.id}
          question={currentQuestion}
          index={index}
          total={questions.length}
          value={answers[currentQuestion.id]}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
        />
      ) : null}

      {view === 'results' && result ? (
        <ResultsView
          result={result}
          saved={saved}
          onSave={handleSave}
          onRetake={handleRetake}
          onViewHistory={handleViewHistory}
          onCrisis={onCrisis}
        />
      ) : null}

      {view === 'history' ? (
        <HistoryView
          history={history}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          onStartNew={handleRetake}
        />
      ) : null}
    </ToolScreen>
  );
}

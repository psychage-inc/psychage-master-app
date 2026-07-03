import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { PdfPreview } from '@/components/therapist/PdfPreview';
import type { TerrainDay } from '@/components/terrain/terrain-geometry';
import {
  buildTherapistPdfHtml,
  enumerateDays,
  generateAndShare,
  summarizeRange,
  THERAPIST_COPY,
  windowForDays,
} from '@/features/therapist';
import type { TherapistToolSummaries } from '@/features/therapist/pdf/build-html';
import { expoPdfPrinter } from '@/features/therapist/pdf/expo-printer';
import { PDF_SHARE_FAILED_COPY } from '@/features/therapist/pdf/printer';
import type { LocalCalendarDate } from '@psychage/shared/engagement';
import { dailyRollupReader } from '@/lib/daily-rollup';
import { getMomentStore } from '@/lib/moment-store';
import { moodReaderFromMoments } from '@/lib/mood-reader';
import { getClarityStore } from '@/lib/clarity-store';
import { getNavigatorStore } from '@/lib/navigator-store';
import { getRelationshipStore } from '@/lib/relationship-store';
import { getSleepStore } from '@/lib/sleep-store';

// Assemble the OPT-IN cross-tool summaries from the local stores (SR-4: on-device
// only). Sparse assessments (Clarity/Navigator/Relationship) use the most recent
// result; frequent logs (Mood/Sleep) are scoped to the shared range. No raw Navigator
// confidence (SR-1 — relevance label only); no DV/isolation specifics.
function buildToolSummaries(from: LocalCalendarDate, to: LocalCalendarDate): TherapistToolSummaries {
  const tools: {
    clarity?: TherapistToolSummaries['clarity'];
    navigator?: TherapistToolSummaries['navigator'];
    relationship?: TherapistToolSummaries['relationship'];
    mood?: TherapistToolSummaries['mood'];
    sleep?: TherapistToolSummaries['sleep'];
  } = {};

  const clarity = getClarityStore().getRecent(1)[0];
  if (clarity) {
    const d = clarity.domains;
    tools.clarity = {
      date: clarity.date,
      composite: clarity.composite,
      tier: clarity.tier,
      domains: [
        { label: 'Emotional', value: d.emotional, max: 20 },
        { label: 'Vitality', value: d.vitality, max: 20 },
        { label: 'Social', value: d.social, max: 20 },
        { label: 'Cognitive', value: d.cognitive, max: 20 },
        { label: 'Functioning', value: d.functioning, max: 20 },
      ],
    };
  }

  const nav = getNavigatorStore().getRecent(1)[0];
  if (nav) {
    tools.navigator = {
      date: nav.date,
      areas: nav.results.results
        .slice(0, 5)
        .map((r) => ({ name: r.name, relevance: r.relevance_label })),
    };
  }

  const rel = getRelationshipStore().loadHistory()[0];
  if (rel) {
    const d = rel.domainScores;
    tools.relationship = {
      date: rel.createdAt.slice(0, 10),
      composite: rel.compositeScore,
      tier: rel.tierLabel,
      // skipPartner runs never assessed the partner domain — its stored score is
      // a neutral fallback, not data. Handing a clinician "Partner 50/100" for a
      // user who declared no partner fabricates an assessment (PR-021).
      domains: [
        ...(rel.skipPartner ? [] : [{ label: 'Partner', value: d.partner, max: 100 }]),
        { label: 'Family', value: d.family, max: 100 },
        { label: 'Friends', value: d.friends, max: 100 },
        { label: 'Community', value: d.community, max: 100 },
      ],
    };
  }

  const moments = moodReaderFromMoments(getMomentStore()).getRange(from, to);
  if (moments.length > 0) {
    const counts = new Map<string, number>();
    for (const m of moments) for (const e of m.emotions) counts.set(e, (counts.get(e) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    tools.mood = { momentCount: moments.length, topEmotions: top };
  }

  const sleep = getSleepStore().getRange(from, to);
  if (sleep.length > 0) {
    const avg = sleep.reduce((s, e) => s + e.sleep_quality, 0) / sleep.length;
    tools.sleep = { nights: sleep.length, avgQuality: Math.round(avg * 10) / 10 };
  }

  return tools;
}

// S41 — PDF preview + share. Thin route: reads the selected range from the local
// RecordStore, builds the on-screen terrain preview, and on Share generates the PDF
// LOCALLY (expo-print) and hands it to the platform sheet. The record shared is the
// LOCAL store (the synced/account record is the gated sync layer — out of this wave).
export default function PreviewScreen() {
  const params = useLocalSearchParams<{ days?: string }>();
  // Closed set only (the S40 range screen offers 7/14/30). `days` is a deep-linkable
  // route param: an unbounded Number() here let `?days=999999999` drive a ~1e9-day
  // enumerateDays loop inside first-render useMemo — a frozen JS thread on cold
  // start (PR-056). Anything outside the set falls back to the 7-day default.
  const parsed = Number(typeof params.days === 'string' ? params.days : '7');
  const days = parsed === 14 || parsed === 30 ? parsed : 7;

  const data = useMemo(() => {
    const { from, to } = windowForDays(new Date(), days);
    const entries = dailyRollupReader(getMomentStore()).getRange(from, to);
    const byDate = new Map(entries.map((entry) => [entry.date, entry]));
    const terrainDays: TerrainDay[] = enumerateDays(from, to).map((d) => {
      const entry = byDate.get(d);
      return { label: d.slice(8, 10), value: entry ? entry.state : null };
    });
    const { dayCount, entryCount } = summarizeRange(from, to, entries);
    return { from, to, entries, terrainDays, dayCount, entryCount };
  }, [days]);

  const handleShare = (fullName: string, includeTools: boolean) => {
    const html = buildTherapistPdfHtml({
      fullName,
      from: data.from,
      to: data.to,
      entries: data.entries,
      // Opt-in only — default share stays check-ins-only to match the consent copy.
      tools: includeTools ? buildToolSummaries(data.from, data.to) : undefined,
    });
    void generateAndShare(html, expoPdfPrinter).then((result) => {
      // Same calm feedback as every other export surface (PR-025) — a failed
      // print/share must not be a silent no-op.
      if (!result.ok) Alert.alert(PDF_SHARE_FAILED_COPY.title, PDF_SHARE_FAILED_COPY.message);
    });
  };

  return (
    <PdfPreview
      initialName=""
      summaryLine={THERAPIST_COPY.rangeCountLine(data.dayCount, data.entryCount)}
      terrainDays={data.terrainDays}
      isEmpty={data.entryCount === 0}
      onShare={handleShare}
    />
  );
}

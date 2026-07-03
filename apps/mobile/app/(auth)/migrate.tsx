import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { MigrationProgress } from '@/components/auth/MigrationProgress';
import { Button } from '@/components/ui/Button';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { lastSevenDayWindow, runMigration, type MigrationStatus } from '@/features/auth';
// Real remote imported DIRECTLY (not via the @/features/auth barrel) so its
// transitive check-in-store → Supabase/MMKV chain never loads in Jest-rendered
// paths that import the barrel (check-in-store.ts header).
import { productionMigrationRemote } from '@/features/auth/migration/remote';
import { getMomentStore } from '@/lib/moment-store';
import { goBackOr } from '@/lib/nav';

// S36 — Migration progress (THE LAUNCH-BLOCKER SURFACE). Reads the local record
// (last 7 days, the TTL window — rules/auth.md §4) and runs the merge LOCALLY, then
// pushes the merged set to the user's new account as a best-effort PUSH-ONLY backup
// (#72 write path, ADR-001 Accepted). The push is the user's explicit "bring my data"
// action, so a failure surfaces as an honest `offline` outcome (retryable) — never a
// false `done`, and the local record is never touched. Losing a single local entry
// during upgrade is a launch blocker; the merge that protects against it is
// unit-tested (Vitest).
//
// PR-058: the route is reachable by bare deep link, so the network push requires an
// explicit tap to start (auto-run only behind ?auto=1 for flows that already asked),
// and the terminal states carry an exit that survives a cold start (goBackOr).

// CT4 — placeholder copy, not final (features/auth/copy.ts convention; Dobson review).
const MIGRATE_INTRO =
  'Bring the check-ins on this phone (the last 7 days) into your account. Nothing moves until you start.'; // CT4
const MIGRATE_START_LABEL = 'Start'; // CT4
const MIGRATE_EXIT_LABEL = 'Done'; // CT4

type ScreenStatus = MigrationStatus | 'idle';

export default function MigrateScreen() {
  const params = useLocalSearchParams<{ auto?: string }>();
  const [status, setStatus] = useState<ScreenStatus>(params.auto === '1' ? 'merging' : 'idle');
  const [mergedCount, setMergedCount] = useState(0);
  const [conflictsResolved, setConflictsResolved] = useState(0);

  useEffect(() => {
    if (status !== 'merging') return;
    let active = true;
    void runMigration({
      readLocalEntries: () => {
        const { from, to } = lastSevenDayWindow(new Date());
        return getMomentStore().getRange(from, to);
      },
      remote: productionMigrationRemote,
    }).then((outcome) => {
      if (!active) return;
      setStatus(outcome.status);
      setMergedCount(outcome.mergedCount);
      setConflictsResolved(outcome.conflictsResolved);
    });
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <ScreenShell>
      <View className="flex-1 justify-center gap-6">
        {status === 'idle' ? (
          <View className="gap-6">
            <Text variant="body">{MIGRATE_INTRO}</Text>
            <Button variant="primary" onPress={() => setStatus('merging')} testID="migrate-start">
              {MIGRATE_START_LABEL}
            </Button>
          </View>
        ) : (
          <MigrationProgress
            status={status}
            mergedCount={mergedCount}
            conflictsResolved={conflictsResolved}
          />
        )}
        {status === 'done' || status === 'offline' ? (
          <Button variant="secondary" onPress={() => goBackOr('/')} testID="migrate-exit">
            {MIGRATE_EXIT_LABEL}
          </Button>
        ) : null}
      </View>
    </ScreenShell>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type {
  ChronotypeResult,
  LocalCalendarDate,
  SleepEntry,
  SleepEntryInput,
  SleepRecordStore,
} from '@psychage/shared/sleep';

import { Text } from '@/components/ui/Text';
import { ToolScreen } from '@/components/ui/ToolScreen';
import { CT4_SLEEP } from '@/features/sleep-architect/copy';
import { SleepDiary } from '@/features/sleep-architect/diary/SleepDiary';
import { SleepLogForm } from '@/features/sleep-architect/diary/SleepLogForm';
import type { SleepPdfInput } from '@/features/sleep-architect/export/build-sleep-html';
import { SleepExportView } from '@/features/sleep-architect/export/SleepExportView';
import { SleepHome } from '@/features/sleep-architect/home/SleepHome';
import { SleepTools } from '@/features/sleep-architect/tools/SleepTools';
import { WindDown } from '@/features/sleep-architect/winddown/WindDown';
import { getSleepStore } from '@/lib/sleep-store';

// Sleep Architect shell. Pushed OUTSIDE the tabs, so it carries its OWN crisis
// affordance in the header (SR-2) — it does not inherit the GlobalHeader. Reads and
// writes go through the injected SleepRecordStore (LOCAL-ONLY, SR-4). The store is a
// prop (default: the app singleton) so render tests inject an in-memory double.
//
// P58 redesign: a 4-tab IA (Home · Diary · Tools · Wind-down). Home merges the former
// Overview, Patterns and Insights tabs into one scroll. P59: Home opens an Export flow;
// the native PDF egress is INJECTED via onExport (the route owns expo-print), so this
// component — and its render tests — never pull a native module.

type Tab = 'home' | 'diary' | 'tools' | 'wind-down';
type Editing =
  | { mode: 'new' }
  | { mode: 'edit'; entry: SleepEntry }
  | { mode: 'export' }
  | null;

type SleepArchitectViewProps = {
  store?: SleepRecordStore;
  onClose?: () => void;
  /** Build + share the sleep PDF. The route supplies the expo-print egress (SR-4). */
  onExport?: (input: SleepPdfInput) => void;
};

export function SleepArchitectView({
  store = getSleepStore(),
  onClose,
  onExport,
}: SleepArchitectViewProps) {
  const [tab, setTab] = useState<Tab>('home');
  const [editing, setEditing] = useState<Editing>(null);
  const [entries, setEntries] = useState<SleepEntry[]>(() => store.getRecent(120));
  const [settings, setSettings] = useState(() => store.getSettings());

  const reload = useCallback(() => {
    setEntries(store.getRecent(120));
    setSettings(store.getSettings());
  }, [store]);

  // "Log last night" must not blank-overwrite a night already logged today:
  // saveToday replaces today's entry wholesale, so a mode:'new' form would
  // silently destroy its notes / dream notes / ratings. When today's entry
  // exists, open the form prefilled in EDIT mode (the editEntry path) instead.
  const openLog = useCallback(() => {
    const today = store.getToday();
    setEditing(today ? { mode: 'edit', entry: today } : { mode: 'new' });
  }, [store]);

  // The export flow reads EVERY logged night. The tab surfaces cap at
  // getRecent(120) to bound render cost, but "All nights" derives its window
  // from this list — feeding it the capped set would silently drop older
  // entries. Newest-first, matching the `entries` contract the tabs use.
  const exportEntries = useMemo(
    () => (editing?.mode === 'export' ? store.getAll().reverse() : []),
    [editing, store],
  );

  const handleSubmit = useCallback(
    (input: SleepEntryInput) => {
      try {
        if (editing?.mode === 'edit') store.editEntry(editing.entry.id, input);
        else store.saveToday(input);
        reload();
        setEditing(null);
        setTab('home');
      } catch {
        // Times are pre-validated in the form; any residual store-level rejection
        // keeps the form open so the user can correct it. No data leaves the device.
      }
    },
    [editing, store, reload],
  );

  const handleSaveTargets = useCallback(
    (result: ChronotypeResult) => {
      store.saveSettings({
        chronotype: result.animal,
        target_bedtime: result.ideal_bedtime,
        target_wake_time: result.ideal_wake_time,
      });
      reload();
    },
    [store, reload],
  );

  const handleGenerate = useCallback(
    (fullName: string, from: LocalCalendarDate, to: LocalCalendarDate) => {
      // All logged nights (LOCAL store); the pure builder filters to [from, to].
      // generatedAt is stamped here so the builder stays deterministic/testable.
      onExport?.({ fullName, from, to, entries: store.getAll(), generatedAt: new Date() });
      setEditing(null);
    },
    [onExport, store],
  );

  return (
    <ToolScreen scroll="none" title={CT4_SLEEP.title} onBack={onClose}>
      {editing?.mode === 'export' ? (
        <SleepExportView
          entries={exportEntries}
          onGenerate={handleGenerate}
          onCancel={() => setEditing(null)}
        />
      ) : editing !== null ? (
        <SleepLogForm
          initial={editing.mode === 'edit' ? editing.entry : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <TabBar tab={tab} onChange={setTab} />
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 pb-12 pt-3"
            showsVerticalScrollIndicator={false}
          >
            {tab === 'home' ? (
              <SleepHome
                entries={entries}
                settings={settings}
                onLog={openLog}
                onExport={() => setEditing({ mode: 'export' })}
              />
            ) : null}
            {tab === 'diary' ? (
              <SleepDiary
                entries={entries}
                onLog={openLog}
                onSelect={(entry) => setEditing({ mode: 'edit', entry })}
              />
            ) : null}
            {tab === 'tools' ? (
              <SleepTools
                entries={entries}
                settings={settings}
                onSaveTargets={handleSaveTargets}
              />
            ) : null}
            {tab === 'wind-down' ? <WindDown /> : null}
          </ScrollView>
        </>
      )}
    </ToolScreen>
  );
}

// 4-item tab bar. Four labels fit a phone width without the old horizontal-scroll
// overflow, so each tab gets an equal flex slice (punchier, no peek-scrolling).
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; label: string }[] = [
    { key: 'home', label: CT4_SLEEP.tabs.home },
    { key: 'diary', label: CT4_SLEEP.tabs.diary },
    { key: 'tools', label: CT4_SLEEP.tabs.tools },
    { key: 'wind-down', label: CT4_SLEEP.tabs.windDown },
  ];
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-b border-border dark:border-border-dark"
    >
      {items.map((item) => {
        const active = item.key === tab;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            className={`min-h-[44px] flex-1 items-center justify-center border-b-[3px] px-2 active:bg-surface-active/50 dark:active:bg-surface-active-dark/50 ${
              active ? 'border-primary dark:border-primary-dark' : 'border-transparent'
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text
              variant={active ? 'label' : 'body'}
              className={active ? 'text-primary dark:text-primary-dark' : 'text-text-secondary dark:text-text-secondary-dark'}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

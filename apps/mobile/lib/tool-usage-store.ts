import { storage } from '@/lib/adapters/storage';

export type ToolId = 'toolkit' | 'navigator' | 'mindmate' | 'clarity' | 'breathing';

export interface Tool {
  id: ToolId;
  name: string;
  title: string;
  route: string;
  reEngage?: boolean;        // eligible to be surfaced when dormant
  thresholdDays?: number;    // how long counts as "a long time"
}

// Routes point at the REAL native flows (matching features/compass/routes.ts).
// They previously pointed at the legacy `/tool/[id]` placeholder, so the home
// dormant-tool CTA and the Insights "Your Tools" rail landed users on a
// "This is a placeholder" screen in production (PR-008). `/tool/[id]` remains
// only as a deep-link redirect onto these destinations.
export const TOOLS: Record<ToolId, Tool> = {
  toolkit:   { id: 'toolkit',   name: 'Toolkit',           title: 'Steady yourself right now', route: '/toolkit' },
  navigator: { id: 'navigator', name: 'Symptom Navigator', title: 'Make sense of what you feel', route: '/navigator', reEngage: true, thresholdDays: 21 },
  mindmate:  { id: 'mindmate',  name: 'MindMate',          title: 'Talk it through', route: '/tools/mindmate' },
  clarity:   { id: 'clarity',   name: 'Clarity Score',     title: 'Understand how you’re doing', route: '/tools/clarity', reEngage: true, thresholdDays: 14 },
  breathing: { id: 'breathing', name: 'Breathing',         title: 'One minute to settle', route: '/toolkit?exercise=breathing' },
};

const STORAGE_KEY = 'psychage:tool_usage';

export interface ToolUsageData {
  installedAt: number;
  usage: Partial<Record<ToolId, number>>;
}

function getStoredData(): ToolUsageData {
  const raw = storage.get(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  const newData: ToolUsageData = { installedAt: Date.now(), usage: {} };
  storage.set(STORAGE_KEY, JSON.stringify(newData));
  return newData;
}

export const toolUsageStore = {
  recordUse(id: ToolId): void {
    const data = getStoredData();
    data.usage[id] = Date.now();
    storage.set(STORAGE_KEY, JSON.stringify(data));
  },
  
  getUsage(): ToolUsageData {
    return getStoredData();
  }
};

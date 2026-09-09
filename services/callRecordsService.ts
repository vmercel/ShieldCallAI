/**
 * callRecordsService — Real Supabase CRUD for call_records table
 */
import { supabase } from './supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_CALLS_KEY = 'shieldcall_local_calls_v1';

function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function loadLocalCalls(): Promise<CallRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_CALLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalCalls(rows: CallRecord[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_CALLS_KEY, JSON.stringify(rows.slice(0, 200)));
}

async function saveLocalCall(record: InsertCallRecord): Promise<CallRecord> {
  const row: CallRecord = {
    ...record,
    id: newId(),
    user_id: 'local',
    created_at: new Date().toISOString(),
  };
  const all = await loadLocalCalls();
  all.unshift(row);
  await writeLocalCalls(all);
  return row;
}

async function migrateLocalToCloud(userId: string): Promise<void> {
  const local = await loadLocalCalls();
  if (local.length === 0) return;
  for (const row of local) {
    const { id: _id, user_id: _uid, created_at: _c, ...rest } = row;
    await supabase.from('call_records').insert({ ...rest, user_id: userId });
  }
  await AsyncStorage.removeItem(LOCAL_CALLS_KEY);
}

export interface CallRecord {
  id: string;
  user_id: string;
  caller_name: string;
  caller_number: string;
  caller_org?: string;
  direction: 'inbound' | 'outbound';
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  threat_level: 'safe' | 'warning' | 'danger';
  threat_score: number;
  scam_type?: string;
  summary?: string;
  ai_notes?: string;
  tags: string[];
  ghost_handled: boolean;
  transcript: { speaker: string; text: string }[];
  flags: string[];
  fact_checks: string[];
  is_blocked: boolean;
  reported_to_ftc: boolean;
  threat_timeline?: { time: number; score: number }[]; // Per-window scores for timeline chart
  action_items?: string[];                              // AI-generated recommended actions
  created_at: string;
}

export type InsertCallRecord = Omit<CallRecord, 'id' | 'user_id' | 'created_at'>;

export const callRecordsService = {
  async fetchAll(): Promise<{ data: CallRecord[] | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: await loadLocalCalls(), error: null };
    }
    try {
      await migrateLocalToCloud(user.id);
    } catch {}
    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord[], error: null };
  },

  async fetchById(id: string): Promise<{ data: CallRecord | null; error: string | null }> {
    const local = (await loadLocalCalls()).find(c => c.id === id);
    if (local) return { data: local, error: null };
    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord, error: null };
  },

  async insert(record: InsertCallRecord): Promise<{ data: CallRecord | null; error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const saved = await saveLocalCall(record);
      return { data: saved, error: null };
    }
    const { data, error } = await supabase
      .from('call_records')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord, error: null };
  },

  async update(id: string, updates: Partial<CallRecord>): Promise<{ error: string | null }> {
    const local = await loadLocalCalls();
    const idx = local.findIndex(c => c.id === id);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...updates };
      await writeLocalCalls(local);
      return { error: null };
    }
    const { error } = await supabase
      .from('call_records')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  async markBlocked(id: string, blocked: boolean): Promise<{ error: string | null }> {
    return callRecordsService.update(id, { is_blocked: blocked });
  },

  async markReportedToFTC(id: string): Promise<{ error: string | null }> {
    return callRecordsService.update(id, { reported_to_ftc: true });
  },

  async getStats(): Promise<{
    data: {
      totalCalls: number;
      scamsBlocked: number;
      ghostModeCalls: number;
      estimatedSavings: number;
      topScamTypes: { type: string; count: number }[];
      safeCallsPercent: number;
    } | null;
    error: string | null;
  }> {
    const { data, error } = await callRecordsService.fetchAll();
    if (error || !data) return { data: null, error };

    const total = data.length;
    const danger = data.filter(c => c.threat_level === 'danger').length;
    const warning = data.filter(c => c.threat_level === 'warning').length;
    const scamsBlocked = danger + warning;
    const ghostModeCalls = data.filter(c => c.ghost_handled).length;
    const safe = data.filter(c => c.threat_level === 'safe').length;

    // Compute top scam types
    const scamCounts: Record<string, number> = {};
    data.forEach(c => {
      if (c.scam_type) {
        scamCounts[c.scam_type] = (scamCounts[c.scam_type] || 0) + 1;
      }
    });
    const topScamTypes = Object.entries(scamCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      data: {
        totalCalls: total,
        scamsBlocked,
        ghostModeCalls,
        estimatedSavings: danger * 700 + warning * 200,
        topScamTypes,
        safeCallsPercent: total > 0 ? Math.round((safe / total) * 100) : 100,
      },
      error: null,
    };
  },

  // Generate AI call summary via Edge Function
  async generateSummary(params: {
    transcript: { speaker: string; text: string }[];
    threatScore: number;
    threatLevel: string;
    flags: string[];
    duration: number;
    callerName: string;
    callerNumber: string;
  }): Promise<{
    data: {
      summary: string;
      aiNotes: string | null;
      scamType: string | null;
      actionItems: string[];
    } | null;
    error: string | null;
  }> {
    const { data, error } = await supabase.functions.invoke('call-summary', { body: params });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const text = await error.context?.text();
          errorMessage = text || error.message;
        } catch {}
      }
      return { data: null, error: errorMessage };
    }

    return { data, error: null };
  },
};

/**
 * callRecordsService — Real Supabase CRUD for call_records table
 */
import { supabase } from './supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';

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
    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord[], error: null };
  },

  async fetchById(id: string): Promise<{ data: CallRecord | null; error: string | null }> {
    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord, error: null };
  },

  async insert(record: InsertCallRecord): Promise<{ data: CallRecord | null; error: string | null }> {
    const { data, error } = await supabase
      .from('call_records')
      .insert(record)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CallRecord, error: null };
  },

  async update(id: string, updates: Partial<CallRecord>): Promise<{ error: string | null }> {
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

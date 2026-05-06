/**
 * communityThreatsService — Real Supabase queries for community_threats table
 */
import { supabase } from './supabaseClient';

export interface CommunityThreat {
  id: string;
  phone_number: string;
  scam_type?: string;
  report_count: number;
  last_seen_at: string;
  region: string;
  created_at: string;
}

export const communityThreatsService = {
  async fetchTop(limit = 10): Promise<{ data: CommunityThreat[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('community_threats')
      .select('*')
      .order('report_count', { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: data as CommunityThreat[], error: null };
  },

  async checkNumber(phoneNumber: string): Promise<{ data: CommunityThreat | null; error: string | null }> {
    const { data, error } = await supabase
      .from('community_threats')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
    return { data: data as CommunityThreat | null, error: null };
  },

  async reportNumber(phoneNumber: string, scamType?: string): Promise<{ error: string | null }> {
    // Upsert: increment report_count if exists, insert if not
    const { data: existing } = await supabase
      .from('community_threats')
      .select('id, report_count')
      .eq('phone_number', phoneNumber)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('community_threats')
        .update({
          report_count: (existing.report_count || 1) + 1,
          last_seen_at: new Date().toISOString(),
          ...(scamType ? { scam_type: scamType } : {}),
        })
        .eq('id', existing.id);
      return { error: error?.message || null };
    } else {
      const { error } = await supabase
        .from('community_threats')
        .insert({
          phone_number: phoneNumber,
          scam_type: scamType || null,
          report_count: 1,
          last_seen_at: new Date().toISOString(),
        });
      return { error: error?.message || null };
    }
  },
};

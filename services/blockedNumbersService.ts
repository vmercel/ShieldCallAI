/**
 * blockedNumbersService — Real Supabase CRUD for blocked_numbers table
 */
import { supabase } from './supabaseClient';

export interface BlockedNumber {
  id: string;
  user_id: string;
  phone_number: string;
  blocked_reason?: string;
  blocked_at: string;
}

export const blockedNumbersService = {
  async fetchAll(): Promise<{ data: BlockedNumber[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('blocked_numbers')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as BlockedNumber[], error: null };
  },

  async isBlocked(phoneNumber: string): Promise<boolean> {
    const { data } = await supabase
      .from('blocked_numbers')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();
    return !!data;
  },

  async block(phoneNumber: string, reason?: string): Promise<{ error: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sign in to block numbers across devices' };
    const { error } = await supabase
      .from('blocked_numbers')
      .upsert(
        { user_id: user.id, phone_number: phoneNumber, blocked_reason: reason || null },
        { onConflict: 'user_id,phone_number' },
      );

    if (error) return { error: error.message };
    return { error: null };
  },

  async unblock(phoneNumber: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('blocked_numbers')
      .delete()
      .eq('phone_number', phoneNumber);

    if (error) return { error: error.message };
    return { error: null };
  },
};

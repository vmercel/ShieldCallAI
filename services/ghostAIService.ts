/**
 * ghostAIService — Calls the Ghost AI Edge Function
 * Replaces the finite-state machine with real OnSpace AI responses
 */
import { supabase } from './supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface GhostAIRequest {
  messages: { role: 'ai' | 'caller'; text: string }[];
  personaName: string;
  userName: string;
  threatScore: number;
  threatLevel: string;
  threatFlags: string[];
  isExposeMode: boolean;
  deepfakeConfidence: number;
}

export const ghostAIService = {
  async getResponse(params: GhostAIRequest): Promise<{ reply: string | null; error: string | null }> {
    const { data, error } = await supabase.functions.invoke('ghost-ai', { body: params });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const text = await error.context?.text();
          errorMessage = text || error.message;
        } catch {}
      }
      console.error('Ghost AI error:', errorMessage);
      return { reply: null, error: errorMessage };
    }

    return { reply: data?.reply || null, error: null };
  },
};

/**
 * aiDialerService — Calls the AI Dialer Edge Function
 * Conducts a full simulated call and returns transcript + outcome
 */
import { supabase } from './supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface DialerResult {
  outcome: 'success' | 'partial' | 'failed';
  summary: string;
  transcript: { speaker: string; text: string }[];
  duration: number;
  actionItems: string[];
  callDetails: {
    organization: string;
    department: string;
    confirmationNumber: string | null;
    nextSteps: string;
  };
}

export const aiDialerService = {
  async executeCall(instruction: string, userContext?: string): Promise<{ data: DialerResult | null; error: string | null }> {
    const { data, error } = await supabase.functions.invoke('ai-dialer', {
      body: { instruction, userContext: userContext || '' },
    });

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

    return { data: data as DialerResult, error: null };
  },
};

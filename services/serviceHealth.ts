/**
 * serviceHealth — Probes the ShieldCall backend services and reports which are live.
 *
 * Each edge function answers { ping: true } without spending AI/transcription
 * budget, and reports whether its own provider key is configured. This module
 * never sees or transmits any secret; the functions only return booleans.
 */

import { supabase } from './supabaseClient';

export type ServiceStatus = 'ok' | 'degraded' | 'down';

export interface ServiceProbe {
  /** Stable id, e.g. 'ghost-ai' */
  id: string;
  /** Human label shown in the UI */
  label: string;
  /** What this service does, one line */
  description: string;
  status: ServiceStatus;
  /** Short human detail, e.g. 'AI key configured' or 'no response' */
  detail: string;
  /** Round-trip time in ms, when the probe completed */
  latencyMs: number | null;
}

export interface HealthReport {
  probedAt: string;
  services: ServiceProbe[];
}

const PROBE_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface FunctionProbeDef {
  id: string;
  label: string;
  description: string;
  /** Maps the ping payload to a status/detail pair */
  interpret: (data: any) => { status: ServiceStatus; detail: string };
}

const FUNCTION_PROBES: FunctionProbeDef[] = [
  {
    id: 'ghost-ai',
    label: 'Ghost Mode AI',
    description: 'Conversational AI that answers screened calls (Anthropic Claude).',
    interpret: (data) =>
      data?.aiConfigured
        ? { status: 'ok', detail: `AI ready (${data.model || 'default model'})` }
        : { status: 'degraded', detail: 'AI key not configured on server' },
  },
  {
    id: 'transcribe-audio',
    label: 'Live transcription',
    description: 'Turns call audio into text (Deepgram).',
    interpret: (data) =>
      data?.deepgramConfigured
        ? { status: 'ok', detail: 'Transcription ready' }
        : { status: 'degraded', detail: 'Deepgram key not configured on server' },
  },
  {
    id: 'call-summary',
    label: 'Call summaries',
    description: 'Writes the post-call summary and threat notes.',
    interpret: (data) =>
      data?.aiConfigured
        ? { status: 'ok', detail: 'Summaries ready' }
        : { status: 'degraded', detail: 'AI key not configured on server' },
  },
  {
    id: 'ai-dialer',
    label: 'AI dialer',
    description: 'Places assisted calls on your behalf.',
    interpret: (data) =>
      data?.aiConfigured
        ? { status: 'ok', detail: 'Dialer ready' }
        : { status: 'degraded', detail: 'AI key not configured on server' },
  },
];

async function probeFunction(def: FunctionProbeDef): Promise<ServiceProbe> {
  const started = Date.now();
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(def.id, { body: { ping: true } }),
      PROBE_TIMEOUT_MS
    );
    if (error) throw error;
    if (!data || data.ok !== true) {
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        status: 'down',
        detail: 'Unexpected response from server',
        latencyMs: Date.now() - started,
      };
    }
    const { status, detail } = def.interpret(data);
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      status,
      detail,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      status: 'down',
      detail: err instanceof Error ? err.message : 'Probe failed',
      latencyMs: null,
    };
  }
}

async function probeSupabase(): Promise<ServiceProbe> {
  const started = Date.now();
  try {
    // Lightweight authenticated read: the profiles table is readable by the
    // signed-in user and returns at most one row. Proves auth + database.
    // PostgrestBuilder is thenable but not typed as a native Promise, so wrap it.
    const { error } = await withTimeout(
      Promise.resolve(supabase.from('profiles').select('id').limit(1).maybeSingle()),
      PROBE_TIMEOUT_MS
    );
    if (error) throw error;
    return {
      id: 'supabase',
      label: 'Account & database',
      description: 'Sign-in, profiles, and stored call data.',
      status: 'ok',
      detail: 'Connected',
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      id: 'supabase',
      label: 'Account & database',
      description: 'Sign-in, profiles, and stored call data.',
      status: 'down',
      detail: err instanceof Error ? err.message : 'Probe failed',
      latencyMs: null,
    };
  }
}

/**
 * Probe every backend service. Probes run in parallel; a single slow or dead
 * service never blocks the rest of the report.
 */
export async function checkServiceHealth(): Promise<HealthReport> {
  const services = await Promise.all([
    probeSupabase(),
    ...FUNCTION_PROBES.map(probeFunction),
  ]);
  return { probedAt: new Date().toISOString(), services };
}

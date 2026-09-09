/**
 * Client for the shieldcall-core sidecar. No scoring in JS.
 * If the sidecar is down, callers must fail-open (MONITOR).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type SidecarAction =
  | 'monitor'
  | 'warn'
  | 'challenge'
  | 'escalate'
  | 'abstain'
  | 'adapt';

export type SidecarEvent = {
  type: 'event';
  call_id?: string;
  action: SidecarAction;
  shed: boolean;
  t: number;
  synth: number;
  fraud: number;
  risk: number;
  regime: string;
  tier: string;
  stage?: string;
  n_turns?: number;
  last_text?: string;
  explanation?: string;
  source?: string;
};

export type SidecarHealth = {
  live: boolean;
  ready: boolean;
  active_calls: number;
  detail: string;
  channel_twin: boolean;
  actuation: string;
};

const DEFAULT_URL = 'http://127.0.0.1:8765';

/** Expo Go on a phone cannot reach the Mac via 127.0.0.1. Use the Metro host. */
export function sidecarBaseUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_SHIELDCALL_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS !== 'web') {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as { linkingUri?: string }).linkingUri ||
      '';
    const match = String(hostUri).match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (match) return `http://${match[1]}:8765`;
  }
  return DEFAULT_URL;
}

async function jsonFetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export async function sidecarHealth(base = sidecarBaseUrl()): Promise<SidecarHealth> {
  return jsonFetch(`${base}/health`);
}

export async function sidecarOpenCall(callId?: string, base = sidecarBaseUrl()): Promise<{ call_id: string; shed: boolean }> {
  return jsonFetch(`${base}/v1/calls`, { method: 'POST', body: JSON.stringify({ call_id: callId || null }) });
}

export async function sidecarCloseCall(callId: string, base = sidecarBaseUrl()): Promise<void> {
  await jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}`, { method: 'DELETE' });
}

export async function sidecarInject(
  callId: string,
  body: { script_id?: string; turns?: string[] },
  base = sidecarBaseUrl(),
): Promise<SidecarEvent> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/inject`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function sidecarTranscript(
  callId: string,
  text: string,
  t = 0,
  base = sidecarBaseUrl(),
): Promise<SidecarEvent> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/transcript`, {
    method: 'POST',
    body: JSON.stringify({ t, text }),
  });
}

export async function sidecarReady(base = sidecarBaseUrl()): Promise<{ ready: boolean; detail: string }> {
  return jsonFetch(`${base}/ready`);
}

export async function sidecarCapabilities(base = sidecarBaseUrl()): Promise<{
  actuation: string;
  hang_up: boolean;
  fail_open: boolean;
  endpoints: string[];
  streams: string[];
}> {
  return jsonFetch(`${base}/v1/capabilities`);
}

export async function sidecarListCalls(base = sidecarBaseUrl()): Promise<{ calls: Array<{ call_id: string; shed: boolean; last_action: string }> }> {
  return jsonFetch(`${base}/v1/calls`);
}

export async function sidecarGetCall(callId: string, base = sidecarBaseUrl()): Promise<Record<string, unknown>> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}`);
}

export async function sidecarDecision(callId: string, base = sidecarBaseUrl()): Promise<SidecarEvent> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/decision`);
}

export async function sidecarTrace(callId: string, base = sidecarBaseUrl()): Promise<{ call_id: string; trace: unknown[] }> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/trace`);
}

export async function sidecarAudio(
  callId: string,
  pcmS16leB64: string,
  sr = 8000,
  base = sidecarBaseUrl(),
): Promise<SidecarEvent> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/audio`, {
    method: 'POST',
    body: JSON.stringify({ sr, pcm_s16le_b64: pcmS16leB64 }),
  });
}

/** Live-call window: transcript plus optional PCM. Primary UI → core path. */
export async function sidecarChunk(
  callId: string,
  body: { text?: string; t?: number; pcmS16leB64?: string; sr?: number },
  base = sidecarBaseUrl(),
): Promise<SidecarEvent> {
  return jsonFetch(`${base}/v1/calls/${encodeURIComponent(callId)}/chunk`, {
    method: 'POST',
    body: JSON.stringify({
      t: body.t ?? 0,
      text: body.text ?? '',
      sr: body.sr ?? 8000,
      pcm_s16le_b64: body.pcmS16leB64,
    }),
  });
}

export async function sidecarScripts(base = sidecarBaseUrl()): Promise<{
  scripts: Array<{ id: string; family: string; is_scam: boolean; n_turns: number; cell: string }>;
}> {
  return jsonFetch(`${base}/v1/scripts`);
}

export async function sidecarScoreLinguistic(text: string, t = 0, base = sidecarBaseUrl()): Promise<{
  fraud: number; confidence: number; stage: string; groups: string[];
}> {
  return jsonFetch(`${base}/v1/score/linguistic`, {
    method: 'POST',
    body: JSON.stringify({ text, t }),
  });
}

export async function sidecarScoreAcoustic(pcmS16leB64: string, sr = 8000, base = sidecarBaseUrl()): Promise<{
  synth: number; confidence: number;
}> {
  return jsonFetch(`${base}/v1/score/acoustic`, {
    method: 'POST',
    body: JSON.stringify({ sr, pcm_s16le_b64: pcmS16leB64 }),
  });
}

export async function sidecarScoreFuse(fraud: number, synth: number, t = 0, base = sidecarBaseUrl()): Promise<{
  fraud: number; synth: number; risk: number; tier: string; regime: string; or_label: number;
}> {
  return jsonFetch(`${base}/v1/score/fuse`, {
    method: 'POST',
    body: JSON.stringify({ fraud, synth, t }),
  });
}

export const LAB_SCRIPTS: { id: string; label: string; cell: 'safe' | 'se' }[] = [
  { id: 'ind_b01', label: 'Dentist reminder (safe)', cell: 'safe' },
  { id: 'ind_b06', label: 'Bank posted a debit (safe)', cell: 'safe' },
  { id: 'ind_s01', label: 'Grandparent / bond (SE)', cell: 'se' },
  { id: 'ind_s03', label: 'Fake refund (SE)', cell: 'se' },
];


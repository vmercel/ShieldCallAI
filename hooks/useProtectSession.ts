/**
 * Live Protect session.
 * Expo Go / simulator: expo-av microphone + typed transcript + SENTINEL.
 * expo-speech-recognition is a native module and is not in Expo Go, so it is not imported.
 * Optional LAN sidecar. Fail-open. Never hangs up. Never joins the carrier call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { SentinelEngine, ConversationAnalysis } from '../services/sentinelEngine';
import { fuseScores, ProtectAction } from '../services/fusion';
import { AcousticSentinel } from '../services/acousticSentinel';
import {
  sidecarBaseUrl,
  sidecarCloseCall,
  sidecarHealth,
  sidecarOpenCall,
  sidecarTranscript,
} from '../services/shieldcallSidecar';

const SIDECAR_TIMEOUT_MS = 1200;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export type ProtectStatus = {
  listening: boolean;
  consented: boolean;
  speechAvailable: boolean;
  sidecar: 'off' | 'on' | 'lost';
  action: ProtectAction;
  reason: string;
  fraud: number;
  synth: number;
  risk: number;
  flags: string[];
  transcript: string;
  interim: string;
  error: string | null;
  level: number;
};

const empty: ProtectStatus = {
  listening: false,
  consented: false,
  speechAvailable: false,
  sidecar: 'off',
  action: 'monitor',
  reason: 'Idle',
  fraud: 0,
  synth: 0,
  risk: 0,
  flags: [],
  transcript: '',
  interim: '',
  error: null,
  level: 0,
};

export function useProtectSession() {
  const [status, setStatus] = useState<ProtectStatus>(empty);
  const engineRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());
  const callIdRef = useRef<string | null>(null);
  const sidecarUrlRef = useRef(sidecarBaseUrl());
  const listeningRef = useRef(false);
  const synthRef = useRef(0);
  const analysisRef = useRef<ConversationAnalysis | null>(null);
  const transcriptRef = useRef('');
  const consentedRef = useRef(false);
  const levelRef = useRef(0);

  const publish = useCallback((patch: Partial<ProtectStatus>) => {
    setStatus(prev => {
      const next = { ...prev, ...patch };
      const fraud = (analysisRef.current?.compositeScore ?? 0) / 100;
      const fused = fuseScores(fraud, synthRef.current);
      next.fraud = fraud;
      next.synth = synthRef.current;
      next.risk = fused.risk;
      next.action = fused.action;
      next.reason = patch.reason ?? fused.reason;
      next.flags = analysisRef.current?.allFlags ?? [];
      next.level = levelRef.current;
      return next;
    });
  }, []);

  const setConsented = useCallback((consented: boolean) => {
    consentedRef.current = consented;
    publish({ consented });
  }, [publish]);

  const start = useCallback(async () => {
    if (!consentedRef.current) {
      publish({ error: 'Consent is required before the microphone is used.' });
      return;
    }
    engineRef.current = new SentinelEngine();
    analysisRef.current = null;
    synthRef.current = 0;
    callIdRef.current = null;
    transcriptRef.current = '';
    levelRef.current = 0;

    const granted = await acousticRef.current.requestPermission();
    if (!granted) {
      publish({ error: 'Microphone permission denied.', speechAvailable: false });
      return;
    }

    const micOn = await acousticRef.current.startMonitoring(snap => {
      if (!listeningRef.current) return;
      synthRef.current = Math.min(1, (snap.acousticStressScore || 0) / 100);
      levelRef.current = snap.normalizedAmplitude ?? 0;
      publish({});
    });

    listeningRef.current = true;
    publish({
      listening: true,
      error: micOn ? null : 'Microphone permission is off.',
      speechAvailable: false,
      transcript: '',
      interim: '',
      sidecar: 'off',
      reason: micOn ? 'Listening' : 'Microphone is off',
      level: 0,
    });

    try {
      const h = await withTimeout(sidecarHealth(sidecarUrlRef.current), SIDECAR_TIMEOUT_MS);
      if (h.live || h.ready) {
        const opened = await withTimeout(
          sidecarOpenCall(undefined, sidecarUrlRef.current),
          SIDECAR_TIMEOUT_MS,
        );
        if (!opened.shed) {
          callIdRef.current = opened.call_id;
          publish({ sidecar: 'on' });
        }
      }
    } catch {
      callIdRef.current = null;
      publish({ sidecar: 'off' });
    }
  }, [publish]);

  const stop = useCallback(async () => {
    listeningRef.current = false;
    try {
      await acousticRef.current.stopMonitoring();
    } catch {
      /* fail-open */
    }
    const cid = callIdRef.current;
    if (cid) {
      sidecarCloseCall(cid, sidecarUrlRef.current).catch(() => {});
    }
    callIdRef.current = null;
    publish({ listening: false, interim: '', reason: 'Stopped. The call was never joined or hung up.' });
  }, [publish]);

  const ingestTyped = useCallback((text: string) => {
    if (!consentedRef.current) {
      publish({ error: 'Consent is required before this call is analyzed.' });
      return;
    }
    const t = text.trim();
    if (!t) return;
    engineRef.current.ingestSegment(t);
    analysisRef.current = engineRef.current.analyzeConversation();
    transcriptRef.current = (transcriptRef.current + ' ' + t).trim();
    publish({ transcript: transcriptRef.current, interim: '', error: null });
    const cid = callIdRef.current;
    if (cid) {
      sidecarTranscript(cid, t, Date.now() / 1000, sidecarUrlRef.current).catch(() => {
        publish({ sidecar: 'lost' });
      });
    }
  }, [publish]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      acousticRef.current.stopMonitoring().catch(() => {});
    };
  }, []);

  return { status, setConsented, start, stop, ingestTyped, platform: Platform.OS };
}

/**
 * useLiveTranscription™
 * Real-time automatic speech-to-text feeding SENTINEL™ without any user typing.
 *
 * Web platform  → Web Speech API (SpeechRecognition) in continuous mode.
 *                 Captures this phone's live conversation while the call is on.
 *
 * Native        → useNativeSTT: chunked expo-av recording → Deepgram transcription
 *                 via the transcribe-audio Supabase edge function.
 *                 Falls back to manual input if DEEPGRAM_API_KEY is not set.
 *
 * Auto-restart  → When SpeechRecognition ends (browser auto-stops after ~60s),
 *                 the hook transparently restarts it — maintaining a seamless
 *                 uninterrupted session for the full call duration.
 *
 * Speaker tagging → Simple energy-gap heuristic: a pause > 800ms between
 *                   final results is treated as a speaker turn change.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useNativeSTT } from './useNativeSTT';

export interface TranscriptSegment {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: 'A' | 'B';          // Alternates on pause > 800ms
  timestamp: number;
  analyzed?: boolean;
  threatScore?: number;
}

export interface LiveTranscriptionState {
  isListening: boolean;
  isSupported: boolean;
  segments: TranscriptSegment[];
  interimText: string;
  currentSpeaker: 'A' | 'B';
  error: string | null;
  wordCount: number;
  sessionDurationMs: number;
}

type OnSegmentCallback = (text: string, speaker: 'A' | 'B') => void;

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function isWebSpeechSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const g = globalThis as any;
    return !!(g.SpeechRecognition || g.webkitSpeechRecognition);
  } catch {
    return false;
  }
}

export function useLiveTranscription(
  onFinalSegment?: OnSegmentCallback,
) {
  const isNative = Platform.OS !== 'web';

  // Native platform: delegate to useNativeSTT
  const nativeSTT = useNativeSTT(
    isNative ? onFinalSegment : undefined,
  );

  const [state, setState] = useState<LiveTranscriptionState>({
    isListening: false,
    isSupported: isNative ? true : isWebSpeechSupported(),
    segments: [],
    interimText: '',
    currentSpeaker: 'A',
    error: null,
    wordCount: 0,
    sessionDurationMs: 0,
  });

  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const currentSpeakerRef = useRef<'A' | 'B'>('A');
  const lastFinalTimeRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Speaker turn detection: pause > 800ms = new speaker
  const SPEAKER_TURN_MS = 800;

  const detectSpeakerTurn = useCallback((): 'A' | 'B' => {
    const now = Date.now();
    const gap = now - lastFinalTimeRef.current;
    if (lastFinalTimeRef.current > 0 && gap > SPEAKER_TURN_MS) {
      currentSpeakerRef.current = currentSpeakerRef.current === 'A' ? 'B' : 'A';
    }
    lastFinalTimeRef.current = now;
    return currentSpeakerRef.current;
  }, []);

  const buildRecognition = useCallback(() => {
    if (!isWebSpeechSupported()) return null;
    const g = globalThis as any;
    const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  }, []);

  const startRecognition = useCallback(() => {
    if (!isActiveRef.current) return;

    const r = buildRecognition();
    if (!r) return;
    recognitionRef.current = r;

    r.onresult = (event: any) => {
      let interimAccum = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          const speaker = detectSpeakerTurn();
          wordCountRef.current += transcript.split(/\s+/).length;

          const seg: TranscriptSegment = {
            id: generateId(),
            text: transcript,
            isFinal: true,
            speaker,
            timestamp: Date.now(),
          };

          setState(prev => ({
            ...prev,
            segments: [...prev.segments, seg],
            interimText: '',
            currentSpeaker: speaker,
            wordCount: wordCountRef.current,
          }));

          onFinalSegment?.(transcript, speaker);
        } else {
          interimAccum += transcript + ' ';
        }
      }

      if (interimAccum) {
        setState(prev => ({ ...prev, interimText: interimAccum.trim() }));
      }
    };

    r.onerror = (e: any) => {
      const ignoredErrors = ['no-speech', 'aborted', 'network'];
      if (!ignoredErrors.includes(e.error)) {
        setState(prev => ({ ...prev, error: `Recognition error: ${e.error}` }));
      }
    };

    r.onend = () => {
      // Auto-restart as long as session is active
      if (isActiveRef.current) {
        restartTimerRef.current = setTimeout(() => {
          startRecognition();
        }, 150);
      }
    };

    try {
      r.start();
    } catch {}
  }, [buildRecognition, detectSpeakerTurn, onFinalSegment]);

  const start = useCallback(() => {
    if (isNative) {
      nativeSTT.start();
      setState(prev => ({ ...prev, isListening: true, segments: [], wordCount: 0, error: null }));
      return;
    }

    isActiveRef.current = true;
    sessionStartRef.current = Date.now();
    wordCountRef.current = 0;
    currentSpeakerRef.current = 'A';
    lastFinalTimeRef.current = 0;

    setState(prev => ({
      ...prev,
      isListening: true,
      segments: [],
      interimText: '',
      currentSpeaker: 'A',
      error: null,
      wordCount: 0,
      sessionDurationMs: 0,
    }));

    // Duration counter
    durationTimerRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        sessionDurationMs: Date.now() - sessionStartRef.current,
      }));
    }, 1000);

    if (isWebSpeechSupported()) {
      startRecognition();
    }
  }, [isNative, nativeSTT, startRecognition]);

  const stop = useCallback(() => {
    if (isNative) {
      nativeSTT.stop();
      setState(prev => ({ ...prev, isListening: false }));
      return;
    }

    isActiveRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    restartTimerRef.current && clearTimeout(restartTimerRef.current);
    durationTimerRef.current && clearInterval(durationTimerRef.current);

    setState(prev => ({ ...prev, isListening: false, interimText: '' }));
  }, [isNative, nativeSTT]);

  const markSegmentAnalyzed = useCallback((id: string, score: number) => {
    setState(prev => ({
      ...prev,
      segments: prev.segments.map(s =>
        s.id === id ? { ...s, analyzed: true, threatScore: score } : s
      ),
    }));
  }, []);

  const addManualSegment = useCallback((text: string, speaker: 'A' | 'B' = 'A') => {
    if (!text.trim()) return null;
    const seg: TranscriptSegment = {
      id: generateId(),
      text: text.trim(),
      isFinal: true,
      speaker,
      timestamp: Date.now(),
    };
    setState(prev => ({
      ...prev,
      segments: [...prev.segments, seg],
      wordCount: prev.wordCount + text.split(/\s+/).length,
    }));
    onFinalSegment?.(text.trim(), speaker);
    return seg;
  }, [onFinalSegment]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      recognitionRef.current?.stop();
      restartTimerRef.current && clearTimeout(restartTimerRef.current);
      durationTimerRef.current && clearInterval(durationTimerRef.current);
    };
  }, []);

  // On native, merge nativeSTT state into the returned object
  if (isNative) {
    const nativeSegments: TranscriptSegment[] = nativeSTT.segments.map(s => ({
      id: s.id,
      text: s.text,
      isFinal: true,
      speaker: s.speaker,
      timestamp: s.timestamp,
      analyzed: false,
      threatScore: undefined,
    }));
    return {
      ...state,
      isListening: nativeSTT.isListening,
      isSupported: true,
      segments: nativeSegments,
      wordCount: nativeSTT.wordCount,
      error: nativeSTT.error,
      // Expose acoustic data for waveform rendering
      amplitudeHistory: nativeSTT.amplitudeHistory,
      acousticStress: nativeSTT.acousticStress,
      deepfakeConfidence: nativeSTT.deepfakeConfidence,
      start,
      stop,
      markSegmentAnalyzed,
      addManualSegment,
    };
  }

  return {
    ...state,
    start,
    stop,
    markSegmentAnalyzed,
    addManualSegment,
  };
}

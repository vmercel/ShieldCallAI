/**
 * useNativeSTT — Native Speech-to-Text via chunked recording + Deepgram
 *
 * Architecture:
 * 1. expo-av records audio in CHUNK_DURATION_MS windows (default 6s)
 * 2. Each chunk is base64-encoded and sent to the transcribe-audio edge function
 * 3. The edge function calls Deepgram Nova-2 and returns a transcript
 * 4. Transcripts are emitted via onSegment callback
 *
 * Amplitude monitoring runs during each recording window and is exposed
 * via amplitudeHistory, acousticStress, so screens can render waveforms
 * without a separate AcousticSentinel instance.
 *
 * Falls back silently when DEEPGRAM_API_KEY is not configured:
 * the hook still provides amplitude data, transcription is empty.
 *
 * Requires: expo-av, expo-file-system (both in Expo SDK 53)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../services/supabaseClient';

const CHUNK_DURATION_MS = 6000;   // 6-second recording windows
const METERING_INTERVAL_MS = 120; // Amplitude poll rate

export interface NativeSTTSegment {
  id: string;
  text: string;
  confidence: number;
  timestamp: number;
  speaker: 'A' | 'B';
}

export interface NativeSTTState {
  isListening: boolean;
  isTranscribing: boolean;
  segments: NativeSTTSegment[];
  amplitudeHistory: number[];
  acousticStress: number;
  deepfakeConfidence: number;
  error: string | null;
  wordCount: number;
}

type OnSegmentCallback = (text: string, speaker: 'A' | 'B') => void;

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function dbToNormalized(db: number): number {
  return (Math.max(-160, Math.min(0, db)) + 160) / 160;
}

function computeVariance(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
}

export function useNativeSTT(onSegment?: OnSegmentCallback) {
  const [state, setState] = useState<NativeSTTState>({
    isListening: false,
    isTranscribing: false,
    segments: [],
    amplitudeHistory: Array(32).fill(0.05),
    acousticStress: 0,
    deepfakeConfidence: 0,
    error: null,
    wordCount: 0,
  });

  const isActiveRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amplitudeHistoryRef = useRef<number[]>(Array(32).fill(0.05));
  const silenceCountRef = useRef(0);
  const wordCountRef = useRef(0);
  const speakerRef = useRef<'A' | 'B'>('A');
  const lastSpeechTimeRef = useRef(0);
  const isWebRef = useRef(Platform.OS === 'web');

  const startMeteringPoll = useCallback((recording: Audio.Recording) => {
    meteringIntervalRef.current = setInterval(async () => {
      if (!recording || !isActiveRef.current) return;
      try {
        const status = await recording.getStatusAsync();
        if (!status.isRecording) return;

        const db: number = (status as any).metering ?? -160;
        const amp = dbToNormalized(db);
        const isSilent = amp < 0.05;

        if (isSilent) silenceCountRef.current++;
        else silenceCountRef.current = 0;

        amplitudeHistoryRef.current = [...amplitudeHistoryRef.current.slice(-31), amp];
        const variance = computeVariance(amplitudeHistoryRef.current);

        // Simple acoustic stress: low variance + high amplitude
        let stress = 0;
        if (variance < 0.01 && amplitudeHistoryRef.current.length > 10) stress += 35;
        if (amp > 0.7) stress += 25;
        if (silenceCountRef.current > 8) stress += 20;
        stress = Math.min(100, Math.round(stress));

        // Deepfake proxy: sustained low variance over 20+ samples
        const deepfakeConf = variance < 0.008 && amplitudeHistoryRef.current.length >= 20
          ? Math.min(100, Math.round((1 - variance / 0.008) * 60))
          : 0;

        // Speaker turn: pause > 700ms = new speaker
        if (!isSilent) {
          if (lastSpeechTimeRef.current > 0 && Date.now() - lastSpeechTimeRef.current > 700) {
            speakerRef.current = speakerRef.current === 'A' ? 'B' : 'A';
          }
          lastSpeechTimeRef.current = Date.now();
        }

        setState(prev => ({
          ...prev,
          amplitudeHistory: [...amplitudeHistoryRef.current],
          acousticStress: stress,
          deepfakeConfidence: deepfakeConf,
        }));
      } catch {}
    }, METERING_INTERVAL_MS);
  }, []);

  const stopCurrentRecording = useCallback(async (): Promise<string | null> => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    if (!recordingRef.current) return null;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      return uri ?? null;
    } catch {
      recordingRef.current = null;
      return null;
    }
  }, []);

  const transcribeChunk = useCallback(async (uri: string) => {
    if (!uri || !isActiveRef.current) return;
    setState(prev => ({ ...prev, isTranscribing: true }));
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Delete the temp file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      if (!base64 || !isActiveRef.current) return;

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audioBase64: base64, mimeType: 'audio/m4a', language: 'en' },
      });

      if (error || !data?.transcript) return;

      const text: string = data.transcript.trim();
      if (!text) return;

      const words = text.split(/\s+/).filter(Boolean).length;
      wordCountRef.current += words;

      const segment: NativeSTTSegment = {
        id: generateId(),
        text,
        confidence: data.confidence ?? 0,
        timestamp: Date.now(),
        speaker: speakerRef.current,
      };

      setState(prev => ({
        ...prev,
        segments: [...prev.segments, segment],
        wordCount: wordCountRef.current,
      }));

      onSegment?.(text, speakerRef.current);
    } catch (e) {
      console.warn('useNativeSTT transcription error:', e);
    } finally {
      setState(prev => ({ ...prev, isTranscribing: false }));
    }
  }, [onSegment]);

  const startNewRecording = useCallback(async () => {
    if (!isActiveRef.current) return;
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await recording.startAsync();
      recordingRef.current = recording;
      startMeteringPoll(recording);

      // Schedule chunk cutoff
      chunkTimerRef.current = setTimeout(async () => {
        if (!isActiveRef.current) return;
        const uri = await stopCurrentRecording();
        if (uri) transcribeChunk(uri);
        startNewRecording(); // Immediately start next chunk
      }, CHUNK_DURATION_MS);
    } catch (e) {
      console.warn('useNativeSTT recording start error:', e);
      setState(prev => ({ ...prev, error: 'Microphone recording failed' }));
    }
  }, [startMeteringPoll, stopCurrentRecording, transcribeChunk]);

  const start = useCallback(async () => {
    if (isWebRef.current) return; // Web uses Web Speech API

    isActiveRef.current = true;
    wordCountRef.current = 0;
    speakerRef.current = 'A';
    lastSpeechTimeRef.current = 0;

    setState(prev => ({
      ...prev,
      isListening: true,
      segments: [],
      wordCount: 0,
      error: null,
    }));

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      await startNewRecording();
    } catch (e) {
      console.warn('useNativeSTT start error:', e);
      setState(prev => ({ ...prev, error: 'Could not access microphone', isListening: false }));
    }
  }, [startNewRecording]);

  const stop = useCallback(async () => {
    isActiveRef.current = false;
    chunkTimerRef.current && clearTimeout(chunkTimerRef.current);

    const uri = await stopCurrentRecording();
    // Transcribe final chunk if it has content
    if (uri) transcribeChunk(uri);

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}

    setState(prev => ({ ...prev, isListening: false, isTranscribing: false }));
  }, [stopCurrentRecording, transcribeChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      chunkTimerRef.current && clearTimeout(chunkTimerRef.current);
      meteringIntervalRef.current && clearInterval(meteringIntervalRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  return { ...state, start, stop };
}

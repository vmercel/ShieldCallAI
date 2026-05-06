/**
 * useRealCall Hook
 * Integrates real microphone audio via AcousticSentinel™
 * + SENTINEL™ NLP engine for live threat analysis.
 *
 * What is genuinely real:
 * - Real microphone amplitude metering via expo-av Recording
 * - Real NLP analysis of any text input through SENTINEL engine
 * - Real acoustic stress scoring from live mic data
 * - Real temporal trajectory computation
 * - Real flag and fact-check surfacing
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ThreatLevel } from '../constants/mockData';
import { SentinelEngine, ThreatWindow, ConversationAnalysis } from '../services/sentinelEngine';
import { AcousticSentinel, AcousticSnapshot } from '../services/acousticSentinel';

export interface LiveCallState {
  // SENTINEL NLP state
  threatScore: number;
  threatLevel: ThreatLevel;
  threatFlags: string[];
  factChecks: string[];
  trajectoryLabel: 'rising' | 'falling' | 'stable';
  scamType: string | null;
  confidenceLabel: string;
  windows: ThreatWindow[];

  // Acoustic state (real mic)
  acousticStress: number;
  amplitude: number;
  amplitudeHistory: number[];
  isMicActive: boolean;
  acousticFlags: string[];
  deepfakeConfidence: number;
  hasMicPermission: boolean;

  // Composite
  compositeScore: number;
  duration: number;
  isActive: boolean;
}

const INITIAL_STATE: LiveCallState = {
  threatScore: 0,
  threatLevel: 'safe',
  threatFlags: [],
  factChecks: [],
  trajectoryLabel: 'stable',
  scamType: null,
  confidenceLabel: 'Insufficient Data',
  windows: [],
  acousticStress: 0,
  amplitude: 0,
  amplitudeHistory: [],
  isMicActive: false,
  acousticFlags: [],
  deepfakeConfidence: 0,
  hasMicPermission: false,
  compositeScore: 0,
  duration: 0,
  isActive: false,
};

export function useRealCall() {
  const [state, setState] = useState<LiveCallState>(INITIAL_STATE);
  const sentinelRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ─── START CALL ────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    sentinelRef.current.reset();
    acousticRef.current.reset();
    startTimeRef.current = Date.now();

    // Start duration counter
    durationTimerRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        duration: Math.round((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);

    // Request mic and start acoustic monitoring
    const micGranted = await acousticRef.current.requestPermission();

    setState(prev => ({
      ...prev,
      isActive: true,
      hasMicPermission: micGranted,
      isMicActive: micGranted,
    }));

    if (micGranted) {
      await acousticRef.current.startMonitoring((snapshot: AcousticSnapshot) => {
        setState(prev => ({
          ...prev,
          acousticStress: snapshot.acousticStressScore,
          amplitude: snapshot.normalizedAmplitude,
          amplitudeHistory: snapshot.amplitudeHistory.slice(-30),
          acousticFlags: snapshot.flags,
          // Composite: 70% NLP + 30% acoustic
          compositeScore: Math.min(100, Math.round(
            prev.threatScore * 0.7 + snapshot.acousticStressScore * 0.3
          )),
        }));
      });
    }
  }, []);

  // ─── ANALYZE TEXT ─────────────────────────────────────────────────────────

  const analyzeText = useCallback((text: string) => {
    if (!text.trim()) return;

    const window = sentinelRef.current.ingestSegment(text);
    const analysis = sentinelRef.current.analyzeConversation();

    setState(prev => {
      const acoustic = prev.acousticStress;
      return {
        ...prev,
        threatScore: window.score,
        threatLevel: window.level,
        threatFlags: window.flags,
        factChecks: window.factChecks,
        trajectoryLabel: window.trajectoryLabel,
        scamType: analysis.scamType,
        confidenceLabel: analysis.confidenceLabel,
        windows: [...prev.windows, window].slice(-20),
        compositeScore: Math.min(100, Math.round(window.score * 0.7 + acoustic * 0.3)),
      };
    });

    return window;
  }, []);

  // ─── STOP CALL ────────────────────────────────────────────────────────────

  const stopCall = useCallback(async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    const session = await acousticRef.current.stopMonitoring();
    const analysis = sentinelRef.current.analyzeConversation();

    setState(prev => ({
      ...prev,
      isActive: false,
      isMicActive: false,
      deepfakeConfidence: session.deepfakeConfidence,
      acousticFlags: session.flags,
      threatScore: analysis.compositeScore,
      threatLevel: analysis.level,
      threatFlags: analysis.allFlags,
      factChecks: analysis.allFactChecks,
    }));

    return { analysis, session };
  }, []);

  // ─── CLEANUP ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      durationTimerRef.current && clearInterval(durationTimerRef.current);
      acousticRef.current.stopMonitoring();
    };
  }, []);

  return {
    ...state,
    startCall,
    stopCall,
    analyzeText,
    sentinel: sentinelRef.current,
  };
}

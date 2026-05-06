/**
 * useGhostMode Hook
 * Manages the complete Ghost Mode AI session:
 * - GhostAIResponder finite-state conversation engine
 * - SENTINEL NLP threat analysis on every caller utterance
 * - AcousticSentinel microphone monitoring
 * - expo-speech TTS synthesis
 * - Expose Mode state machine
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GhostAIResponder, GhostMessage, GhostIntelligence } from '../services/ghostAIResponder';
import { SentinelEngine } from '../services/sentinelEngine';
import { AcousticSentinel } from '../services/acousticSentinel';
import { ThreatLevel } from '../constants/mockData';

export interface GhostModeState {
  messages: GhostMessage[];
  isAISpeaking: boolean;
  isExposeMode: boolean;
  threatScore: number;
  threatLevel: ThreatLevel;
  threatFlags: string[];
  factChecks: string[];
  trajectoryLabel: 'rising' | 'falling' | 'stable';
  duration: number;
  intelligence: GhostIntelligence;
  acousticStress: number;
  amplitude: number;
  deepfakeConfidence: number;
  hasMicPermission: boolean;
  inputText: string;
  isProcessing: boolean;
  scamType: string | null;
}

const INITIAL_STATE: GhostModeState = {
  messages: [],
  isAISpeaking: false,
  isExposeMode: false,
  threatScore: 0,
  threatLevel: 'safe',
  threatFlags: [],
  factChecks: [],
  trajectoryLabel: 'stable',
  duration: 0,
  intelligence: {
    callerClaimedIdentity: null,
    callerPurpose: null,
    urgencyClaims: [],
    paymentMentioned: false,
    identityConsistency: 100,
    informationGathered: [],
    timeWasted: 0,
  },
  acousticStress: 0,
  amplitude: 0,
  deepfakeConfidence: 0,
  hasMicPermission: false,
  inputText: '',
  isProcessing: false,
  scamType: null,
};

export function useGhostMode(personaName: string) {
  const [state, setState] = useState<GhostModeState>(INITIAL_STATE);
  const responderRef = useRef(new GhostAIResponder());
  const sentinelRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // ─── INITIALIZE ────────────────────────────────────────────────────────────

  const initialize = useCallback(async () => {
    responderRef.current.reset();
    sentinelRef.current.reset();
    acousticRef.current.reset();
    startTimeRef.current = Date.now();

    responderRef.current.setPersona(personaName);

    // Duration counter
    durationRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        duration: Math.round((Date.now() - startTimeRef.current) / 1000),
        intelligence: responderRef.current.getIntelligence(),
      }));
    }, 1000);

    // Start acoustic
    const micGranted = await acousticRef.current.requestPermission();
    setState(prev => ({ ...prev, hasMicPermission: micGranted }));

    if (micGranted) {
      await acousticRef.current.startMonitoring(snapshot => {
        setState(prev => ({
          ...prev,
          acousticStress: snapshot.acousticStressScore,
          amplitude: snapshot.normalizedAmplitude,
          deepfakeConfidence: acousticRef.current.getSession().deepfakeConfidence,
        }));
      });
    }

    // AI sends opening greeting
    setState(prev => ({ ...prev, isAISpeaking: true }));
    await responderRef.current.greet(msg => {
      setState(prev => ({ ...prev, messages: [...prev.messages, msg] }));
    });
    setState(prev => ({ ...prev, isAISpeaking: false }));
  }, [personaName]);

  // ─── PROCESS CALLER INPUT ──────────────────────────────────────────────────

  const submitCallerText = useCallback(async (text: string) => {
    if (!text.trim() || state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true, inputText: '', isAISpeaking: true }));

    // SENTINEL analysis on caller text
    const window = sentinelRef.current.ingestSegment(text);
    const analysis = sentinelRef.current.analyzeConversation();

    setState(prev => ({
      ...prev,
      threatScore: window.score,
      threatLevel: window.level,
      threatFlags: window.flags,
      factChecks: window.factChecks,
      trajectoryLabel: window.trajectoryLabel,
      scamType: analysis.scamType,
    }));

    // GhostAI processes and responds via TTS
    await responderRef.current.processCallerUtterance(text, msg => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, ...responderRef.current.getMessages().slice(-2)],
        intelligence: responderRef.current.getIntelligence(),
      }));
    });

    // Sync full message list
    setState(prev => ({
      ...prev,
      messages: responderRef.current.getMessages(),
      isProcessing: false,
      isAISpeaking: false,
    }));
  }, [state.isProcessing]);

  // ─── EXPOSE MODE ──────────────────────────────────────────────────────────

  const enableExposeMode = useCallback(() => {
    responderRef.current.enableExposeMode();
    setState(prev => ({ ...prev, isExposeMode: true }));
  }, []);

  // ─── END SESSION ─────────────────────────────────────────────────────────

  const endSession = useCallback(async () => {
    durationRef.current && clearInterval(durationRef.current);
    await acousticRef.current.stopMonitoring();
    await responderRef.current.stopSpeaking();
    setState(prev => ({ ...prev, isAISpeaking: false }));
    return {
      messages: responderRef.current.getMessages(),
      intelligence: responderRef.current.getIntelligence(),
      acousticSession: acousticRef.current.getSession(),
    };
  }, []);

  const setInputText = useCallback((text: string) => {
    setState(prev => ({ ...prev, inputText: text }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      durationRef.current && clearInterval(durationRef.current);
      acousticRef.current.stopMonitoring();
      responderRef.current.stopSpeaking();
    };
  }, []);

  return {
    ...state,
    initialize,
    submitCallerText,
    enableExposeMode,
    endSession,
    setInputText,
  };
}

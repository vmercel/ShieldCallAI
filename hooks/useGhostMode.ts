/**
 * useGhostMode Hook — UPGRADED with Real OnSpace AI
 *
 * Ghost Mode now uses the Ghost AI Edge Function (Gemini 3 Flash)
 * instead of the finite-state machine. Every caller utterance is:
 * 1. Analyzed by SENTINEL™ NLP engine for threat scoring
 * 2. Sent to OnSpace AI with full context (messages, threat level, flags)
 * 3. Spoken aloud via expo-speech TTS
 * 4. Tracked for intelligence gathering
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { GhostMessage, GhostIntelligence } from '../services/ghostAIResponder';
import { SentinelEngine } from '../services/sentinelEngine';
import { AcousticSentinel } from '../services/acousticSentinel';
import { ghostAIService } from '../services/ghostAIService';
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

async function speakText(text: string, rate = 0.9): Promise<void> {
  return new Promise(resolve => {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      rate,
      pitch: 1.0,
      onDone: resolve,
      onError: resolve,
    });
  });
}

export function useGhostMode(personaName: string, userName = 'the account holder', deepfakeDetect = true) {
  const [state, setState] = useState<GhostModeState>(INITIAL_STATE);
  const sentinelRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Mutable refs for AI context (avoid stale closures)
  const messagesRef = useRef<GhostMessage[]>([]);
  const intelligenceRef = useRef<GhostIntelligence>(INITIAL_STATE.intelligence);
  const isExposeModeRef = useRef(false);
  const deepfakeRef = useRef(0);

  // ─── INITIALIZE ────────────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    sentinelRef.current.reset();
    acousticRef.current.reset();
    messagesRef.current = [];
    isExposeModeRef.current = false;
    startTimeRef.current = Date.now();

    // Duration counter
    durationRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      intelligenceRef.current = {
        ...intelligenceRef.current,
        timeWasted: elapsed,
      };
      setState(prev => ({
        ...prev,
        duration: elapsed,
        intelligence: { ...intelligenceRef.current },
      }));
    }, 1000);

    // Start acoustic monitoring (respects deepfakeDetect setting)
    if (!deepfakeDetect) {
      // Skip acoustic monitoring when deepfake detection is disabled
      setState(prev => ({ ...prev, hasMicPermission: false }));
    } else {
      const micGranted = await acousticRef.current.requestPermission();
      setState(prev => ({ ...prev, hasMicPermission: micGranted }));

      if (micGranted) {
        await acousticRef.current.startMonitoring(snapshot => {
          const deepfake = acousticRef.current.getSession().deepfakeConfidence;
          deepfakeRef.current = deepfake;
          setState(prev => ({
            ...prev,
            acousticStress: snapshot.acousticStressScore,
            amplitude: snapshot.normalizedAmplitude,
            deepfakeConfidence: deepfake,
          }));
        });
      }
    }

    // AI opening greeting
    await sendAIGreeting();
  }, [personaName]);

  const sendAIGreeting = useCallback(async () => {
    setState(prev => ({ ...prev, isAISpeaking: true }));

    const greetingText = `Hello, this is ${personaName}, a communications assistant calling on behalf of ${userName}. How may I direct your call?`;

    const greetingMsg: GhostMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: greetingText,
      state: 'greeting',
      timestamp: Date.now(),
      isSpeaking: true,
    };

    messagesRef.current = [greetingMsg];
    setState(prev => ({ ...prev, messages: [greetingMsg], isAISpeaking: true }));

    await speakText(greetingText);
    setState(prev => ({ ...prev, isAISpeaking: false }));
  }, [personaName, userName]);

  // ─── PROCESS CALLER INPUT (Real AI) ───────────────────────────────────────
  const submitCallerText = useCallback(async (text: string) => {
    if (!text.trim() || state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true, inputText: '' }));

    // Add caller message
    const callerMsg: GhostMessage = {
      id: `caller-${Date.now()}`,
      role: 'caller',
      text,
      timestamp: Date.now(),
    };
    messagesRef.current = [...messagesRef.current, callerMsg];
    setState(prev => ({ ...prev, messages: [...messagesRef.current] }));

    // SENTINEL™ analysis
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

    // Update intelligence
    if (text.match(/payment|gift card|wire|bitcoin|pay/i)) {
      intelligenceRef.current = { ...intelligenceRef.current, paymentMentioned: true };
    }
    if (text.match(/\b(i am|this is|officer|agent|from)\b/i)) {
      const match = text.match(/\b(i am|this is|officer|agent|from)\s+([A-Za-z\s]{2,30})/i);
      if (match?.[2]) {
        intelligenceRef.current = {
          ...intelligenceRef.current,
          callerClaimedIdentity: match[2].trim(),
        };
      }
    }

    // Call OnSpace AI Ghost responder
    setState(prev => ({ ...prev, isAISpeaking: true }));

    const { reply, error } = await ghostAIService.getResponse({
      messages: messagesRef.current.map(m => ({ role: m.role, text: m.text })),
      personaName,
      userName,
      threatScore: window.score,
      threatLevel: window.level,
      threatFlags: window.flags,
      isExposeMode: isExposeModeRef.current,
      deepfakeConfidence: deepfakeRef.current,
    });

    const responseText = reply || 'I understand. Could you please elaborate on that?';

    const aiMsg: GhostMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: responseText,
      state: isExposeModeRef.current ? 'expose_mode' : 'identity_verification',
      timestamp: Date.now(),
      isSpeaking: true,
    };

    messagesRef.current = [...messagesRef.current, aiMsg];
    setState(prev => ({
      ...prev,
      messages: [...messagesRef.current],
      intelligence: { ...intelligenceRef.current },
    }));

    // Speak response
    await speakText(responseText);

    setState(prev => ({
      ...prev,
      isProcessing: false,
      isAISpeaking: false,
    }));
  }, [state.isProcessing, personaName, userName]);

  // ─── EXPOSE MODE ─────────────────────────────────────────────────────────
  const enableExposeMode = useCallback(() => {
    isExposeModeRef.current = true;
    setState(prev => ({ ...prev, isExposeMode: true }));
  }, []);

  // ─── END SESSION ─────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    durationRef.current && clearInterval(durationRef.current);
    await acousticRef.current.stopMonitoring();
    Speech.stop();
    setState(prev => ({ ...prev, isAISpeaking: false }));
    return {
      messages: messagesRef.current,
      intelligence: intelligenceRef.current,
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
      Speech.stop();
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

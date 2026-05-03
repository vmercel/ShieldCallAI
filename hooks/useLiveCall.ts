import React, { useState, useRef, useCallback } from 'react';
import { ThreatLevel } from '../constants/mockData';
import { ThreatService, ThreatWindow } from '../services/threatService';

export interface LiveCallState {
  isActive: boolean;
  callerName: string;
  callerNumber: string;
  duration: number;
  threatLevel: ThreatLevel;
  threatScore: number;
  threatFlags: string[];
  transcript: { role: 'caller' | 'ai'; text: string }[];
  isGhostMode: boolean;
}

export function useLiveCall() {
  const [callState, setCallState] = useState<LiveCallState>({
    isActive: false,
    callerName: '',
    callerNumber: '',
    duration: 0,
    threatLevel: 'safe',
    threatScore: 0,
    threatFlags: [],
    transcript: [],
    isGhostMode: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreProgression = ThreatService.simulateCallProgression();
  const scoreIndexRef = useRef(0);

  const startCall = useCallback((callerName: string, callerNumber: string, ghostMode: boolean) => {
    scoreIndexRef.current = 0;
    setCallState({
      isActive: true,
      callerName,
      callerNumber,
      duration: 0,
      threatLevel: 'safe',
      threatScore: 0,
      threatFlags: [],
      transcript: [],
      isGhostMode: ghostMode,
    });

    // Duration timer
    timerRef.current = setInterval(() => {
      setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);

    // Threat progression timer
    threatTimerRef.current = setInterval(() => {
      if (scoreIndexRef.current < scoreProgression.length) {
        const score = scoreProgression[scoreIndexRef.current];
        const level: ThreatLevel = score >= 70 ? 'danger' : score >= 35 ? 'warning' : 'safe';
        const flags = score >= 70 ? ['Urgency escalation', 'Government impersonation', 'Unusual payment method'] :
                      score >= 35 ? ['Suspicious cadence', 'Urgency escalation'] : [];
        setCallState(prev => ({ ...prev, threatScore: score, threatLevel: level, threatFlags: flags }));
        scoreIndexRef.current++;
      } else {
        if (threatTimerRef.current) clearInterval(threatTimerRef.current);
      }
    }, 1500);
  }, []);

  const endCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (threatTimerRef.current) clearInterval(threatTimerRef.current);
    setCallState(prev => ({ ...prev, isActive: false }));
  }, []);

  const addTranscriptLine = useCallback((role: 'caller' | 'ai', text: string) => {
    setCallState(prev => ({
      ...prev,
      transcript: [...prev.transcript, { role, text }],
    }));
    const analysis: ThreatWindow = ThreatService.analyzeText(text);
    if (analysis.score > 0) {
      setCallState(prev => ({
        ...prev,
        threatScore: Math.max(prev.threatScore, analysis.score),
        threatLevel: analysis.level === 'safe' ? prev.threatLevel : analysis.level,
        threatFlags: [...new Set([...prev.threatFlags, ...analysis.flags])],
      }));
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { callState, startCall, endCall, addTranscriptLine, formatDuration };
}

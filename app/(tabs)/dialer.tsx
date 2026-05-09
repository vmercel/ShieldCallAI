/**
 * CALLSHIELD AI Dialer — Animated Phase Execution
 *
 * AI Agent tab streams real phase-by-phase execution from the edge function:
 * DIALING → IVR → HOLD → AGENT → COMPLETE
 * Each phase renders animated, live transcript lines, and real outcome data.
 *
 * All other tabs also feature rich entry animations.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, Easing, Pressable, Platform,
  Vibration, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { Contact, getInitials, findContactByNumberSync } from '../../services/contactsService';
import { CONTACTS, searchContacts, getFavorites } from '../../constants/contacts';
const findContactByNumber = findContactByNumberSync;
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { parseVoiceCommand } from '../../services/voiceCommandService';
import { callRecordsService } from '../../services/callRecordsService';
import { supabase } from '../../services/supabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';

type Tab = 'voice' | 'pad' | 'agent' | 'contacts';

const PAD_KEYS = [
  { digit: '1', sub: '' }, { digit: '2', sub: 'ABC' }, { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' }, { digit: '5', sub: 'JKL' }, { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' }, { digit: '8', sub: 'TUV' }, { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' }, { digit: '0', sub: '+' }, { digit: '#', sub: '' },
];

const QUICK_TASKS = [
  { icon: 'local-pharmacy', label: 'Refill Prescription', example: 'Call CVS Pharmacy and refill my blood pressure medication' },
  { icon: 'event', label: 'Confirm Appointment', example: 'Call Dr. Nguyen and confirm my appointment on the 15th' },
  { icon: 'cancel', label: 'Cancel Subscription', example: 'Call and cancel my Comcast internet subscription' },
  { icon: 'headset', label: 'File Insurance Claim', example: 'Call my insurance company about a claim denial and get a supervisor' },
  { icon: 'build', label: 'Schedule Plumber', example: 'Schedule a licensed plumber for a leaky faucet next week' },
  { icon: 'local-shipping', label: 'Track Delivery', example: 'Call UPS to find out where my package is and get an ETA' },
];

// ─── Phase definitions ────────────────────────────────────────────────────────
type PhaseKey = 'idle' | 'dialing' | 'ivr' | 'hold' | 'agent' | 'complete' | 'error';

interface PhaseEvent {
  phase: PhaseKey;
  message?: string;
  transcript?: { speaker: string; text: string }[];
  holdTime?: number;
  durationMs?: number;
  result?: {
    outcome: 'success' | 'partial' | 'failed';
    summary: string;
    actionItems: string[];
    callDetails: { organization: string; department: string; confirmationNumber: string | null; nextSteps: string };
    duration: number;
    transcript: { speaker: string; text: string }[];
  };
  error?: string;
}

const PHASE_META: Record<PhaseKey, { icon: string; label: string; color: string }> = {
  idle:     { icon: 'support-agent',   label: 'Ready',        color: Colors.textMuted },
  dialing:  { icon: 'phone',           label: 'Dialing',      color: Colors.primary },
  ivr:      { icon: 'dialpad',         label: 'IVR Menu',     color: Colors.warning },
  hold:     { icon: 'hourglass-top',   label: 'On Hold',      color: Colors.warning },
  agent:    { icon: 'record-voice-over', label: 'With Agent', color: Colors.safe },
  complete: { icon: 'check-circle',    label: 'Complete',     color: Colors.safe },
  error:    { icon: 'error-outline',   label: 'Error',        color: Colors.danger },
};

// ─── Animated entry wrapper ───────────────────────────────────────────────────
function FadeInView({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 340, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(translateY, { toValue: 0, duration: 340, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// ─── Pulse dot ────────────────────────────────────────────────────────────────
function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity, transform: [{ scale }],
    }} />
  );
}

// ─── Spinning ring ────────────────────────────────────────────────────────────
function SpinRing({ color, size = 44 }: { color: string; size?: number }) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 3, borderColor: color + '33',
      borderTopColor: color,
      transform: [{ rotate: rotation }],
    }} />
  );
}

// ─── Phase Step Indicator ─────────────────────────────────────────────────────
function PhaseSteps({ current }: { current: PhaseKey }) {
  const steps: PhaseKey[] = ['dialing', 'ivr', 'hold', 'agent', 'complete'];
  const currentIdx = steps.indexOf(current);

  return (
    <View style={styles.phaseStepsRow}>
      {steps.map((step, i) => {
        const meta = PHASE_META[step];
        const isDone = current === 'complete' ? true : i < currentIdx;
        const isActive = step === current;
        const color = isDone ? Colors.safe : isActive ? meta.color : Colors.textMuted;
        return (
          <React.Fragment key={step}>
            <View style={styles.phaseStep}>
              <Animated.View style={[
                styles.phaseStepCircle,
                { borderColor: color, backgroundColor: isDone ? Colors.safe + '22' : isActive ? color + '22' : Colors.bgSurface },
              ]}>
                {isDone ? (
                  <MaterialIcons name="check" size={12} color={Colors.safe} />
                ) : isActive ? (
                  <PulseDot color={color} size={7} />
                ) : (
                  <View style={[styles.phaseStepDot, { backgroundColor: Colors.textMuted }]} />
                )}
              </Animated.View>
              <Text style={[styles.phaseStepLabel, { color }]}>{meta.label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.phaseConnector, { backgroundColor: isDone ? Colors.safe : Colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Live Transcript Line (animates in) ──────────────────────────────────────
function TranscriptLine({ speaker, text, index }: { speaker: string; text: string; index: number }) {
  const isAI = speaker === 'ai';
  const isSystem = speaker === 'system';
  const color = isSystem ? Colors.textMuted : isAI ? Colors.primary : Colors.warning;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(isAI ? 16 : -16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 120, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 300, delay: index * 120, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.transcriptLine,
      { borderLeftColor: color, opacity, transform: [{ translateX }] },
      isAI && styles.transcriptAI,
      isSystem && styles.transcriptSystem,
    ]}>
      <Text style={[styles.transcriptSpeaker, { color }]}>{speaker.toUpperCase()}</Text>
      <Text style={styles.transcriptText}>{text}</Text>
    </Animated.View>
  );
}

// ─── Phase Status Display ─────────────────────────────────────────────────────
function PhaseStatusCard({
  phase,
  currentEvent,
  allTranscript,
  elapsedTime,
}: {
  phase: PhaseKey;
  currentEvent: PhaseEvent | null;
  allTranscript: { speaker: string; text: string }[];
  elapsedTime: number;
}) {
  const meta = PHASE_META[phase];
  const transcriptRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => transcriptRef.current?.scrollToEnd({ animated: true }), 100);
  }, [allTranscript.length]);

  if (phase === 'idle') return null;

  return (
    <FadeInView style={styles.phaseCard}>
      {/* Current phase header */}
      <View style={[styles.phaseHeader, { borderColor: meta.color + '44' }]}>
        <View style={styles.phaseHeaderLeft}>
          {phase !== 'complete' && phase !== 'error' ? (
            <SpinRing color={meta.color} size={36} />
          ) : (
            <View style={[styles.phaseIconCircle, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
              <MaterialIcons name={meta.icon as any} size={18} color={meta.color} />
            </View>
          )}
          <View>
            <Text style={[styles.phaseLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            {currentEvent?.message && (
              <Text style={styles.phaseMessage} numberOfLines={2}>{currentEvent.message}</Text>
            )}
          </View>
        </View>
        <View style={styles.phaseTimerWrap}>
          <MaterialIcons name="timer" size={12} color={Colors.textMuted} />
          <Text style={styles.phaseTimer}>{elapsedTime}s</Text>
        </View>
      </View>

      {/* Hold time badge */}
      {phase === 'hold' && currentEvent?.holdTime && (
        <FadeInView style={styles.holdBadge}>
          <MaterialIcons name="hourglass-top" size={14} color={Colors.warning} />
          <Text style={styles.holdBadgeText}>{currentEvent.holdTime}s estimated hold time</Text>
        </FadeInView>
      )}

      {/* Live transcript */}
      {allTranscript.length > 0 && (
        <View style={styles.liveTranscriptWrap}>
          <View style={styles.liveTranscriptHeader}>
            <PulseDot color={Colors.primary} size={6} />
            <Text style={styles.liveTranscriptLabel}>LIVE TRANSCRIPT</Text>
          </View>
          <ScrollView
            ref={transcriptRef}
            style={styles.liveTranscriptScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, padding: Spacing.sm }}
          >
            {allTranscript.map((line, i) => (
              <TranscriptLine key={i} speaker={line.speaker} text={line.text} index={i} />
            ))}
          </ScrollView>
        </View>
      )}
    </FadeInView>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, instruction, onReset }: {
  result: NonNullable<PhaseEvent['result']>;
  instruction: string;
  onReset: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 10, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const outcomeColor = result.outcome === 'success' ? Colors.safe : result.outcome === 'partial' ? Colors.warning : Colors.danger;
  const outcomeIcon = result.outcome === 'success' ? 'check-circle' : result.outcome === 'partial' ? 'info' : 'error';
  const outcomeLabel = result.outcome === 'success' ? 'Task Completed' : result.outcome === 'partial' ? 'Partially Completed' : 'Task Failed';

  return (
    <Animated.View style={[styles.resultCard, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Outcome Banner */}
      <View style={[styles.outcomeBanner, {
        backgroundColor: outcomeColor + '18',
        borderColor: outcomeColor + '55',
      }]}>
        <MaterialIcons name={outcomeIcon as any} size={26} color={outcomeColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.outcomeLabelText, { color: outcomeColor }]}>{outcomeLabel}</Text>
          <Text style={styles.outcomeDuration}>{result.duration}s · {result.callDetails.organization}</Text>
        </View>
        {result.callDetails.confirmationNumber && (
          <View style={[styles.confirmBadge, { borderColor: outcomeColor + '55', backgroundColor: outcomeColor + '11' }]}>
            <Text style={[styles.confirmBadgeText, { color: outcomeColor }]}>
              #{result.callDetails.confirmationNumber}
            </Text>
          </View>
        )}
      </View>

      {/* Summary */}
      <View style={styles.resultSummaryWrap}>
        <MaterialIcons name="psychology" size={16} color={Colors.primary} />
        <Text style={styles.resultSummaryText}>{result.summary}</Text>
      </View>

      {/* Call Details */}
      <View style={styles.resultDetailsWrap}>
        {[
          { label: 'Organization', value: result.callDetails.organization },
          { label: 'Department', value: result.callDetails.department },
          { label: 'Next Steps', value: result.callDetails.nextSteps },
        ].map(d => (
          <View key={d.label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{d.label}</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{d.value}</Text>
          </View>
        ))}
      </View>

      {/* Action Items */}
      {result.actionItems.length > 0 && (
        <View style={styles.actionItemsWrap}>
          <Text style={styles.actionItemsTitle}>
            <MaterialIcons name="task-alt" size={13} color={Colors.primary} /> Action Items
          </Text>
          {result.actionItems.map((item, i) => (
            <FadeInView key={i} delay={i * 80} style={styles.actionItemRow}>
              <View style={[styles.actionItemNum, { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary + '44' }]}>
                <Text style={styles.actionItemNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.actionItemText}>{item}</Text>
            </FadeInView>
          ))}
        </View>
      )}

      {/* Full Transcript */}
      {result.transcript.length > 0 && (
        <View style={styles.fullTranscriptWrap}>
          <Text style={styles.fullTranscriptTitle}>Full Call Transcript</Text>
          <ScrollView style={styles.fullTranscriptScroll} showsVerticalScrollIndicator={false}>
            {result.transcript.map((line, i) => (
              <TranscriptLine key={i} speaker={line.speaker} text={line.text} index={i} />
            ))}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity style={styles.newTaskBtn} onPress={onReset} activeOpacity={0.85}>
        <MaterialIcons name="add" size={18} color={Colors.primary} />
        <Text style={styles.newTaskBtnText}>New Task</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── AI AGENT TAB ─────────────────────────────────────────────────────────────
function AIAgentTab() {
  const [instruction, setInstruction] = useState('');
  const [phase, setPhase] = useState<PhaseKey>('idle');
  const [currentEvent, setCurrentEvent] = useState<PhaseEvent | null>(null);
  const [allTranscript, setAllTranscript] = useState<{ speaker: string; text: string }[]>([]);
  const [finalResult, setFinalResult] = useState<NonNullable<PhaseEvent['result']> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const executeCall = useCallback(async () => {
    if (!instruction.trim()) return;

    setPhase('dialing');
    setCurrentEvent(null);
    setAllTranscript([]);
    setFinalResult(null);
    setError(null);
    setElapsedTime(0);

    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    abortRef.current = new AbortController();

    try {
      // Get supabase session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session ? `Bearer ${session.access_token}` : '';

      const { data: { session: s } } = await supabase.auth.getSession();
      const url = `${(supabase as any).supabaseUrl}/functions/v1/ai-dialer`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'apikey': (supabase as any).supabaseKey ?? '',
        },
        body: JSON.stringify({ instruction: instruction.trim() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`AI Dialer: ${response.status} ${response.statusText}`);
      }

      // Parse NDJSON stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event: PhaseEvent = JSON.parse(trimmed);
              processPhaseEvent(event);
            } catch {}
          }
        }
        // Process any remaining
        if (buffer.trim()) {
          try { processPhaseEvent(JSON.parse(buffer.trim())); } catch {}
        }
      } else {
        // Fallback: full response
        const text = await response.text();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try { processPhaseEvent(JSON.parse(line)); } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message ?? String(e));
      setPhase('error');
    } finally {
      timerRef.current && clearInterval(timerRef.current);
    }
  }, [instruction]);

  const processPhaseEvent = (event: PhaseEvent) => {
    if (event.phase === 'error') {
      setError(event.error ?? 'Unknown error');
      setPhase('error');
      return;
    }

    if (event.phase === 'complete' && event.result) {
      setPhase('complete');
      setCurrentEvent(event);
      setFinalResult(event.result);
      // Save to call records
      callRecordsService.insert({
        caller_name: event.result.callDetails.organization || 'AI Dialer',
        caller_number: 'AI-DIALED',
        caller_org: event.result.callDetails.organization,
        direction: 'outbound',
        started_at: new Date(Date.now() - (event.result.duration ?? 0) * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: event.result.duration ?? 0,
        threat_level: 'safe',
        threat_score: 0,
        scam_type: null,
        summary: event.result.summary,
        ai_notes: `AI Dialer task: "${instruction}"`,
        tags: ['ai-dialer', 'outbound'],
        ghost_handled: true,
        transcript: event.result.transcript,
        flags: [],
        fact_checks: [],
        is_blocked: false,
        reported_to_ftc: false,
      }).catch(() => {});
      return;
    }

    // Regular phase event
    setPhase(event.phase as PhaseKey);
    setCurrentEvent(event);
    if (event.transcript && event.transcript.length > 0) {
      setAllTranscript(prev => [...prev, ...event.transcript!]);
    }
  };

  const resetAgent = () => {
    abortRef.current?.abort();
    timerRef.current && clearInterval(timerRef.current);
    setPhase('idle');
    setCurrentEvent(null);
    setAllTranscript([]);
    setFinalResult(null);
    setError(null);
    setInstruction('');
    setElapsedTime(0);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  return (
    <View style={styles.agentTab}>
      {/* Header */}
      <FadeInView style={styles.agentHeader}>
        <View style={styles.agentIconWrap}>
          {isRunning ? (
            <SpinRing color={Colors.primary} size={48} />
          ) : (
            <MaterialIcons name="support-agent" size={24} color={Colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agentTitle}>AI Call Agent</Text>
          <Text style={styles.agentSub}>Real call simulation · OnSpace AI · Gemini 3 Flash</Text>
        </View>
        {isRunning ? (
          <TouchableOpacity onPress={resetAgent} style={styles.cancelBtn} activeOpacity={0.8}>
            <MaterialIcons name="stop" size={14} color={Colors.danger} />
            <Text style={styles.cancelBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.agentOnBadge}>
            <PulseDot color={Colors.safe} size={7} />
            <Text style={styles.agentOnText}>READY</Text>
          </View>
        )}
      </FadeInView>

      {/* Phase steps — visible during execution */}
      {phase !== 'idle' && phase !== 'error' && (
        <FadeInView style={{ marginBottom: Spacing.md }}>
          <PhaseSteps current={phase} />
        </FadeInView>
      )}

      {/* Idle: instruction input */}
      {phase === 'idle' && (
        <FadeInView>
          <Text style={styles.agentInstructLabel}>What should the AI handle?</Text>
          <TextInput
            style={styles.agentInput}
            placeholder="e.g. Call CVS and refill my blood pressure medication"
            placeholderTextColor={Colors.textMuted}
            value={instruction}
            onChangeText={setInstruction}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.executeBtn, !instruction.trim() && styles.executeBtnDisabled]}
            onPress={executeCall}
            disabled={!instruction.trim()}
            activeOpacity={0.85}
          >
            <MaterialIcons name="phone-forwarded" size={18} color="#fff" />
            <Text style={styles.executeBtnText}>Let AI Handle This Call</Text>
          </TouchableOpacity>

          <Text style={styles.quickTaskSectionLabel}>Quick Tasks</Text>
          <View style={styles.quickTaskGrid}>
            {QUICK_TASKS.map((task, i) => (
              <FadeInView key={task.label} delay={i * 60}>
                <TouchableOpacity
                  style={styles.quickTask}
                  onPress={() => setInstruction(task.example)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={task.icon as any} size={18} color={Colors.primary} />
                  <Text style={styles.quickTaskLabel2}>{task.label}</Text>
                </TouchableOpacity>
              </FadeInView>
            ))}
          </View>
        </FadeInView>
      )}

      {/* Running: animated phase display */}
      {isRunning && (
        <>
          <FadeInView style={styles.instructionChip}>
            <MaterialIcons name="task" size={13} color={Colors.primary} />
            <Text style={styles.instructionChipText} numberOfLines={2}>{instruction}</Text>
          </FadeInView>
          <PhaseStatusCard
            phase={phase}
            currentEvent={currentEvent}
            allTranscript={allTranscript}
            elapsedTime={elapsedTime}
          />
        </>
      )}

      {/* Complete: result card */}
      {phase === 'complete' && finalResult && (
        <ResultCard result={finalResult} instruction={instruction} onReset={resetAgent} />
      )}

      {/* Error */}
      {phase === 'error' && (
        <FadeInView style={styles.errorWrap}>
          <MaterialIcons name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>AI Agent Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={resetAgent} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </FadeInView>
      )}
    </View>
  );
}

// ─── Contact Avatar ───────────────────────────────────────────────────────────
function ContactAvatar({ contact, size = 44 }: { contact: Contact; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: contact.avatarColor + '33',
      borderWidth: 1.5, borderColor: contact.avatarColor + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '700', color: contact.avatarColor }}>
        {getInitials(contact)}
      </Text>
    </View>
  );
}

// ─── Mic Button ──────────────────────────────────────────────────────────────
function MicButton({ isListening, onPress }: { isListening: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      const pulsate = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.93, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      const ripple = Animated.loop(Animated.parallel([
        Animated.timing(ring1, { toValue: 1.7, duration: 1400, useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]));
      ring1.setValue(1); ring1Opacity.setValue(0.5);
      pulsate.start(); ripple.start();
      return () => { pulsate.stop(); ripple.stop(); pulse.setValue(1); };
    }
  }, [isListening]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.micBtnOuter, pressed && { opacity: 0.9 }]}>
      <Animated.View style={[styles.micRipple, {
        transform: [{ scale: ring1 }], opacity: ring1Opacity,
        borderColor: isListening ? Colors.danger : Colors.primary,
      }]} />
      <Animated.View style={[
        styles.micBtn,
        { backgroundColor: isListening ? Colors.danger : Colors.primary },
        { transform: [{ scale: pulse }] },
      ]}>
        <MaterialIcons name={isListening ? 'mic' : 'mic-none'} size={38} color="#fff" />
      </Animated.View>
    </Pressable>
  );
}

// ─── Dial Pad Tab ─────────────────────────────────────────────────────────────
function DialPadTab({ onDial }: { onDial: (num: string) => void }) {
  const [digits, setDigits] = useState('');

  const handleKey = (digit: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(25);
    setDigits(prev => prev.length < 16 ? prev + digit : prev);
  };

  const matchedContacts = digits.length >= 3
    ? CONTACTS.filter(c => c.number.replace(/\D/g, '').includes(digits.replace(/\D/g, '')))
    : [];

  const formatDisplay = (d: string) => {
    const clean = d.replace(/\D/g, '');
    if (clean.length === 0) return '';
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
    if (clean.length <= 10) return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    return `+${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7, 11)}`;
  };

  return (
    <View style={styles.padTab}>
      <FadeInView style={styles.padDisplay}>
        <Text style={[styles.padDigits, digits.length === 0 && styles.padDigitsPlaceholder]} numberOfLines={1} adjustsFontSizeToFit>
          {digits.length > 0 ? formatDisplay(digits) : 'Enter number...'}
        </Text>
        {digits.length > 0 && (
          <TouchableOpacity onPress={() => setDigits(prev => prev.slice(0, -1))} onLongPress={() => setDigits('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <MaterialIcons name="backspace" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </FadeInView>

      {matchedContacts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.padMatchRow}>
          {matchedContacts.slice(0, 5).map(c => (
            <TouchableOpacity key={c.id} style={styles.padMatchChip} onPress={() => setDigits(c.number.replace(/\D/g, ''))} activeOpacity={0.8}>
              <View style={[styles.padMatchDot, { backgroundColor: c.avatarColor }]} />
              <Text style={styles.padMatchName} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.padGrid}>
        {PAD_KEYS.map((key, i) => (
          <FadeInView key={key.digit} delay={i * 30}>
            <TouchableOpacity style={styles.padKey} onPress={() => handleKey(key.digit)} activeOpacity={0.7}>
              <Text style={styles.padKeyDigit}>{key.digit}</Text>
              {key.sub ? <Text style={styles.padKeySub}>{key.sub}</Text> : null}
            </TouchableOpacity>
          </FadeInView>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.padCallBtn, !digits.trim() && styles.padCallBtnDisabled]}
        onPress={() => { if (digits.trim()) onDial(digits.trim()); }}
        disabled={!digits.trim()}
        activeOpacity={0.85}
      >
        <MaterialIcons name="phone" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Voice Tab ────────────────────────────────────────────────────────────────
function VoiceTab({ onDial, onContact }: { onDial: (num: string) => void; onContact: (c: Contact) => void }) {
  const voice = useVoiceCommand();
  const [manualInput, setManualInput] = useState('');
  const router = useRouter();

  const handleCommand = useCallback((cmd: ReturnType<typeof parseVoiceCommand>) => {
    if (cmd.action === 'ghost') { router.push('/ghost-mode'); return; }
    if (cmd.action === 'call' && cmd.target) {
      if (cmd.targetType === 'number') { onDial(cmd.target); }
      else {
        const results = searchContacts(cmd.target);
        if (results.length > 0) onContact(results[0]);
        else onDial(cmd.target);
      }
    }
  }, [onDial, onContact, router]);

  const handleMic = () => {
    if (voice.state === 'listening') voice.stopListening();
    else { voice.reset(); voice.startListening(); }
  };

  useEffect(() => {
    if (voice.parsedCommand && voice.state === 'done') handleCommand(voice.parsedCommand);
  }, [voice.parsedCommand, voice.state]);

  const isListening = voice.state === 'listening';
  const isManual = voice.state === 'manual' || !voice.isWebSupported;
  const displayText = voice.interimText || voice.finalText;

  return (
    <View style={styles.voiceTab}>
      <FadeInView style={styles.voiceHero}>
        <Text style={styles.voiceTitle}>
          {isListening ? 'Listening...' : isManual ? 'Type a command' : 'Tap to speak'}
        </Text>
        <Text style={styles.voiceSub}>
          {isListening
            ? '"Call Mom"   "Dial 415 555 0041"   "Ghost Mode"'
            : isManual
            ? 'Speech recognition is not available on this platform. Type your command below.'
            : 'Say a name, number, or command'}
        </Text>
      </FadeInView>

      <MicButton isListening={isListening} onPress={handleMic} />

      {displayText ? (
        <FadeInView style={styles.transcriptChipOuter}>
          <MaterialIcons name="graphic-eq" size={14} color={Colors.primary} />
          <Text style={styles.transcriptChipText} numberOfLines={2}>{displayText}</Text>
        </FadeInView>
      ) : null}

      {(isManual || voice.state === 'error') && (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder='Try "Call Mom" or "Dial 415 555 0041"'
            placeholderTextColor={Colors.textMuted}
            value={manualInput}
            onChangeText={setManualInput}
            onSubmitEditing={() => { voice.submitManualText(manualInput); setManualInput(''); }}
            returnKeyType="send"
            autoFocus={isManual}
          />
          <TouchableOpacity
            style={[styles.manualSend, !manualInput.trim() && { opacity: 0.4 }]}
            onPress={() => { voice.submitManualText(manualInput); setManualInput(''); }}
            disabled={!manualInput.trim()}
          >
            <MaterialIcons name="arrow-forward" size={20} color={Colors.bg} />
          </TouchableOpacity>
        </View>
      )}

      {voice.parsedCommand && voice.state === 'done' && (
        <FadeInView style={styles.cmdResult}>
          <MaterialIcons name="check-circle" size={16} color={Colors.safe} />
          <Text style={styles.cmdResultText}>
            {voice.parsedCommand.action === 'call' ? `Calling ${voice.parsedCommand.target}...` : 'Activating Ghost Mode...'}
          </Text>
        </FadeInView>
      )}

      <View style={styles.hintRow}>
        {['"Call Dr. Nguyen"', '"Dial 800..."', '"Ghost Mode"'].map(h => (
          <TouchableOpacity key={h} style={styles.hintChip} onPress={() => voice.submitManualText(h.replace(/['"]/g, ''))} activeOpacity={0.8}>
            <Text style={styles.hintText}>{h}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.favTitle}>Favorites</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.md }}>
        {getFavorites().map(c => (
          <TouchableOpacity key={c.id} style={styles.favCard} onPress={() => onContact(c)} activeOpacity={0.8}>
            <ContactAvatar contact={c} size={50} />
            <Text style={styles.favName}>{c.name}</Text>
            <Text style={styles.favNum}>{c.number.slice(-4)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────
function ContactsTab({ onContact }: { onContact: (c: Contact) => void }) {
  const [search, setSearch] = useState('');
  const results = searchContacts(search);

  const groups = results.reduce<Record<string, Contact[]>>((acc, c) => {
    const key = search ? 'Results' : c.name[0].toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const sections = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <View style={{ flex: 1 }}>
      <FadeInView style={styles.contactSearch}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.contactSearchInput}
          placeholder="Search contacts..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </FadeInView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {sections.map(([letter, contacts]) => (
          <View key={letter}>
            <Text style={styles.sectionLetter}>{letter}</Text>
            {contacts.map((c, i) => (
              <FadeInView key={c.id} delay={i * 40}>
                <TouchableOpacity style={styles.contactRow} onPress={() => onContact(c)} activeOpacity={0.8}>
                  <ContactAvatar contact={c} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactNum}>{c.number}</Text>
                    {c.org ? <Text style={styles.contactOrg}>{c.org}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.quickCallBtn} onPress={() => onContact(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="phone" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </FadeInView>
            ))}
          </View>
        ))}
        {results.length === 0 && (
          <View style={styles.emptyContacts}>
            <MaterialIcons name="person-search" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Confirm Call Modal ───────────────────────────────────────────────────────
function ConfirmCallModal({ contact, number, onConfirm, onCancel }: {
  contact?: Contact | null; number?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 130, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
        {contact ? (
          <>
            <ContactAvatar contact={contact} size={64} />
            <Text style={styles.modalName}>{contact.name}</Text>
            <Text style={styles.modalNum}>{contact.number}</Text>
            {contact.org && <Text style={styles.modalOrg}>{contact.org}</Text>}
          </>
        ) : (
          <>
            <View style={styles.unknownAvatar}><MaterialIcons name="person" size={32} color={Colors.textMuted} /></View>
            <Text style={styles.modalName}>{number}</Text>
            <Text style={styles.modalOrg}>Unknown Number</Text>
          </>
        )}
        <View style={styles.sentinelRow}>
          <MaterialIcons name="security" size={14} color={Colors.primary} />
          <Text style={styles.sentinelMsg}>SENTINEL™ will analyze this call in real-time</Text>
        </View>
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelCallBtn} onPress={onCancel} activeOpacity={0.8}>
            <MaterialIcons name="close" size={20} color={Colors.textSecondary} />
            <Text style={styles.cancelCallText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmCallBtn} onPress={onConfirm} activeOpacity={0.85}>
            <MaterialIcons name="phone" size={20} color="#fff" />
            <Text style={styles.confirmCallText}>Call</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DialerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('voice');
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [pendingNumber, setPendingNumber] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const tabIndicator = useRef(new Animated.Value(0)).current;
  const TABS: Tab[] = ['voice', 'pad', 'agent', 'contacts'];

  useEffect(() => {
    const idx = TABS.indexOf(tab);
    Animated.spring(tabIndicator, { toValue: idx, tension: 180, friction: 18, useNativeDriver: true }).start();
  }, [tab]);

  const handleDial = useCallback((num: string) => {
    const found = findContactByNumber(num);
    if (found) { setPendingContact(found); setPendingNumber(null); }
    else { setPendingNumber(num); setPendingContact(null); }
    setShowConfirm(true);
  }, []);

  const handleContact = useCallback((c: Contact) => {
    setPendingContact(c); setPendingNumber(null); setShowConfirm(true);
  }, []);

  const confirmCall = useCallback(() => {
    setShowConfirm(false);
    const params: Record<string, string> = {};
    if (pendingContact) {
      params.contactId = pendingContact.id;
      params.callerName = pendingContact.name;
      params.callerNumber = pendingContact.number;
      params.direction = 'outbound';
    } else if (pendingNumber) {
      params.callerNumber = pendingNumber;
      params.callerName = 'Unknown';
      params.direction = 'outbound';
    }
    router.push({ pathname: '/live-call', params });
    setPendingContact(null); setPendingNumber(null);
  }, [pendingContact, pendingNumber, router]);

  const TAB_DEFS: { key: Tab; icon: string; label: string }[] = [
    { key: 'voice', icon: 'mic', label: 'Voice' },
    { key: 'pad', icon: 'dialpad', label: 'Keypad' },
    { key: 'agent', icon: 'support-agent', label: 'AI Agent' },
    { key: 'contacts', icon: 'people', label: 'Contacts' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <FadeInView style={styles.header}>
        <Text style={styles.headerTitle}>Dialer</Text>
        <View style={styles.sentinelPill}>
          <PulseDot color={Colors.primary} size={7} />
          <Text style={styles.sentinelPillText}>SENTINEL™ ON</Text>
        </View>
      </FadeInView>

      {/* Tab bar with animated indicator */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          {TAB_DEFS.map((t, idx) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={t.icon as any} size={18} color={tab === t.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
              {t.key === 'agent' && tab !== 'agent' && (
                <View style={styles.agentPip}>
                  <Text style={styles.agentPipText}>AI</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'pad' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
            <DialPadTab onDial={handleDial} />
          </ScrollView>
        )}
        {tab === 'voice' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
            <VoiceTab onDial={handleDial} onContact={handleContact} />
          </ScrollView>
        )}
        {tab === 'agent' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.md }}>
            <AIAgentTab />
          </ScrollView>
        )}
        {tab === 'contacts' && (
          <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
            <ContactsTab onContact={handleContact} />
          </View>
        )}
      </View>

      {showConfirm && (
        <ConfirmCallModal
          contact={pendingContact}
          number={pendingNumber ?? undefined}
          onConfirm={confirmCall}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  sentinelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  sentinelPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 0.8 },

  tabBarWrap: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: 4, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 8, borderRadius: Radius.md, position: 'relative',
  },
  tabBtnActive: { backgroundColor: Colors.primaryGlow },
  tabLabel: { fontSize: 10, fontWeight: FontWeight.medium, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  agentPip: {
    position: 'absolute', top: 4, right: 8,
    backgroundColor: Colors.primary, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  agentPipText: { fontSize: 7, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: 0.3 },

  // ── AI Agent Tab ──
  agentTab: { gap: Spacing.md, paddingTop: Spacing.md },
  agentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  agentIconWrap: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.md,
  },
  agentTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  agentSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  agentOnBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.safe + '44',
  },
  agentOnText: { fontSize: 10, fontWeight: FontWeight.extrabold, color: Colors.safe, letterSpacing: 0.8 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  cancelBtnText: { fontSize: 10, fontWeight: FontWeight.extrabold, color: Colors.danger },

  // Phase Steps
  phaseStepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  phaseStep: { alignItems: 'center', gap: 5 },
  phaseStepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseStepDot: { width: 6, height: 6, borderRadius: 3 },
  phaseStepLabel: { fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.4 },
  phaseConnector: { height: 2, flex: 1, marginHorizontal: 3, marginBottom: 12, borderRadius: 1 },

  // Phase Card
  phaseCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderStrong, overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1,
  },
  phaseHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  phaseIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  phaseLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  phaseMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, maxWidth: 230 },
  phaseTimerWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phaseTimer: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.bold },

  holdBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warningGlow, paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.warning + '33',
  },
  holdBadgeText: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.semibold },

  liveTranscriptWrap: { padding: Spacing.sm },
  liveTranscriptHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 6, paddingHorizontal: 4,
  },
  liveTranscriptLabel: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.textMuted, letterSpacing: 1 },
  liveTranscriptScroll: { maxHeight: 200 },

  // Transcript lines
  transcriptLine: {
    padding: Spacing.sm, borderLeftWidth: 2.5, borderLeftColor: Colors.border,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.xs, gap: 3,
  },
  transcriptAI: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryGlow + '22' },
  transcriptSystem: { borderLeftColor: Colors.textMuted, opacity: 0.75 },
  transcriptSpeaker: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },

  // Instruction chip shown during run
  instructionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  instructionChipText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },

  // Idle form
  agentInstructLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 6 },
  agentInput: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong,
    textAlignVertical: 'top', minHeight: 90, includeFontPadding: false, marginBottom: Spacing.sm,
  },
  executeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, ...Shadow.primary, marginBottom: Spacing.md,
  },
  executeBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },
  executeBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  quickTaskSectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  quickTaskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickTask: {
    width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickTaskLabel2: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text },

  // Result Card
  resultCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.borderStrong, overflow: 'hidden', gap: 0,
  },
  outcomeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  outcomeLabelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  outcomeDuration: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  confirmBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  confirmBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold },
  resultSummaryWrap: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultSummaryText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 22 },
  resultDetailsWrap: { padding: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted, width: 90 },
  detailValue: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold, textAlign: 'right' },
  actionItemsWrap: { padding: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionItemsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  actionItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  actionItemNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0, marginTop: 1 },
  actionItemNumText: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primary },
  actionItemText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  fullTranscriptWrap: { padding: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fullTranscriptTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  fullTranscriptScroll: { maxHeight: 220 },
  newTaskBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: Spacing.md, borderRadius: 0,
    backgroundColor: Colors.primaryGlow,
  },
  newTaskBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  // Error
  errorWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  errorTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.danger },
  errorText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border,
  },
  retryBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  // ── Dial Pad ──
  padTab: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, alignItems: 'center', gap: Spacing.md },
  padDisplay: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, minHeight: 68,
  },
  padDigits: { flex: 1, fontSize: 32, fontWeight: FontWeight.extrabold, color: Colors.text, letterSpacing: 2 },
  padDigitsPlaceholder: { fontSize: 18, color: Colors.textMuted, fontWeight: FontWeight.medium, letterSpacing: 0 },
  padMatchRow: { gap: Spacing.sm, paddingHorizontal: 2 },
  padMatchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, maxWidth: 140,
  },
  padMatchDot: { width: 8, height: 8, borderRadius: 4 },
  padMatchName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text },
  padGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: 0 },
  padKey: {
    width: '33.33%', height: 72, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, gap: 1,
  },
  padKeyDigit: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.text, lineHeight: 34 },
  padKeySub: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 2, lineHeight: 13 },
  padCallBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.safe,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  padCallBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },

  // ── Voice Tab ──
  voiceTab: { paddingHorizontal: Spacing.md, gap: Spacing.lg, paddingTop: Spacing.md },
  voiceHero: { alignItems: 'center', gap: 4 },
  voiceTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  voiceSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  micBtnOuter: { alignSelf: 'center', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  micRipple: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2 },
  micBtn: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', ...Shadow.primary },
  transcriptChipOuter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  transcriptChipText: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontStyle: 'italic' },
  manualRow: { flexDirection: 'row', gap: Spacing.sm },
  manualInput: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.md, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong,
    includeFontPadding: false,
  },
  manualSend: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  cmdResult: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.safe + '55',
  },
  cmdResultText: { flex: 1, fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.semibold },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  hintChip: { backgroundColor: Colors.bgCard, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  hintText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  favTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, paddingLeft: 4 },
  favCard: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  favName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center', maxWidth: 64 },
  favNum: { fontSize: 10, color: Colors.textMuted },

  // ── Contacts ──
  contactSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  contactSearchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false },
  sectionLetter: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textMuted, paddingHorizontal: 4, paddingVertical: 6, letterSpacing: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  contactName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  contactNum: { fontSize: FontSize.xs, color: Colors.textSecondary },
  contactOrg: { fontSize: FontSize.xs, color: Colors.textMuted },
  quickCallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyContacts: { alignItems: 'center', paddingTop: 48, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },

  // ── Confirm Modal ──
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,14,30,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { width: '82%', backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.borderStrong, ...Shadow.primary },
  modalName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center' },
  modalNum: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalOrg: { fontSize: FontSize.xs, color: Colors.textMuted },
  unknownAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bgSurface, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  sentinelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.borderStrong, marginTop: 4 },
  sentinelMsg: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, width: '100%' },
  cancelCallBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.bgSurface, borderRadius: Radius.full, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  cancelCallText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  confirmCallBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.safe, borderRadius: Radius.full, paddingVertical: 14 },
  confirmCallText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
});

/**
 * CALLSHIELD Ghost Mode Screen
 *
 * The AI persona answers the call automatically while the user listens.
 * Caller audio is transcribed in real-time via Web Speech API (continuous mode)
 * on web, and via AcousticSentinel on native — NO manual typing required.
 *
 * Every transcribed caller utterance is:
 *  1. Fed to SENTINEL™ for real-time threat analysis
 *  2. Sent to OnSpace AI (Ghost AI edge function) for contextual response
 *  3. Spoken aloud via expo-speech TTS
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGhostMode } from '../hooks/useGhostMode';
import { useLiveTranscription } from '../hooks/useLiveTranscription';
import { SentinelEngine } from '../services/sentinelEngine';

function formatDur(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Animated Waveform Bar ─────────────────────────────────────────────────
function WaveBar({ amplitude, color }: { amplitude: number; color: string }) {
  const anim = useRef(new Animated.Value(amplitude)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: amplitude, duration: 80, useNativeDriver: false }).start();
  }, [amplitude]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 28] });
  return <Animated.View style={{ width: 3, height, borderRadius: 2, backgroundColor: color, marginHorizontal: 1.5 }} />;
}

// ─── Pulse Ring ────────────────────────────────────────────────────────────
function PulseRing({ color, isActive }: { color: string; isActive: boolean }) {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isActive) return;
    const anim1 = Animated.loop(Animated.parallel([
      Animated.timing(scale1, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
      Animated.timing(opacity1, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    const anim2 = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(scale2, { toValue: 1.9, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity2, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    ]));
    anim1.start(); anim2.start();
    return () => {
      anim1.stop(); anim2.stop();
      scale1.setValue(1); scale2.setValue(1);
      opacity1.setValue(0.6); opacity2.setValue(0.4);
    };
  }, [isActive, color]);

  return (
    <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale1 }], opacity: opacity1 }]} />
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale2 }], opacity: opacity2 }]} />
      <View style={[styles.avatarRing, { borderColor: color }]}>
        <View style={[styles.avatarCore, { backgroundColor: color + '22' }]}>
          <MaterialIcons name="hearing" size={36} color={color} />
        </View>
      </View>
    </View>
  );
}

// ─── Intelligence Card ─────────────────────────────────────────────────────
function IntelCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={[styles.intelCard, { borderColor: color + '44' }]}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={styles.intelLabel}>{label}</Text>
      <Text style={[styles.intelValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Listening Status Bar ─────────────────────────────────────────────────
function ListeningBar({
  isListening,
  wordCount,
  interimText,
  amplitudeHistory,
  threatColor,
  listenAnim,
}: {
  isListening: boolean;
  wordCount: number;
  interimText: string;
  amplitudeHistory: number[];
  threatColor: string;
  listenAnim: Animated.Value;
}) {
  return (
    <View style={[styles.listenBar, {
      backgroundColor: isListening ? Colors.primaryGlow : Colors.bgCard,
      borderColor: isListening ? Colors.primary + '44' : Colors.border,
    }]}>
      <Animated.View style={[styles.listenDot, {
        backgroundColor: isListening ? Colors.primary : Colors.textMuted,
        opacity: listenAnim,
      }]} />
      <MaterialIcons name="hearing" size={14} color={isListening ? Colors.primary : Colors.textMuted} />
      <View style={styles.miniWaveWrap}>
        {amplitudeHistory.slice(-12).map((amp, i) => (
          <WaveBar key={i} amplitude={amp} color={threatColor} />
        ))}
      </View>
      <Text style={[styles.listenLabel, { color: isListening ? Colors.primary : Colors.textMuted }]} numberOfLines={1}>
        {interimText
          ? interimText
          : isListening
          ? 'Hearing the caller on this phone'
          : 'Connecting to the caller...'}
      </Text>
      <Text style={styles.listenCount}>{wordCount}w</Text>
    </View>
  );
}

export default function GhostModeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { personaName } = useApp();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ callerName?: string; callerNumber?: string }>();
  const ghost = useGhostMode(personaName, 'the account holder', settings.deepfakeDetect);
  const callerLabel = params.callerName || params.callerNumber || 'Incoming caller';
  const speakingPrev = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const intelScrollRef = useRef<ScrollView>(null);
  const threatAnim = useRef(new Animated.Value(0)).current;
  const listenDotAnim = useRef(new Animated.Value(1)).current;

  // Amplitude history for waveform
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(Array(16).fill(0.05));

  // Tracks which caller segments have already been submitted to Ghost AI
  const submittedSegmentIds = useRef<Set<string>>(new Set());
  // Prevents overlapping AI responses
  const isHandlingRef = useRef(false);

  const threatColor = SentinelEngine.getThreatColor(ghost.threatLevel);

  // ── Auto-transcription pipeline ──────────────────────────────────────────
  const handleCallerSegment = useCallback(async (text: string, speaker: 'A' | 'B') => {
    // Only process "A" turns as caller (speaker B = AI's mic pickup of its own TTS, skip it)
    // When on web, Speaker A is the predominant voice captured first in each turn
    if (!text.trim() || isHandlingRef.current) return;
    isHandlingRef.current = true;
    await ghost.submitCallerText(text.trim());
    isHandlingRef.current = false;
  }, [ghost.submitCallerText]);

  const transcription = useLiveTranscription(handleCallerSegment);

  // ── Mount: greet, then listen to the caller on this phone ────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      await ghost.initialize();
      if (active) transcription.start();
    })();

    const listenPulse = Animated.loop(Animated.sequence([
      Animated.timing(listenDotAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(listenDotAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    listenPulse.start();

    return () => {
      active = false;
      transcription.stop();
      listenPulse.stop();
    };
  }, []);

  // Do not feed Ghost's own voice back into the listener
  useEffect(() => {
    if (ghost.isAISpeaking && !speakingPrev.current) {
      transcription.stop();
    }
    if (!ghost.isAISpeaking && speakingPrev.current) {
      transcription.start();
    }
    speakingPrev.current = ghost.isAISpeaking;
  }, [ghost.isAISpeaking]);

  useEffect(() => {
    Animated.timing(threatAnim, { toValue: ghost.threatScore, duration: 600, useNativeDriver: false }).start();
  }, [ghost.threatScore]);

  useEffect(() => {
    if (ghost.messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [ghost.messages.length]);

  // Sync amplitude from acoustic monitoring or native STT into waveform
  useEffect(() => {
    const native = transcription as typeof transcription & { amplitudeHistory?: number[] };
    if (native.amplitudeHistory && native.amplitudeHistory.length > 0) {
      setAmplitudeHistory(native.amplitudeHistory.slice(-16));
      return;
    }
    setAmplitudeHistory(prev => [...prev.slice(-15), ghost.amplitude || 0.05]);
  }, [ghost.amplitude, (transcription as any).amplitudeHistory]);

  const meterWidth = threatAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const handleEnd = async () => {
    transcription.stop();
    await ghost.endSession();
    router.back();
  };

  const handleJoin = async () => {
    transcription.stop();
    await ghost.endSession();
    router.replace({
      pathname: '/live-call',
      params: {
        callerName: params.callerName ?? callerLabel,
        callerNumber: params.callerNumber ?? 'This phone',
        direction: 'inbound',
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.ghostBadge, ghost.isExposeMode && styles.ghostBadgeExpose]}>
            <View style={[styles.ghostDot, { backgroundColor: ghost.isExposeMode ? Colors.warning : Colors.primary }]} />
            <Text style={[styles.ghostBadgeText, { color: ghost.isExposeMode ? Colors.warning : Colors.primary }]}>
              {ghost.isExposeMode ? 'EXPOSE MODE' : 'GHOST ACTIVE'}
            </Text>
          </View>
        </View>
        <View style={styles.durationPill}>
          <View style={[styles.recDot, { backgroundColor: Colors.danger }]} />
          <Text style={styles.durationText}>{formatDur(ghost.duration)}</Text>
        </View>
      </View>

      {/* AI Avatar */}
      <View style={styles.avatarSection}>
        <PulseRing color={ghost.isAISpeaking ? Colors.primary : threatColor} isActive={ghost.isAISpeaking} />
        <Text style={styles.personaName}>{personaName}</Text>
        <Text style={[styles.personaStatus, { color: ghost.isAISpeaking ? Colors.primary : Colors.textSecondary }]}>
          {ghost.isAISpeaking
            ? `Speaking to ${callerLabel}`
            : ghost.isProcessing
            ? 'Thinking...'
            : `Answering ${callerLabel} for you`}
        </Text>
      </View>

      {/* SENTINEL Score */}
      <View style={[styles.scoreRow, { borderColor: threatColor + '55' }]}>
        <View style={styles.scoreLeft}>
          <View style={[styles.levelDot, { backgroundColor: threatColor }]} />
          <Text style={[styles.levelLabel, { color: threatColor }]}>
            {SentinelEngine.getThreatLabel(ghost.threatLevel)}
          </Text>
          {ghost.trajectoryLabel === 'rising' && (
            <View style={styles.risingBadge}>
              <MaterialIcons name="trending-up" size={10} color={Colors.danger} />
              <Text style={styles.risingText}>RISING</Text>
            </View>
          )}
        </View>
        <Text style={[styles.scoreNum, { color: threatColor }]}>{ghost.threatScore}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <Animated.View style={[styles.meterFill, { width: meterWidth, backgroundColor: threatColor }]} />
      </View>

      {/* Fact Check */}
      {ghost.factChecks.length > 0 && (
        <View style={styles.factCheck}>
          <MaterialIcons name="fact-check" size={14} color={Colors.warning} />
          <Text style={styles.factCheckText} numberOfLines={2}>{ghost.factChecks[0]}</Text>
        </View>
      )}

      {/* Intelligence Dashboard */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={intelScrollRef}
        style={styles.intelScroll}
        contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.md }}
      >
        <IntelCard label="Time Wasted" value={`${ghost.intelligence.timeWasted}s`} icon="timer" color={Colors.primary} />
        <IntelCard label="Caller ID" value={ghost.intelligence.callerClaimedIdentity || 'Unknown'} icon="badge" color={Colors.textSecondary} />
        <IntelCard label="Payment" value={ghost.intelligence.paymentMentioned ? 'REQUESTED' : 'None'} icon="payments" color={ghost.intelligence.paymentMentioned ? Colors.danger : Colors.safe} />
        <IntelCard label="ID Consistency" value={`${ghost.intelligence.identityConsistency}%`} icon="verified-user" color={ghost.intelligence.identityConsistency < 70 ? Colors.danger : Colors.safe} />
        {ghost.deepfakeConfidence > 20 && (
          <IntelCard label="Deepfake" value={`${ghost.deepfakeConfidence}%`} icon="record-voice-over" color={Colors.warning} />
        )}
        <IntelCard label="Words heard" value={transcription.wordCount} icon="hearing" color={Colors.primary} />
      </ScrollView>

      {/* Auto-Listening Status Bar */}
      <ListeningBar
        isListening={transcription.isListening}
        wordCount={transcription.wordCount}
        interimText={transcription.interimText}
        amplitudeHistory={amplitudeHistory}
        threatColor={threatColor}
        listenAnim={listenDotAnim}
      />

      {/* Conversation Transcript */}
      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={{ padding: Spacing.sm + 4, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {ghost.messages.length === 0 && (
          <View style={styles.emptyTranscript}>
            <MaterialIcons name="hearing" size={28} color={Colors.primary} />
            <Text style={styles.emptyText}>{personaName} picked up for you</Text>
            <Text style={styles.emptySubText}>
              {personaName} is on the line with {callerLabel}.{'\n'}
              You can listen. Join anytime if you want to take over.
            </Text>
          </View>
        )}
        {ghost.messages.map(msg => {
          const isAI = msg.role === 'ai';
          return (
            <View key={msg.id} style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleCaller]}>
              <Text style={[styles.bubbleRole, { color: isAI ? Colors.primary : Colors.warning }]}>
                {isAI ? `${personaName} (AI AGENT)` : 'CALLER'}
              </Text>
              <Text style={[styles.bubbleText, isAI && { color: Colors.text }]}>{msg.text}</Text>
              {isAI && msg.state && (
                <Text style={styles.stateTag}>{msg.state.replace(/_/g, ' ').toUpperCase()}</Text>
              )}
            </View>
          );
        })}

        {/* Show latest interim caller transcript inline */}
        {transcription.interimText && !ghost.isProcessing && (
          <View style={[styles.bubble, styles.bubbleCaller, { opacity: 0.65 }]}>
            <Text style={[styles.bubbleRole, { color: Colors.warning }]}>CALLER (LIVE)</Text>
            <Text style={[styles.bubbleText, { fontStyle: 'italic' }]}>{transcription.interimText}</Text>
          </View>
        )}

        {ghost.isProcessing && (
          <View style={[styles.bubble, styles.bubbleAI]}>
            <Text style={styles.typingDots}>● ● ●</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} activeOpacity={0.85}>
          <MaterialIcons name="phone" size={16} color={Colors.textInverse} />
          <Text style={styles.joinText}>Join Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exposeBtn, ghost.isExposeMode && styles.exposeBtnActive]}
          onPress={ghost.enableExposeMode}
          disabled={ghost.isExposeMode}
          activeOpacity={0.85}
        >
          <MaterialIcons name="bug-report" size={16} color={ghost.isExposeMode ? Colors.textInverse : Colors.warning} />
          <Text style={[styles.exposeText, ghost.isExposeMode && { color: Colors.textInverse }]}>
            {ghost.isExposeMode ? 'Exposing...' : 'Expose Mode'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.85}>
          <MaterialIcons name="call-end" size={16} color="#fff" />
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  ghostBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  ghostBadgeExpose: { backgroundColor: Colors.warningGlow, borderColor: Colors.warning + '55' },
  ghostDot: { width: 8, height: 8, borderRadius: 4 },
  ghostBadgeText: { fontSize: 11, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  avatarSection: { alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.xs },
  pulseRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  avatarCore: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  personaName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  personaStatus: { fontSize: FontSize.sm },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, marginBottom: 4,
  },
  scoreLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  risingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.danger + '55',
  },
  risingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  scoreNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  meterTrack: {
    height: 4, backgroundColor: Colors.bgSurface, marginHorizontal: Spacing.md,
    borderRadius: 2, overflow: 'hidden', marginBottom: Spacing.sm,
  },
  meterFill: { height: '100%', borderRadius: 2 },

  factCheck: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    marginHorizontal: Spacing.md, backgroundColor: Colors.warningGlow,
    borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.warning + '55',
    marginBottom: Spacing.sm,
  },
  factCheckText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 17 },

  intelScroll: { maxHeight: 76, marginBottom: Spacing.sm },
  intelCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm + 2,
    alignItems: 'center', gap: 2, borderWidth: 1, minWidth: 90,
  },
  intelLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.bold, letterSpacing: 0.5, textAlign: 'center' },
  intelValue: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, textAlign: 'center' },

  // Listening bar
  listenBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, marginBottom: Spacing.sm,
  },
  listenDot: { width: 7, height: 7, borderRadius: 3.5 },
  listenLabel: { flex: 1, fontSize: 11, fontWeight: FontWeight.semibold, lineHeight: 14 },
  listenCount: { fontSize: 9, color: Colors.textMuted },
  miniWaveWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 28, gap: 0 },

  transcript: {
    flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  emptyTranscript: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.sm, paddingHorizontal: Spacing.md },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySubText: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm + 2, maxWidth: '88%', gap: 3 },
  bubbleAI: {
    alignSelf: 'flex-end', backgroundColor: Colors.primaryGlow,
    borderWidth: 1, borderColor: Colors.borderStrong, borderBottomRightRadius: 4,
  },
  bubbleCaller: {
    alignSelf: 'flex-start', backgroundColor: Colors.bgSurface,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderBottomLeftRadius: 4,
  },
  bubbleRole: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  bubbleText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  stateTag: { fontSize: 8, color: Colors.textMuted, letterSpacing: 0.5 },
  typingDots: { fontSize: FontSize.md, color: Colors.primary, letterSpacing: 5 },

  actions: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  joinBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.safe, borderRadius: Radius.full, paddingVertical: 14,
  },
  joinText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  exposeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.warning + '55',
  },
  exposeBtnActive: { backgroundColor: Colors.warning },
  exposeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.warning },
  endBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.danger, borderRadius: Radius.full, paddingVertical: 14,
    ...Shadow.danger,
  },
  endText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
});

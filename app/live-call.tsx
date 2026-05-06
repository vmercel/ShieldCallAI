import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { SentinelEngine } from '../services/sentinelEngine';
import { AcousticSentinel, AcousticSnapshot } from '../services/acousticSentinel';
import { ThreatLevel } from '../constants/mockData';
import { findContactByNumber, findContactByName, getInitials, Contact } from '../constants/contacts';

function formatDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Waveform ────────────────────────────────────────────────────────────────
function WaveformBar({ amplitude, color }: { amplitude: number; color: string }) {
  const anim = useRef(new Animated.Value(amplitude)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: amplitude, duration: 80, useNativeDriver: false }).start();
  }, [amplitude]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 36] });
  return <Animated.View style={{ width: 3, height, backgroundColor: color, borderRadius: 2, marginHorizontal: 1.5 }} />;
}

// ─── Contact Avatar ───────────────────────────────────────────────────────────
function CallerAvatar({ contact, size = 64, color }: { contact?: Contact | null; size?: number; color: string }) {
  if (contact) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: contact.avatarColor + '22',
        borderWidth: 2.5, borderColor: color,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.32, fontWeight: '800', color: contact.avatarColor }}>
          {getInitials(contact)}
        </Text>
      </View>
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22', borderWidth: 2.5, borderColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <MaterialIcons name="person" size={size * 0.45} color={color} />
    </View>
  );
}

export default function LiveCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    callerName?: string;
    callerNumber?: string;
    contactId?: string;
    direction?: string;
  }>();

  const direction = params.direction ?? 'inbound';
  const callerNumber = params.callerNumber ?? '+1 (202) 555-0147';
  const contact = params.contactId
    ? findContactByNumber(callerNumber)
    : callerNumber ? findContactByNumber(callerNumber) : null;
  const callerName = contact?.name ?? params.callerName ?? 'Unknown Caller';

  // ── Engines ────────────────────────────────────────────────────────────────
  const sentinelRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());

  // ── State ──────────────────────────────────────────────────────────────────
  const [duration, setDuration] = useState(0);
  const [threatScore, setThreatScore] = useState(0);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('safe');
  const [flags, setFlags] = useState<string[]>([]);
  const [factChecks, setFactChecks] = useState<string[]>([]);
  const [trajectoryLabel, setTrajectoryLabel] = useState<'rising' | 'falling' | 'stable'>('stable');
  const [scamType, setScamType] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ role: string; text: string; analyzed?: boolean }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(Array(24).fill(0.05));
  const [acousticStress, setAcousticStress] = useState(0);
  const [acousticFlags, setAcousticFlags] = useState<string[]>([]);
  const [deepfakeConfidence, setDeepfakeConfidence] = useState(0);
  const [hasMic, setHasMic] = useState(false);
  const [showFactCheck, setShowFactCheck] = useState(false);
  const [activeFactCheck, setActiveFactCheck] = useState('');
  const [confidenceLabel, setConfidenceLabel] = useState('Insufficient Data');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const threatAnim = useRef(new Animated.Value(0)).current;
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const factCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sentinelRef.current.reset();
    durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]).start(pulsate);
    };
    pulsate();

    (async () => {
      const granted = await acousticRef.current.requestPermission();
      setHasMic(granted);
      if (granted) {
        await acousticRef.current.startMonitoring((snap: AcousticSnapshot) => {
          setAmplitudeHistory(prev => [...prev.slice(-23), snap.normalizedAmplitude]);
          setAcousticStress(snap.acousticStressScore);
          setAcousticFlags(snap.flags);
          if (snap.flags.length > 0) {
            setDeepfakeConfidence(acousticRef.current.getSession().deepfakeConfidence);
          }
        });
      }
    })();

    return () => {
      durationTimerRef.current && clearInterval(durationTimerRef.current);
      factCheckTimer.current && clearTimeout(factCheckTimer.current);
      acousticRef.current.stopMonitoring();
    };
  }, []);

  useEffect(() => {
    Animated.timing(threatAnim, { toValue: threatScore, duration: 600, useNativeDriver: false }).start();
  }, [threatScore]);

  const threatColor = SentinelEngine.getThreatColor(threatLevel);
  const meterWidth = threatAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const compositeScore = Math.min(100, Math.round(threatScore * 0.72 + acousticStress * 0.28));
  const allFlags = [...new Set([...flags, ...acousticFlags])];

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setIsAnalyzing(true);
    setTranscript(prev => [...prev, { role: direction === 'outbound' ? 'them' : 'caller', text }]);
    setTimeout(() => transcriptRef.current?.scrollToEnd({ animated: true }), 100);

    const window = sentinelRef.current.ingestSegment(text);
    const analysis = sentinelRef.current.analyzeConversation();

    setThreatScore(window.score);
    setThreatLevel(window.level);
    setFlags(window.flags);
    setFactChecks(window.factChecks);
    setTrajectoryLabel(window.trajectoryLabel);
    setScamType(analysis.scamType);
    setConfidenceLabel(analysis.confidenceLabel);
    setIsAnalyzing(false);

    if (window.factChecks.length > 0) {
      setActiveFactCheck(window.factChecks[0]);
      setShowFactCheck(true);
      factCheckTimer.current && clearTimeout(factCheckTimer.current);
      factCheckTimer.current = setTimeout(() => setShowFactCheck(false), 8000);
    }
    setTranscript(prev =>
      prev.map((m, i) => i === prev.length - 1 ? { ...m, analyzed: true } : m)
    );
  }, [inputText, direction]);

  const handleEnd = async () => {
    await acousticRef.current.stopMonitoring();
    router.back();
  };

  const isOutbound = direction === 'outbound';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.sentinelBadge}>
              <MaterialIcons name="security" size={11} color={Colors.primary} />
              <Text style={styles.sentinelLabel}>SENTINEL™ ACTIVE</Text>
            </View>
            <View style={[styles.directionBadge, isOutbound ? styles.outboundBadge : styles.inboundBadge]}>
              <MaterialIcons
                name={isOutbound ? 'call-made' : 'call-received'}
                size={10}
                color={isOutbound ? Colors.primary : Colors.safe}
              />
              <Text style={[styles.directionText, { color: isOutbound ? Colors.primary : Colors.safe }]}>
                {isOutbound ? 'OUTBOUND' : 'INBOUND'}
              </Text>
            </View>
          </View>
          <View style={styles.durationPill}>
            <View style={styles.recDot} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* Caller */}
        <View style={styles.callerSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <CallerAvatar contact={contact} color={threatColor} size={68} />
          </Animated.View>
          <View style={styles.callerInfo}>
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callerNumber}>{callerNumber}</Text>
            {contact?.org && <Text style={styles.callerOrg}>{contact.org}</Text>}
          </View>

          {/* Waveform */}
          <View style={styles.waveformRow}>
            {amplitudeHistory.map((amp, i) => (
              <WaveformBar key={i} amplitude={hasMic ? amp : (0.04 + Math.random() * 0.04)} color={threatColor} />
            ))}
          </View>
        </View>

        {/* SENTINEL Panel */}
        <View style={[styles.threatPanel, { borderColor: threatColor + '55' }]}>
          <View style={styles.threatRow}>
            <View>
              <View style={styles.levelRow}>
                <View style={[styles.levelDot, { backgroundColor: threatColor }]} />
                <Text style={[styles.levelLabel, { color: threatColor }]}>{SentinelEngine.getThreatLabel(threatLevel)}</Text>
                {trajectoryLabel === 'rising' && (
                  <View style={styles.risingBadge}>
                    <MaterialIcons name="trending-up" size={10} color={Colors.danger} />
                    <Text style={styles.risingText}>RISING</Text>
                  </View>
                )}
              </View>
              <Text style={styles.confidenceText}>{confidenceLabel}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreNum, { color: threatColor }]}>{compositeScore}</Text>
              <Text style={styles.scoreUnit}>%</Text>
            </View>
          </View>

          <View style={styles.meterTrack}>
            <Animated.View style={[styles.meterFill, { width: meterWidth, backgroundColor: threatColor }]} />
          </View>

          {/* Dual meters */}
          <View style={styles.dualMeters}>
            <View style={styles.dualMeter}>
              <MaterialIcons name="psychology" size={11} color={Colors.primary} />
              <Text style={styles.dualLabel}>NLP</Text>
              <View style={styles.miniTrack}>
                <View style={[styles.miniFill, { width: `${threatScore}%`, backgroundColor: threatColor }]} />
              </View>
              <Text style={[styles.miniScore, { color: threatColor }]}>{threatScore}</Text>
            </View>
            <View style={styles.dualMeter}>
              <MaterialIcons name="graphic-eq" size={11} color={Colors.warning} />
              <Text style={styles.dualLabel}>ACOUSTIC</Text>
              <View style={styles.miniTrack}>
                <View style={[styles.miniFill, { width: `${acousticStress}%`, backgroundColor: Colors.warning }]} />
              </View>
              <Text style={[styles.miniScore, { color: Colors.warning }]}>{acousticStress}</Text>
            </View>
          </View>

          {allFlags.length > 0 && (
            <View style={styles.flagsRow}>
              {allFlags.map(f => (
                <View key={f} style={[styles.flagChip, { backgroundColor: threatColor + '18', borderColor: threatColor + '44' }]}>
                  <MaterialIcons name="warning" size={10} color={threatColor} />
                  <Text style={[styles.flagText, { color: threatColor }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {scamType && (
            <View style={styles.scamBadge}>
              <MaterialIcons name="local-police" size={12} color={Colors.danger} />
              <Text style={styles.scamText}>Classified: {scamType}</Text>
            </View>
          )}

          {deepfakeConfidence > 25 && (
            <View style={styles.deepfakeBadge}>
              <MaterialIcons name="record-voice-over" size={12} color={Colors.warning} />
              <Text style={styles.deepfakeText}>Synthetic voice: {deepfakeConfidence}% confidence</Text>
            </View>
          )}
        </View>

        {/* Fact Check Banner */}
        {showFactCheck && (
          <TouchableOpacity style={styles.factBanner} onPress={() => setShowFactCheck(false)} activeOpacity={0.9}>
            <MaterialIcons name="fact-check" size={15} color={Colors.warning} />
            <Text style={styles.factText} numberOfLines={3}>{activeFactCheck}</Text>
            <MaterialIcons name="close" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Transcript */}
        <ScrollView
          ref={transcriptRef}
          style={styles.transcript}
          contentContainerStyle={{ padding: Spacing.sm, gap: Spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {transcript.length === 0 && (
            <View style={styles.emptyTranscript}>
              <MaterialIcons name="keyboard" size={22} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {isOutbound
                  ? 'Type what the other party says for SENTINEL™ analysis'
                  : 'Type what the caller says for SENTINEL™ analysis'}
              </Text>
            </View>
          )}
          {transcript.map((line, i) => (
            <View key={i} style={styles.transcriptLine}>
              <Text style={[styles.transcriptRole, {
                color: line.role === 'caller' || line.role === 'them' ? Colors.warning : Colors.primary,
              }]}>
                {line.role === 'caller' ? 'CALLER' : line.role === 'them' ? 'THEM' : 'YOU'}
              </Text>
              <Text style={styles.transcriptText}>{line.text}</Text>
              {line.analyzed && (
                <View style={styles.analyzedTag}>
                  <MaterialIcons name="check-circle" size={10} color={Colors.safe} />
                  <Text style={styles.analyzedText}>Analyzed by SENTINEL™</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isOutbound ? "Type what they say..." : "Type what the caller says..."}
            placeholderTextColor={Colors.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleAnalyze}
          />
          <TouchableOpacity
            style={[styles.analyzeBtn, (!inputText.trim() || isAnalyzing) && styles.analyzeBtnOff]}
            onPress={handleAnalyze}
            disabled={!inputText.trim() || isAnalyzing}
            activeOpacity={0.85}
          >
            <MaterialIcons name={isAnalyzing ? 'hourglass-top' : 'security'} size={20}
              color={inputText.trim() ? Colors.bg : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Call Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 4 }]}>
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={() => setIsMuted(m => !m)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? Colors.danger : Colors.textSecondary} />
            <Text style={[styles.controlLabel, isMuted && { color: Colors.danger }]}>
              {isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.85}>
            <MaterialIcons name="call-end" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
            onPress={() => setIsSpeaker(s => !s)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={isSpeaker ? 'volume-up' : 'volume-down'} size={20}
              color={isSpeaker ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.controlLabel, isSpeaker && { color: Colors.primary }]}>
              {isSpeaker ? 'Speaker' : 'Speaker'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  sentinelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  sentinelLabel: { fontSize: 10, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 1 },
  directionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1,
  },
  outboundBadge: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary + '44' },
  inboundBadge: { backgroundColor: Colors.safeGlow, borderColor: Colors.safe + '44' },
  directionText: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.5 },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  recDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.danger },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  callerSection: { alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  callerInfo: { alignItems: 'center' },
  callerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  callerNumber: { fontSize: FontSize.sm, color: Colors.textSecondary },
  callerOrg: { fontSize: FontSize.xs, color: Colors.textMuted },
  waveformRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 44, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, width: '100%',
  },

  threatPanel: {
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  threatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  risingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.danger + '55',
  },
  risingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  confidenceText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  scoreBox: { flexDirection: 'row', alignItems: 'flex-end' },
  scoreNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  scoreUnit: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 3, marginLeft: 1 },
  meterTrack: { height: 6, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  dualMeters: { flexDirection: 'row', gap: Spacing.sm },
  dualMeter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  dualLabel: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 0.5, width: 52 },
  miniTrack: { flex: 1, height: 4, backgroundColor: Colors.bgSurface, borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 2 },
  miniScore: { fontSize: 9, fontWeight: FontWeight.bold, width: 20, textAlign: 'right' },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1,
  },
  flagText: { fontSize: 10, fontWeight: FontWeight.semibold },
  scamBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.danger + '44',
  },
  scamText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.danger },
  deepfakeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.warning + '44',
  },
  deepfakeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.warning },

  factBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginHorizontal: Spacing.md, backgroundColor: Colors.warningGlow,
    borderRadius: Radius.md, padding: Spacing.sm + 2,
    borderWidth: 1.5, borderColor: Colors.warning + '66', marginBottom: Spacing.sm,
  },
  factText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },

  transcript: {
    flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  emptyTranscript: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.sm, paddingHorizontal: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  transcriptLine: { gap: 3, backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: Spacing.sm },
  transcriptRole: { fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  analyzedTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  analyzedText: { fontSize: 10, color: Colors.safe },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderStrong, maxHeight: 80,
    includeFontPadding: false,
  },
  analyzeBtn: {
    width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  analyzeBtnOff: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm,
  },
  controlBtn: {
    alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: Radius.md,
  },
  controlBtnActive: { backgroundColor: Colors.bgSurface },
  controlLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  endBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', ...Shadow.danger,
  },
});

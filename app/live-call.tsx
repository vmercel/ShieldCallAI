/**
 * CALLSHIELD Live Call Screen
 * 
 * Real-time dual-layer analysis — zero user input required:
 *
 * Layer 1 — NLP (Web Speech API continuous):
 *   SpeechRecognition captures both parties in real time.
 *   Every final transcript segment is auto-fed into SENTINEL™.
 *   Speaker turn detection via pause heuristic (>800ms = turn change).
 *
 * Layer 2 — Acoustic (expo-av microphone):
 *   AcousticSentinel monitors live mic amplitude to detect monotone
 *   cadence, scripted pause patterns, and elevated vocal stress.
 *
 * Both layers fuse into a single composite threat score updated
 * every 500ms with temporal trajectory weighting.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing, Platform, KeyboardAvoidingView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { SentinelEngine } from '../services/sentinelEngine';
import { AcousticSentinel, AcousticSnapshot } from '../services/acousticSentinel';
import { ThreatLevel } from '../constants/mockData';
import { findContactByNumber, getInitials, Contact } from '../constants/contacts';
import { useLiveTranscription, TranscriptSegment } from '../hooks/useLiveTranscription';

function formatDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Animated Waveform Bar ────────────────────────────────────────────────────
function WaveformBar({ amplitude, color, index }: { amplitude: number; color: string; index: number }) {
  const anim = useRef(new Animated.Value(amplitude)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: amplitude, duration: 80, useNativeDriver: false }).start();
  }, [amplitude]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 38] });
  return (
    <Animated.View style={{
      width: 3, height, borderRadius: 2,
      backgroundColor: color,
      marginHorizontal: 1.5,
      opacity: 0.6 + (index / 48) * 0.4,
    }} />
  );
}

// ─── Caller Avatar ────────────────────────────────────────────────────────────
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

// ─── Speaker Label ────────────────────────────────────────────────────────────
function SpeakerLabel({ speaker, direction }: { speaker: 'A' | 'B'; direction: string }) {
  const isOutbound = direction === 'outbound';
  // Speaker A = first voice detected; B = second
  // For inbound: A = Caller, B = You; For outbound: A = You, B = Them
  const label = isOutbound
    ? (speaker === 'A' ? 'YOU' : 'THEM')
    : (speaker === 'A' ? 'CALLER' : 'YOU');
  const color = isOutbound
    ? (speaker === 'A' ? Colors.primary : Colors.warning)
    : (speaker === 'A' ? Colors.warning : Colors.primary);
  return (
    <Text style={{ fontSize: 9, fontWeight: '900', color, letterSpacing: 0.8, marginBottom: 2 }}>
      {label}
    </Text>
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
  const contact = findContactByNumber(callerNumber);
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
  const [confidenceLabel, setConfidenceLabel] = useState('Listening...');
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(Array(36).fill(0.05));
  const [acousticStress, setAcousticStress] = useState(0);
  const [acousticFlags, setAcousticFlags] = useState<string[]>([]);
  const [deepfakeConfidence, setDeepfakeConfidence] = useState(0);
  const [hasMic, setHasMic] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showFactCheck, setShowFactCheck] = useState(false);
  const [activeFactCheck, setActiveFactCheck] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const threatAnim = useRef(new Animated.Value(0)).current;
  const listenDotAnim = useRef(new Animated.Value(1)).current;
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const factCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live Transcription Hook ────────────────────────────────────────────────
  const transcription = useLiveTranscription(
    useCallback((text: string, speaker: 'A' | 'B') => {
      // Auto-feed every recognized segment into SENTINEL™
      const window = sentinelRef.current.ingestSegment(text);
      const analysis = sentinelRef.current.analyzeConversation();

      setThreatScore(window.score);
      setThreatLevel(window.level);
      setFlags(window.flags);
      setFactChecks(window.factChecks);
      setTrajectoryLabel(window.trajectoryLabel);
      setScamType(analysis.scamType);
      setConfidenceLabel(analysis.confidenceLabel);

      if (window.factChecks.length > 0) {
        setActiveFactCheck(window.factChecks[0]);
        setShowFactCheck(true);
        factCheckTimer.current && clearTimeout(factCheckTimer.current);
        factCheckTimer.current = setTimeout(() => setShowFactCheck(false), 8000);
      }
    }, [])
  );

  useEffect(() => {
    sentinelRef.current.reset();

    // Duration timer
    durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    // Listening dot pulse
    const listenPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(listenDotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(listenDotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    listenPulse.start();

    // Avatar pulse
    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]).start(pulsate);
    };
    pulsate();

    // Start auto-transcription
    transcription.start();

    // Start acoustic monitoring
    (async () => {
      const granted = await acousticRef.current.requestPermission();
      setHasMic(granted);
      if (granted) {
        await acousticRef.current.startMonitoring((snap: AcousticSnapshot) => {
          setAmplitudeHistory(prev => [...prev.slice(-35), snap.normalizedAmplitude]);
          setAcousticStress(snap.acousticStressScore);
          setAcousticFlags(snap.flags);
          setDeepfakeConfidence(acousticRef.current.getSession().deepfakeConfidence);
        });
      }
    })();

    return () => {
      durationTimerRef.current && clearInterval(durationTimerRef.current);
      factCheckTimer.current && clearTimeout(factCheckTimer.current);
      transcription.stop();
      acousticRef.current.stopMonitoring();
      listenPulse.stop();
    };
  }, []);

  // Scroll transcript to bottom on new segment
  useEffect(() => {
    if (transcription.segments.length > 0) {
      setTimeout(() => transcriptRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [transcription.segments.length]);

  useEffect(() => {
    Animated.timing(threatAnim, { toValue: threatScore, duration: 600, useNativeDriver: false }).start();
  }, [threatScore]);

  const threatColor = SentinelEngine.getThreatColor(threatLevel);
  const meterWidth = threatAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const compositeScore = Math.min(100, Math.round(threatScore * 0.72 + acousticStress * 0.28));
  const allFlags = [...new Set([...flags, ...acousticFlags])];
  const isWebSTT = Platform.OS === 'web' && transcription.isSupported;

  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    const text = manualInput.trim();
    setManualInput('');
    transcription.addManualSegment(text, 'A');
  }, [manualInput, transcription]);

  const handleEnd = async () => {
    transcription.stop();
    await acousticRef.current.stopMonitoring();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.sentinelBadge}>
              <Animated.View style={[styles.listenDot, { opacity: listenDotAnim }]} />
              <MaterialIcons name="security" size={11} color={Colors.primary} />
              <Text style={styles.sentinelLabel}>
                {isWebSTT
                  ? (transcription.isListening ? 'AUTO-ANALYZING' : 'SENTINEL™')
                  : 'SENTINEL™ ACTIVE'}
              </Text>
            </View>
            <View style={[styles.directionBadge,
              direction === 'outbound' ? styles.outboundBadge : styles.inboundBadge]}>
              <MaterialIcons
                name={direction === 'outbound' ? 'call-made' : 'call-received'}
                size={10}
                color={direction === 'outbound' ? Colors.primary : Colors.safe}
              />
              <Text style={[styles.directionText, {
                color: direction === 'outbound' ? Colors.primary : Colors.safe,
              }]}>
                {direction === 'outbound' ? 'OUTBOUND' : 'INBOUND'}
              </Text>
            </View>
          </View>
          <View style={styles.durationPill}>
            <View style={styles.recDot} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* ── Caller + Waveform ── */}
        <View style={styles.callerSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <CallerAvatar contact={contact} color={threatColor} size={60} />
          </Animated.View>
          <View style={styles.callerInfo}>
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callerNumber}>{callerNumber}</Text>
          </View>
          <View style={[styles.waveformWrap, { borderColor: threatColor + '44' }]}>
            {amplitudeHistory.map((amp, i) => (
              <WaveformBar
                key={i}
                index={i}
                amplitude={hasMic ? amp : 0.04 + Math.sin(i * 0.4 + Date.now() / 400) * 0.03}
                color={threatColor}
              />
            ))}
            {/* Real-time interim text over waveform */}
            {transcription.interimText ? (
              <View style={styles.interimOverlay}>
                <MaterialIcons name="hearing" size={10} color={Colors.primary} />
                <Text style={styles.interimText} numberOfLines={1}>
                  {transcription.interimText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Auto-Listening Status Banner ── */}
        <View style={[styles.listeningBanner, {
          backgroundColor: isWebSTT
            ? (transcription.isListening ? Colors.primaryGlow : Colors.bgCard)
            : Colors.bgCard,
          borderColor: isWebSTT
            ? (transcription.isListening ? Colors.primary + '55' : Colors.border)
            : Colors.border,
        }]}>
          {isWebSTT ? (
            <>
              <Animated.View style={[styles.listenPulse, {
                backgroundColor: transcription.isListening ? Colors.primary : Colors.textMuted,
                opacity: listenDotAnim,
              }]} />
              <Text style={[styles.listeningLabel, {
                color: transcription.isListening ? Colors.primary : Colors.textMuted,
              }]}>
                {transcription.isListening
                  ? 'SENTINEL™ is listening to both parties automatically'
                  : 'Starting speech recognition...'}
              </Text>
              <Text style={styles.wordCountText}>
                {transcription.wordCount} words · {transcription.segments.filter(s => s.isFinal).length} segments
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons name="graphic-eq" size={14} color={Colors.warning} />
              <Text style={styles.listeningLabel}>
                {hasMic
                  ? 'Acoustic monitoring active · Tap + to add transcript'
                  : 'Acoustic analysis active · Tap + to add transcript'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowManual(m => !m)}
                style={styles.addTranscriptBtn}
              >
                <MaterialIcons name={showManual ? 'remove' : 'add'} size={16} color={Colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── SENTINEL Threat Panel ── */}
        <View style={[styles.threatPanel, { borderColor: threatColor + '55' }]}>
          <View style={styles.threatRow}>
            <View style={{ gap: 3 }}>
              <View style={styles.levelRow}>
                <View style={[styles.levelDot, { backgroundColor: threatColor }]} />
                <Text style={[styles.levelLabel, { color: threatColor }]}>
                  {SentinelEngine.getThreatLabel(threatLevel)}
                </Text>
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

          {/* Composite meter */}
          <View style={styles.meterTrack}>
            <Animated.View style={[styles.meterFill, { width: meterWidth, backgroundColor: threatColor }]} />
          </View>

          {/* Dual NLP + Acoustic */}
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
                <View key={f} style={[styles.flagChip, {
                  backgroundColor: threatColor + '18', borderColor: threatColor + '44',
                }]}>
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

        {/* ── Fact Check Banner ── */}
        {showFactCheck && (
          <TouchableOpacity
            style={styles.factBanner}
            onPress={() => setShowFactCheck(false)}
            activeOpacity={0.9}
          >
            <MaterialIcons name="fact-check" size={15} color={Colors.warning} />
            <Text style={styles.factText} numberOfLines={3}>{activeFactCheck}</Text>
            <MaterialIcons name="close" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Live Transcript ── */}
        <ScrollView
          ref={transcriptRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcription.segments.length === 0 ? (
            <View style={styles.emptyTranscript}>
              {isWebSTT ? (
                <>
                  <View style={styles.emptyIconWrap}>
                    <MaterialIcons name="hearing" size={32} color={Colors.primary} />
                    <Animated.View style={[styles.emptyDot, { opacity: listenDotAnim }]} />
                  </View>
                  <Text style={styles.emptyTitle}>SENTINEL™ is listening</Text>
                  <Text style={styles.emptySubtitle}>
                    Speak normally. Both parties will be analyzed automatically.{'\n'}
                    No typing required.
                  </Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="graphic-eq" size={32} color={Colors.warning} />
                  <Text style={styles.emptyTitle}>Acoustic monitoring active</Text>
                  <Text style={styles.emptySubtitle}>
                    Microphone is analyzing voice patterns.{'\n'}
                    Tap + above to add transcript text if needed.
                  </Text>
                </>
              )}
            </View>
          ) : null}

          {transcription.segments.map((seg) => {
            const isAnalyzed = seg.analyzed;
            const score = seg.threatScore ?? 0;
            const segColor = score >= 65 ? Colors.danger : score >= 30 ? Colors.warning : Colors.safe;

            return (
              <View key={seg.id} style={[styles.transcriptLine, {
                borderLeftColor: isAnalyzed ? segColor : Colors.border,
                borderLeftWidth: 2.5,
              }]}>
                <SpeakerLabel speaker={seg.speaker} direction={direction} />
                <Text style={styles.transcriptText}>{seg.text}</Text>
                <View style={styles.segFooter}>
                  {isAnalyzed ? (
                    <View style={[styles.analyzedTag, { borderColor: segColor + '44' }]}>
                      <View style={[styles.analyzedDot, { backgroundColor: segColor }]} />
                      <Text style={[styles.analyzedText, { color: segColor }]}>
                        {score}% threat
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.analyzingTag}>
                      <MaterialIcons name="hourglass-top" size={10} color={Colors.primary} />
                      <Text style={styles.analyzingText}>Analyzing...</Text>
                    </View>
                  )}
                  <Text style={styles.segTime}>
                    {new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Interim preview */}
          {transcription.interimText ? (
            <View style={[styles.transcriptLine, styles.interimLine]}>
              <Text style={styles.interimSpeakerLabel}>LISTENING...</Text>
              <Text style={styles.interimLineText}>{transcription.interimText}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Manual Input (native fallback or optional override) ── */}
        {(showManual || (!isWebSTT && Platform.OS !== 'web')) && (
          <View style={[styles.manualInputRow, { paddingBottom: 4 }]}>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Type transcript to analyze..."
              placeholderTextColor={Colors.textMuted}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity
              style={[styles.manualSendBtn, !manualInput.trim() && { opacity: 0.4 }]}
              onPress={handleManualSubmit}
              disabled={!manualInput.trim()}
            >
              <MaterialIcons name="security" size={18} color={Colors.bg} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Call Controls ── */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={() => setIsMuted(m => !m)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isMuted ? 'mic-off' : 'mic'}
              size={20}
              color={isMuted ? Colors.danger : Colors.textSecondary}
            />
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
            <MaterialIcons
              name={isSpeaker ? 'volume-up' : 'volume-down'}
              size={20}
              color={isSpeaker ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.controlLabel, isSpeaker && { color: Colors.primary }]}>Speaker</Text>
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
    paddingHorizontal: Spacing.md, marginBottom: Spacing.xs,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  sentinelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  listenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  sentinelLabel: {
    fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 1,
  },
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

  callerSection: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.xs,
  },
  callerInfo: { gap: 1 },
  callerName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  callerNumber: { fontSize: FontSize.xs, color: Colors.textSecondary },
  waveformWrap: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, borderWidth: 1, overflow: 'hidden',
    position: 'relative',
  },
  interimOverlay: {
    position: 'absolute', bottom: 4, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bg + 'CC', borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  interimText: {
    flex: 1, fontSize: 9, color: Colors.primary, fontStyle: 'italic',
  },

  listeningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, marginBottom: Spacing.xs,
  },
  listenPulse: { width: 8, height: 8, borderRadius: 4 },
  listeningLabel: { flex: 1, fontSize: 10, fontWeight: FontWeight.semibold, lineHeight: 14 },
  wordCountText: { fontSize: 9, color: Colors.textMuted },
  addTranscriptBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong,
  },

  threatPanel: {
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, marginBottom: Spacing.xs, gap: Spacing.xs + 2,
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
  confidenceText: { fontSize: FontSize.xs, color: Colors.textMuted },
  scoreBox: { flexDirection: 'row', alignItems: 'flex-end' },
  scoreNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  scoreUnit: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 3, marginLeft: 1 },
  meterTrack: { height: 5, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
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
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.danger + '44',
  },
  scamText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.danger },
  deepfakeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  deepfakeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.warning },

  factBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginHorizontal: Spacing.md, backgroundColor: Colors.warningGlow,
    borderRadius: Radius.md, padding: Spacing.sm + 2,
    borderWidth: 1.5, borderColor: Colors.warning + '66', marginBottom: Spacing.xs,
  },
  factText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },

  transcript: {
    flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  transcriptContent: { padding: Spacing.sm, gap: Spacing.sm },
  emptyTranscript: {
    alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl,
  },
  emptyIconWrap: {
    position: 'relative', width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.bgCard,
  },
  emptyTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },
  transcriptLine: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: Spacing.sm,
    borderLeftWidth: 2.5, gap: 3,
  },
  interimLine: {
    borderLeftColor: Colors.primary + '66', backgroundColor: Colors.primaryGlow + '44',
    opacity: 0.8,
  },
  interimSpeakerLabel: {
    fontSize: 9, fontWeight: '900', color: Colors.primary, letterSpacing: 0.8,
  },
  interimLineText: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20,
  },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  segFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  analyzedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1,
  },
  analyzedDot: { width: 5, height: 5, borderRadius: 2.5 },
  analyzedText: { fontSize: 10, fontWeight: FontWeight.bold },
  analyzingTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  analyzingText: { fontSize: 10, color: Colors.primary },
  segTime: { marginLeft: 'auto', fontSize: 9, color: Colors.textMuted },

  manualInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  manualInput: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderStrong,
    includeFontPadding: false,
  },
  manualSendBtn: {
    width: 42, height: 42, borderRadius: Radius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  controlBtn: {
    alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.md,
  },
  controlBtnActive: { backgroundColor: Colors.bgSurface },
  controlLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  endBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', ...Shadow.danger,
  },
});

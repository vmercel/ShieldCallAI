/**
 * CALLSHIELD Live Call Screen — Enhanced Real-Time Analysis
 *
 * Analysis Architecture (v2 — Fixed):
 * ─────────────────────────────────────────────────────────
 * • Batch-based: runs every 10 seconds OR when a pause > 1.5s is detected.
 * • SENTINEL™ always receives the FULL cumulative transcript (not just new
 *   segments), so every re-analysis has complete call context.
 * • Peak-score ratchet: the display score can never fall below 75% of the
 *   highest score ever reached. A scammer who shifts to neutral follow-up
 *   questions after establishing urgency cannot suddenly appear "safe".
 * • Content verdict uses both current AND peak score — "genuine" is only
 *   returned when BOTH are low throughout the entire call.
 * • Flags and fact-checks are cumulative across all batches (never lost).
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
import { callRecordsService } from '../services/callRecordsService';
import { communityThreatsService, CommunityThreat } from '../services/communityThreatsService';

function formatDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type CallerType = 'unknown' | 'human' | 'ai_synthetic';
type SpamStatus = 'checking' | 'clean' | 'spam' | 'suspicious';
type ContentVerdict = 'insufficient' | 'genuine' | 'suspicious' | 'scam';

interface AnalysisResult {
  score: number;
  level: ThreatLevel;
  flags: string[];
  factChecks: string[];
  scamType: string | null;
  trajectoryLabel: 'rising' | 'falling' | 'stable';
  confidenceLabel: string;
  callerType: CallerType;
  callerTypeConfidence: number;
  spamStatus: SpamStatus;
  spamReportCount: number;
  contentVerdict: ContentVerdict;
  contentVerdictScore: number;
  wordsAnalyzed: number;
  batchCount: number;
  contextQuality: 'low' | 'medium' | 'high' | 'very_high';
  peakScore: number;
  lastUpdated: number;
}

function buildEmptyResult(): AnalysisResult {
  return {
    score: 0, level: 'safe', flags: [], factChecks: [],
    scamType: null, trajectoryLabel: 'stable', confidenceLabel: 'Listening...',
    callerType: 'unknown', callerTypeConfidence: 0,
    spamStatus: 'checking', spamReportCount: 0,
    contentVerdict: 'insufficient', contentVerdictScore: 0,
    wordsAnalyzed: 0, batchCount: 0, contextQuality: 'low',
    peakScore: 0, lastUpdated: 0,
  };
}

// ─── Caller Type Detector ─────────────────────────────────────────────────────
function detectCallerType(
  acousticDeepfakeConfidence: number,
  segments: TranscriptSegment[],
  acousticStress: number,
): { type: CallerType; confidence: number } {
  if (segments.length < 2) return { type: 'unknown', confidence: 0 };

  const acousticSignal = acousticDeepfakeConfidence;
  const callerSegments = segments.filter(s => s.isFinal && s.speaker === 'A');

  let timingVarianceScore = 0;
  if (callerSegments.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < callerSegments.length; i++) {
      gaps.push(callerSegments[i].timestamp - callerSegments[i - 1].timestamp);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length;
    const cv = Math.sqrt(variance) / (mean || 1);
    timingVarianceScore = cv < 0.25 ? 70 : cv < 0.4 ? 35 : 10;
  }

  const allWords = callerSegments.flatMap(s => s.text.toLowerCase().split(/\s+/));
  const uniqueWords = new Set(allWords);
  const diversityRatio = allWords.length > 0 ? uniqueWords.size / allWords.length : 1;
  const vocabScore = diversityRatio < 0.5 ? 50 : diversityRatio < 0.65 ? 25 : 0;
  const stressScore = acousticStress < 10 && callerSegments.length >= 3 ? 40 : 0;

  const syntheticConfidence = Math.min(100, Math.round(
    acousticSignal * 0.45 + timingVarianceScore * 0.25 + vocabScore * 0.15 + stressScore * 0.15
  ));

  if (syntheticConfidence >= 55) return { type: 'ai_synthetic', confidence: syntheticConfidence };
  if (callerSegments.length >= 3) return { type: 'human', confidence: Math.min(90, 100 - syntheticConfidence) };
  return { type: 'unknown', confidence: 0 };
}

// ─── Context Quality ──────────────────────────────────────────────────────────
function getContextQuality(words: number, batches: number): AnalysisResult['contextQuality'] {
  if (words >= 150 || batches >= 5) return 'very_high';
  if (words >= 80 || batches >= 3) return 'high';
  if (words >= 30 || batches >= 2) return 'medium';
  return 'low';
}

// ─── Content Verdict (Peak-Aware) ─────────────────────────────────────────────
/**
 * Uses BOTH current AND peak score for verdict.
 * "Genuine" can ONLY be returned if both scores are consistently low.
 * A scam call that established urgency early is never re-classified as
 * genuine just because the scammer shifted to neutral-sounding follow-ups.
 */
function getContentVerdict(
  currentScore: number,
  peakScore: number,
  batches: number,
): { verdict: ContentVerdict; confidence: number } {
  if (batches < 1) return { verdict: 'insufficient', confidence: 0 };

  // Effective score = max(current, 80% of peak).
  // This prevents verdict downgrade when scammer shifts tone.
  const effectiveScore = Math.max(currentScore, Math.round(peakScore * 0.80));

  if (effectiveScore >= 65) {
    return { verdict: 'scam', confidence: Math.min(99, effectiveScore + batches * 4) };
  }
  if (effectiveScore >= 35) {
    return { verdict: 'suspicious', confidence: Math.min(85, effectiveScore + batches * 3) };
  }
  // Genuine: only when BOTH current AND peak have been low all along
  if (batches >= 2 && peakScore < 30 && currentScore < 30) {
    return { verdict: 'genuine', confidence: Math.min(88, (100 - effectiveScore) * 0.8 + batches * 4) };
  }
  return { verdict: 'insufficient', confidence: 20 + batches * 8 };
}

// ─── Animated Waveform Bar ────────────────────────────────────────────────────
function WaveformBar({ amplitude, color, index }: { amplitude: number; color: string; index: number }) {
  const anim = useRef(new Animated.Value(amplitude)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: amplitude, duration: 80, useNativeDriver: false }).start();
  }, [amplitude]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 36] });
  return (
    <Animated.View style={{
      width: 3, height, borderRadius: 2,
      backgroundColor: color, marginHorizontal: 1.5,
      opacity: 0.55 + (index / 36) * 0.45,
    }} />
  );
}

// ─── Animated Score Ring ─────────────────────────────────────────────────────
function ScoreRing({ score, color, size = 72 }: { score: number; color: string; size?: number }) {
  const anim = useRef(new Animated.Value(score)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: score, tension: 60, friction: 10, useNativeDriver: false }).start();
  }, [score]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 4, borderColor: color + '33',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: color + '12',
      }}>
        <View style={{
          width: size - 16, height: size - 16, borderRadius: (size - 16) / 2,
          borderWidth: 3, borderColor: color,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: size * 0.27, fontWeight: '900', color }}>{score}</Text>
          <Text style={{ fontSize: size * 0.13, color: color + 'AA', fontWeight: '700', marginTop: -2 }}>%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Caller Avatar ────────────────────────────────────────────────────────────
function CallerAvatar({ contact, size = 56, color }: { contact?: Contact | null; size?: number; color: string }) {
  if (contact) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: contact.avatarColor + '22', borderWidth: 2, borderColor: color,
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
      backgroundColor: color + '22', borderWidth: 2, borderColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <MaterialIcons name="person" size={size * 0.45} color={color} />
    </View>
  );
}

function SpeakerLabel({ speaker, direction }: { speaker: 'A' | 'B'; direction: string }) {
  const isOutbound = direction === 'outbound';
  const label = isOutbound
    ? (speaker === 'A' ? 'YOU' : 'THEM')
    : (speaker === 'A' ? 'CALLER' : 'YOU');
  const color = isOutbound
    ? (speaker === 'A' ? Colors.primary : Colors.warning)
    : (speaker === 'A' ? Colors.warning : Colors.primary);
  return <Text style={{ fontSize: 9, fontWeight: '900', color, letterSpacing: 0.8, marginBottom: 2 }}>{label}</Text>;
}

// ─── RESULT CARD ─────────────────────────────────────────────────────────────
function ResultCard({ result, isAnalyzing }: { result: AnalysisResult; isAnalyzing: boolean }) {
  const threatColor = SentinelEngine.getThreatColor(result.level);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (result.lastUpdated === 0) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.55, duration: 110, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [result.lastUpdated]);

  const contextColors = { low: Colors.textMuted, medium: Colors.warning, high: Colors.primary, very_high: Colors.safe };
  const contextColor = contextColors[result.contextQuality];

  // Caller type
  const callerTypeIcon = result.callerType === 'ai_synthetic' ? 'smart-toy' : result.callerType === 'human' ? 'person' : 'help-outline';
  const callerTypeColor = result.callerType === 'ai_synthetic' ? Colors.warning : result.callerType === 'human' ? Colors.safe : Colors.textMuted;
  const callerTypeLabel = result.callerType === 'ai_synthetic' ? 'AI / Synthetic Voice' : result.callerType === 'human' ? 'Human Caller' : 'Detecting...';

  // Spam status
  const spamIcon = result.spamStatus === 'spam' ? 'warning' : result.spamStatus === 'suspicious' ? 'report-problem' : result.spamStatus === 'clean' ? 'verified' : 'hourglass-top';
  const spamColor = result.spamStatus === 'spam' ? Colors.danger : result.spamStatus === 'suspicious' ? Colors.warning : result.spamStatus === 'clean' ? Colors.safe : Colors.textMuted;
  const spamLabel = result.spamStatus === 'spam'
    ? `Spam DB: ${result.spamReportCount.toLocaleString()} reports`
    : result.spamStatus === 'suspicious'
    ? `Low-trust: ${result.spamReportCount} reports`
    : result.spamStatus === 'clean'
    ? 'Not in spam database'
    : 'Checking database...';

  // Content verdict
  const verdictIcon = result.contentVerdict === 'scam' ? 'dangerous' : result.contentVerdict === 'genuine' ? 'check-circle' : result.contentVerdict === 'suspicious' ? 'warning' : 'psychology';
  const verdictColor = result.contentVerdict === 'scam' ? Colors.danger : result.contentVerdict === 'genuine' ? Colors.safe : result.contentVerdict === 'suspicious' ? Colors.warning : Colors.textMuted;
  const verdictLabel = result.contentVerdict === 'scam' ? 'Scam Detected' : result.contentVerdict === 'genuine' ? 'Appears Genuine' : result.contentVerdict === 'suspicious' ? 'Suspicious Content' : 'Analyzing...';
  const verdictSub = result.contentVerdict === 'insufficient'
    ? `Need ~${Math.max(0, 30 - result.wordsAnalyzed)} more words`
    : `${result.contentVerdictScore}% confidence · peak ${result.peakScore}%`;

  return (
    <Animated.View style={[styles.resultCard, { borderColor: threatColor + '55', opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.resultHeader}>
        <View style={styles.resultHeaderLeft}>
          <View style={[styles.levelDot, { backgroundColor: threatColor }]} />
          <Text style={[styles.resultLevelLabel, { color: threatColor }]}>
            {SentinelEngine.getThreatLabel(result.level)}
          </Text>
          {result.trajectoryLabel === 'rising' && (
            <View style={styles.risingBadge}>
              <MaterialIcons name="trending-up" size={10} color={Colors.danger} />
              <Text style={styles.risingText}>RISING</Text>
            </View>
          )}
          {result.peakScore > 0 && result.score < result.peakScore && (
            <View style={styles.peakBadge}>
              <MaterialIcons name="show-chart" size={10} color={Colors.warning} />
              <Text style={styles.peakText}>PEAK {result.peakScore}%</Text>
            </View>
          )}
        </View>
        <View>
          {isAnalyzing ? (
            <View style={styles.analyzingBadge}>
              <View style={styles.analyzingDot} />
              <Text style={styles.analyzingText}>ANALYZING</Text>
            </View>
          ) : result.batchCount > 0 ? (
            <View style={[styles.contextBadge, { borderColor: contextColor + '55' }]}>
              <MaterialIcons name="psychology" size={10} color={contextColor} />
              <Text style={[styles.contextText, { color: contextColor }]}>{result.contextQuality.replace('_', ' ').toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.waitingBadge}>
              <Text style={styles.waitingText}>WAITING</Text>
            </View>
          )}
        </View>
      </View>

      {/* Score + Dimensions */}
      <View style={styles.resultMain}>
        <ScoreRing score={result.score} color={threatColor} size={76} />
        <View style={styles.dimensionsCol}>
          <View style={[styles.dimCard, { borderColor: callerTypeColor + '33', backgroundColor: callerTypeColor + '0D' }]}>
            <MaterialIcons name={callerTypeIcon as any} size={13} color={callerTypeColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dimLabel, { color: callerTypeColor }]}>{callerTypeLabel}</Text>
              {result.callerTypeConfidence > 0 && (
                <Text style={styles.dimSub}>{result.callerTypeConfidence}% confidence</Text>
              )}
            </View>
          </View>
          <View style={[styles.dimCard, { borderColor: spamColor + '33', backgroundColor: spamColor + '0D' }]}>
            <MaterialIcons name={spamIcon as any} size={13} color={spamColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dimLabel, { color: spamColor }]} numberOfLines={1}>{spamLabel}</Text>
            </View>
          </View>
          <View style={[styles.dimCard, { borderColor: verdictColor + '33', backgroundColor: verdictColor + '0D' }]}>
            <MaterialIcons name={verdictIcon as any} size={13} color={verdictColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dimLabel, { color: verdictColor }]}>{verdictLabel}</Text>
              <Text style={styles.dimSub}>{verdictSub}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Confidence bar */}
      {result.batchCount > 0 && (
        <View style={styles.confidenceRow}>
          <MaterialIcons name="signal-cellular-alt" size={12} color={Colors.textMuted} />
          <Text style={styles.confidenceLabel}>{result.confidenceLabel}</Text>
          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${result.contentVerdictScore}%`, backgroundColor: verdictColor }]} />
          </View>
          <Text style={styles.batchCount}>B{result.batchCount} · {result.wordsAnalyzed}w</Text>
        </View>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <View style={styles.flagsRow}>
          {result.flags.slice(0, 4).map(f => (
            <View key={f} style={[styles.flagChip, { borderColor: threatColor + '44', backgroundColor: threatColor + '15' }]}>
              <MaterialIcons name="warning" size={9} color={threatColor} />
              <Text style={[styles.flagText, { color: threatColor }]}>{f}</Text>
            </View>
          ))}
          {result.flags.length > 4 && (
            <View style={[styles.flagChip, { borderColor: Colors.border }]}>
              <Text style={[styles.flagText, { color: Colors.textMuted }]}>+{result.flags.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* Scam type */}
      {result.scamType && (
        <View style={styles.scamBadge}>
          <MaterialIcons name="local-police" size={12} color={Colors.danger} />
          <Text style={styles.scamText}>Classified: {result.scamType}</Text>
        </View>
      )}

      {result.contextQuality === 'low' && result.batchCount === 0 && (
        <Text style={styles.listeningHint}>
          Analysis every 10s or on pause · score never drops below 75% of peak
        </Text>
      )}
    </Animated.View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function LiveCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    callerName?: string; callerNumber?: string;
    contactId?: string; direction?: string;
  }>();

  const direction = params.direction ?? 'inbound';
  const callerNumber = params.callerNumber ?? '+1 (202) 555-0147';
  const contact = findContactByNumber(callerNumber);
  const callerName = contact?.name ?? params.callerName ?? 'Unknown Caller';

  const sentinelRef = useRef(new SentinelEngine());
  const acousticRef = useRef(new AcousticSentinel());

  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<AnalysisResult>(buildEmptyResult());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(Array(32).fill(0.05));
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
  const [spamRecord, setSpamRecord] = useState<CommunityThreat | null>(null);
  const [spamChecked, setSpamChecked] = useState(false);

  // Batch state
  const batchBufferRef = useRef<string[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchCountRef = useRef(0);
  const allSegmentsRef = useRef<string[]>([]);
  const wordsAnalyzedRef = useRef(0);
  const acousticStressRef = useRef(0);
  const deepfakeRef = useRef(0);
  const transcriptionSegmentsRef = useRef<TranscriptSegment[]>([]);
  /** Peak display score — ratchet floor = 75% of this */
  const peakScoreRef = useRef(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const listenDotAnim = useRef(new Animated.Value(1)).current;
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const factCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Spam check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!callerNumber || callerNumber === 'AI-DIALED') { setSpamChecked(true); return; }
    communityThreatsService.checkNumber(callerNumber).then(({ data }) => {
      setSpamRecord(data);
      setSpamChecked(true);
    });
  }, [callerNumber]);

  // ── Core batch analysis ──────────────────────────────────────────────────
  const runBatchAnalysis = useCallback(() => {
    const newText = batchBufferRef.current.join(' ');
    const newWords = newText.split(/\s+/).filter(Boolean).length;

    // Need either new words, or at least 1 previous batch + something changed (spam check done)
    if (newWords === 0 && batchCountRef.current === 0) return;

    setIsAnalyzing(true);

    // KEY FIX: Feed new text to engine (engine internally appends to cumulative).
    // For the first batch after spam check completes with no new words,
    // feed a zero-length string to trigger re-analysis of cumulative.
    sentinelRef.current.ingestSegment(newText);

    batchBufferRef.current = [];
    batchCountRef.current += 1;
    wordsAnalyzedRef.current += newWords;

    const analysis = sentinelRef.current.analyzeConversation();

    // Caller type detection
    const { type: callerType, confidence: callerTypeConf } = detectCallerType(
      deepfakeRef.current,
      transcriptionSegmentsRef.current,
      acousticStressRef.current,
    );

    // Spam status
    const spamStatus: SpamStatus = !spamChecked ? 'checking'
      : spamRecord ? (spamRecord.report_count >= 100 ? 'spam' : 'suspicious')
      : 'clean';

    // Context quality
    const contextQuality = getContextQuality(wordsAnalyzedRef.current, batchCountRef.current);

    // All flags — engine already accumulates these, plus acoustic
    const allFlags = [...new Set([...analysis.allFlags, ...acousticFlags])];

    // ── PEAK RATCHET ──
    // The raw composite from the engine already includes a 70% ratchet internally.
    // Apply an additional 75% ratchet at display level for full protection.
    const rawScore = analysis.compositeScore;
    const ratchetFloor = Math.round(peakScoreRef.current * 0.75);
    const displayScore = Math.max(rawScore, ratchetFloor);
    if (displayScore > peakScoreRef.current) peakScoreRef.current = displayScore;

    const displayLevel: ThreatLevel = displayScore >= 65 ? 'danger' : displayScore >= 30 ? 'warning' : 'safe';

    const { verdict: contentVerdict, confidence: contentVerdictScore } = getContentVerdict(
      displayScore,
      peakScoreRef.current,
      batchCountRef.current,
    );

    const newResult: AnalysisResult = {
      score: displayScore,
      level: displayLevel,
      flags: allFlags,
      factChecks: analysis.allFactChecks,
      scamType: analysis.scamType,
      trajectoryLabel: analysis.trajectoryLabel,
      confidenceLabel: analysis.confidenceLabel,
      callerType,
      callerTypeConfidence: callerTypeConf,
      spamStatus,
      spamReportCount: spamRecord?.report_count ?? 0,
      contentVerdict,
      contentVerdictScore,
      wordsAnalyzed: wordsAnalyzedRef.current,
      batchCount: batchCountRef.current,
      contextQuality,
      peakScore: peakScoreRef.current,
      lastUpdated: Date.now(),
    };

    setResult(newResult);
    setIsAnalyzing(false);

    if (analysis.allFactChecks.length > 0) {
      setActiveFactCheck(analysis.allFactChecks[0]);
      setShowFactCheck(true);
      factCheckTimer.current && clearTimeout(factCheckTimer.current);
      factCheckTimer.current = setTimeout(() => setShowFactCheck(false), 9000);
    }
  }, [acousticFlags, spamChecked, spamRecord]);

  // ── Handle new speech segment ────────────────────────────────────────────
  const handleSegment = useCallback((text: string, speaker: 'A' | 'B') => {
    batchBufferRef.current.push(text);
    allSegmentsRef.current.push(text);
    pauseTimerRef.current && clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      if (batchBufferRef.current.length > 0) runBatchAnalysis();
    }, 1500);
  }, [runBatchAnalysis]);

  const transcription = useLiveTranscription(handleSegment);

  useEffect(() => {
    transcriptionSegmentsRef.current = transcription.segments;
  }, [transcription.segments]);

  // 10-second batch timer
  useEffect(() => {
    batchTimerRef.current = setInterval(() => {
      if (allSegmentsRef.current.length > 0) runBatchAnalysis();
    }, 10000);
    return () => { batchTimerRef.current && clearInterval(batchTimerRef.current); };
  }, [runBatchAnalysis]);

  // Re-run when spam check completes
  useEffect(() => {
    if (spamChecked && batchCountRef.current > 0) runBatchAnalysis();
  }, [spamChecked, spamRecord]);

  // Sync acoustic refs
  useEffect(() => {
    acousticStressRef.current = acousticStress;
    deepfakeRef.current = deepfakeConfidence;
  }, [acousticStress, deepfakeConfidence]);

  // ── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    sentinelRef.current.reset();
    peakScoreRef.current = 0;
    durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    const listenPulse = Animated.loop(Animated.sequence([
      Animated.timing(listenDotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(listenDotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    listenPulse.start();

    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]).start(pulsate);
    };
    pulsate();

    transcription.start();

    (async () => {
      const granted = await acousticRef.current.requestPermission();
      setHasMic(granted);
      if (granted) {
        await acousticRef.current.startMonitoring((snap: AcousticSnapshot) => {
          setAmplitudeHistory(prev => [...prev.slice(-31), snap.normalizedAmplitude]);
          setAcousticStress(snap.acousticStressScore);
          setAcousticFlags(snap.flags);
          setDeepfakeConfidence(acousticRef.current.getSession().deepfakeConfidence);
        });
      }
    })();

    return () => {
      durationTimerRef.current && clearInterval(durationTimerRef.current);
      batchTimerRef.current && clearInterval(batchTimerRef.current);
      pauseTimerRef.current && clearTimeout(pauseTimerRef.current);
      factCheckTimer.current && clearTimeout(factCheckTimer.current);
      transcription.stop();
      acousticRef.current.stopMonitoring();
      listenPulse.stop();
    };
  }, []);

  useEffect(() => {
    if (transcription.segments.length > 0) {
      setTimeout(() => transcriptRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [transcription.segments.length]);

  const threatColor = SentinelEngine.getThreatColor(result.level);
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
    const finalAnalysis = sentinelRef.current.analyzeConversation();
    const transcriptData = transcription.segments
      .filter(s => s.isFinal)
      .map(s => ({
        speaker: s.speaker === 'A' ? (direction === 'outbound' ? 'you' : 'caller') : (direction === 'outbound' ? 'them' : 'you'),
        text: s.text,
      }));
    callRecordsService.insert({
      caller_name: callerName,
      caller_number: callerNumber,
      caller_org: contact?.org,
      direction: direction as 'inbound' | 'outbound',
      started_at: new Date(Date.now() - duration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      threat_level: finalAnalysis.level,
      threat_score: Math.max(finalAnalysis.compositeScore, peakScoreRef.current),
      scam_type: finalAnalysis.scamType,
      summary: finalAnalysis.allFlags.length > 0
        ? `SENTINEL™ detected: ${finalAnalysis.allFlags.slice(0, 3).join(', ')}. Peak threat: ${peakScoreRef.current}%.`
        : 'No threat indicators detected. Call appeared legitimate.',
      ai_notes: finalAnalysis.allFactChecks.length > 0 ? finalAnalysis.allFactChecks[0] : undefined,
      tags: finalAnalysis.dominantCategory ? [finalAnalysis.dominantCategory.replace(/_/g, ' ')] : [],
      ghost_handled: false,
      transcript: transcriptData,
      flags: finalAnalysis.allFlags,
      fact_checks: finalAnalysis.allFactChecks,
      is_blocked: false,
      reported_to_ftc: false,
    }).catch(() => {});
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.sentinelBadge}>
              <Animated.View style={[styles.listenDot, { opacity: listenDotAnim, backgroundColor: isAnalyzing ? Colors.warning : Colors.primary }]} />
              <MaterialIcons name="security" size={11} color={isAnalyzing ? Colors.warning : Colors.primary} />
              <Text style={[styles.sentinelLabel, { color: isAnalyzing ? Colors.warning : Colors.primary }]}>
                {isAnalyzing ? 'ANALYZING BATCH' : isWebSTT && transcription.isListening ? 'AUTO-ANALYZING' : 'SENTINEL™ ACTIVE'}
              </Text>
            </View>
            <View style={[styles.directionBadge, direction === 'outbound' ? styles.outboundBadge : styles.inboundBadge]}>
              <MaterialIcons
                name={direction === 'outbound' ? 'call-made' : 'call-received'}
                size={10}
                color={direction === 'outbound' ? Colors.primary : Colors.safe}
              />
              <Text style={[styles.directionText, { color: direction === 'outbound' ? Colors.primary : Colors.safe }]}>
                {direction === 'outbound' ? 'OUTBOUND' : 'INBOUND'}
              </Text>
            </View>
          </View>
          <View style={styles.durationPill}>
            <View style={styles.recDot} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* Caller Row */}
        <View style={styles.callerRow}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <CallerAvatar contact={contact} color={threatColor} size={52} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.callerName} numberOfLines={1}>{callerName}</Text>
            <Text style={styles.callerNumber}>{callerNumber}</Text>
          </View>
          <View style={[styles.waveformWrap, { borderColor: threatColor + '33' }]}>
            {amplitudeHistory.slice(-24).map((amp, i) => (
              <WaveformBar
                key={i} index={i}
                amplitude={hasMic ? amp : 0.04 + Math.sin(i * 0.5) * 0.025}
                color={threatColor}
              />
            ))}
          </View>
        </View>

        {/* Result Card */}
        <ResultCard result={result} isAnalyzing={isAnalyzing} />

        {/* Fact Check Banner */}
        {showFactCheck && (
          <TouchableOpacity style={styles.factBanner} onPress={() => setShowFactCheck(false)} activeOpacity={0.9}>
            <MaterialIcons name="fact-check" size={15} color={Colors.warning} />
            <Text style={styles.factText} numberOfLines={3}>{activeFactCheck}</Text>
            <MaterialIcons name="close" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Listen Status */}
        <View style={[styles.listeningBanner, {
          backgroundColor: isWebSTT ? (transcription.isListening ? Colors.primaryGlow : Colors.bgCard) : Colors.bgCard,
          borderColor: isWebSTT ? (transcription.isListening ? Colors.primary + '44' : Colors.border) : Colors.border,
        }]}>
          {isWebSTT ? (
            <>
              <Animated.View style={[styles.listenPulse, {
                backgroundColor: transcription.isListening ? Colors.primary : Colors.textMuted,
                opacity: listenDotAnim,
              }]} />
              <Text style={[styles.listeningLabel, { color: transcription.isListening ? Colors.primary : Colors.textMuted }]}>
                {transcription.isListening ? 'Listening · 10s batches · score ratcheted to peak' : 'Starting...'}
              </Text>
              <Text style={styles.wordCountText}>{transcription.wordCount}w · B{result.batchCount}</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="graphic-eq" size={13} color={Colors.primary} />
              <Text style={[styles.listeningLabel, { color: Colors.primary }]}>Auto-analyzing · acoustic monitoring · {result.batchCount} batches</Text>
            </>
          )}
        </View>

        {/* Transcript */}
        <ScrollView
          ref={transcriptRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcription.segments.length === 0 && (
            <View style={styles.emptyTranscript}>
              {isWebSTT ? (
                <>
                  <View style={{ position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="hearing" size={32} color={Colors.primary} />
                    <Animated.View style={{
                      position: 'absolute', bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary,
                      borderWidth: 2, borderColor: Colors.bgCard, opacity: listenDotAnim,
                    }} />
                  </View>
                  <Text style={styles.emptyTitle}>SENTINEL™ is listening</Text>
                  <Text style={styles.emptySubtitle}>
                    Speak naturally. Score updates every 10 seconds.{'\n'}
                    Risk score never drops below 75% of peak.
                  </Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="graphic-eq" size={32} color={Colors.primary} />
                  <Text style={styles.emptyTitle}>SENTINEL™ is listening</Text>
                  <Text style={styles.emptySubtitle}>Audio is analyzed in real-time.{"\n"}Score updates every 10 seconds automatically.</Text>
                </>
              )}
            </View>
          )}

          {transcription.segments.map(seg => (
            <View key={seg.id} style={[styles.transcriptLine, {
              borderLeftColor: seg.analyzed
                ? ((seg.threatScore ?? 0) >= 65 ? Colors.danger : (seg.threatScore ?? 0) >= 30 ? Colors.warning : Colors.safe)
                : Colors.border + '88',
              borderLeftWidth: 2.5,
            }]}>
              <SpeakerLabel speaker={seg.speaker} direction={direction} />
              <Text style={styles.transcriptText}>{seg.text}</Text>
              <Text style={styles.segTime}>
                {new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
          ))}

          {transcription.interimText ? (
            <View style={[styles.transcriptLine, styles.interimLine]}>
              <Text style={styles.interimSpeakerLabel}>LISTENING...</Text>
              <Text style={styles.interimLineText}>{transcription.interimText}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Manual note — optional fallback, only when toggled */}
        {showManual && (
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Add a note or correction..."
              placeholderTextColor={Colors.textMuted}
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

        {/* Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 6 }]}>
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={() => setIsMuted(m => !m)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? Colors.danger : Colors.textSecondary} />
            <Text style={[styles.controlLabel, isMuted && { color: Colors.danger }]}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.85}>
            <MaterialIcons name="call-end" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
            onPress={() => setIsSpeaker(s => !s)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={isSpeaker ? 'volume-up' : 'volume-down'} size={20} color={isSpeaker ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.controlLabel, isSpeaker && { color: Colors.primary }]}>Speaker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  sentinelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong },
  listenDot: { width: 6, height: 6, borderRadius: 3 },
  sentinelLabel: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  directionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  outboundBadge: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary + '44' },
  inboundBadge: { backgroundColor: Colors.safeGlow, borderColor: Colors.safe + '44' },
  directionText: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.5 },
  durationPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  callerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  callerName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  callerNumber: { fontSize: FontSize.xs, color: Colors.textSecondary },
  waveformWrap: { height: 40, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.md, paddingHorizontal: Spacing.xs, borderWidth: 1, overflow: 'hidden', flex: 0.9 },

  resultCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, marginBottom: Spacing.xs, gap: Spacing.sm },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  resultLevelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  risingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dangerGlow, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.danger + '44' },
  risingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  peakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.warning + '44' },
  peakText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.warning, letterSpacing: 0.5 },
  analyzingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.warning + '44' },
  analyzingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  analyzingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.warning, letterSpacing: 0.5 },
  contextBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bgSurface, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  contextText: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.5 },
  waitingBadge: { backgroundColor: Colors.bgSurface, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  waitingText: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 0.5 },

  resultMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dimensionsCol: { flex: 1, gap: Spacing.xs + 2 },
  dimCard: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1 },
  dimLabel: { fontSize: 11, fontWeight: FontWeight.bold, lineHeight: 14 },
  dimSub: { fontSize: 9, color: Colors.textMuted, marginTop: 1 },

  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border + '66' },
  confidenceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 0.8 },
  confidenceTrack: { flex: 1, height: 4, backgroundColor: Colors.bgSurface, borderRadius: 2, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 2 },
  batchCount: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.bold },

  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  flagChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  flagText: { fontSize: 9, fontWeight: FontWeight.semibold },
  scamBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.dangerGlow, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: Colors.danger + '44', alignSelf: 'flex-start' },
  scamText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.danger },
  listeningHint: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic', lineHeight: 15 },

  factBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginHorizontal: Spacing.md, backgroundColor: Colors.warningGlow, borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1.5, borderColor: Colors.warning + '55', marginBottom: Spacing.xs },
  factText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 17 },

  listeningBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 7, borderWidth: 1, marginBottom: Spacing.xs },
  listenPulse: { width: 7, height: 7, borderRadius: 3.5 },
  listeningLabel: { flex: 1, fontSize: 10, fontWeight: FontWeight.semibold, lineHeight: 14 },
  wordCountText: { fontSize: 9, color: Colors.textMuted },
  addBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong },

  transcript: { flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xs },
  transcriptContent: { padding: Spacing.sm, gap: Spacing.sm },
  emptyTranscript: { alignItems: 'center', paddingTop: Spacing.lg, gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  transcriptLine: { backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 2.5, gap: 3 },
  interimLine: { borderLeftColor: Colors.primary + '55', backgroundColor: Colors.primaryGlow + '33', opacity: 0.85 },
  interimSpeakerLabel: { fontSize: 9, fontWeight: '900', color: Colors.primary, letterSpacing: 0.8 },
  interimLineText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },
  segTime: { fontSize: 9, color: Colors.textMuted, alignSelf: 'flex-end' },

  manualInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border },
  manualInput: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.sm, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong, includeFontPadding: false },
  manualSendBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  controlBtn: { alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 14, borderRadius: Radius.md },
  controlBtnActive: { backgroundColor: Colors.bgSurface },
  controlLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  endBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', ...Shadow.danger },
});

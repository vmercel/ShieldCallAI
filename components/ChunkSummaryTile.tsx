/**
 * Persistent live verdict card. The shell never moves.
 * Updates: arc fill, tick ignition, orbit, bloom, count-up, haptic, bar shimmer.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { SentinelEngine } from '../services/sentinelEngine';
import { ThreatLevel } from '../constants/mockData';

export type VoiceKind = 'unknown' | 'human' | 'ai_synthetic';
export type ContentKind = 'insufficient' | 'genuine' | 'suspicious' | 'scam';

export interface ChunkAnalysis {
  id: string;
  chunkIndex: number;
  chunkText: string;
  atSeconds: number;
  score: number;
  level: ThreatLevel;
  flags: string[];
  scamType: string | null;
  callerType: VoiceKind;
  callerTypeConfidence: number;
  contentVerdict: ContentKind;
  contentVerdictScore: number;
  voiceLikelihoodLabel: string;
  contentLikelihoodLabel: string;
  confidenceLabel: string;
  poweredByClaude: boolean;
  poweredByCore?: boolean;
  claudeReasoning?: string;
  wordsAnalyzed: number;
  peakScore: number;
  spamStatus?: string;
  trajectoryLabel?: 'rising' | 'falling' | 'stable';
}

const RING = 112;
const STROKE = 8;
const RADIUS = (RING - STROKE) / 2 - 8;
const CIRC = 2 * Math.PI * RADIUS;
const TICKS = 40;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function formatClock(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function Orbit({ color, duration, size, inset }: { color: string; duration: number; size: number; inset: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View pointerEvents="none" style={[styles.orbit, { transform: [{ rotate }] }]}>
      <View style={[styles.orbitDot, { top: inset, width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
    </Animated.View>
  );
}

function SparkBurst({ trigger, color }: { trigger: string; color: string }) {
  const sparks = useRef(
    Array.from({ length: 8 }, () => ({
      op: new Animated.Value(0),
      dist: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (!trigger) return;
    sparks.forEach((s, i) => {
      s.op.setValue(0);
      s.dist.setValue(0);
      Animated.sequence([
        Animated.delay(i * 28),
        Animated.parallel([
          Animated.timing(s.op, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(s.dist, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.timing(s.op, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }, [trigger, sparks]);

  return (
    <View pointerEvents="none" style={styles.sparkLayer}>
      {sparks.map((s, i) => {
        const ang = (i / sparks.length) * Math.PI * 2;
        const tx = s.dist.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * 46] });
        const ty = s.dist.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * 46] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              { backgroundColor: color, opacity: s.op, transform: [{ translateX: tx }, { translateY: ty }] },
            ]}
          />
        );
      })}
    </View>
  );
}

export function LiveResultCard({
  analysis,
  isAnalyzing,
}: {
  analysis: ChunkAnalysis | null;
  isAnalyzing: boolean;
}) {
  const ready = !!(analysis && analysis.chunkIndex > 0);
  const score = analysis?.score ?? 0;
  const level: ThreatLevel = analysis?.level ?? 'safe';
  const color = SentinelEngine.getThreatColor(level);
  const rgb = hexToRgb(color);

  const displayedScore = useRef(0);
  const [scoreText, setScoreText] = useState(0);
  const arc = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(4)).current;
  const bloom = useRef(new Animated.Value(0)).current;
  const listen = useRef(new Animated.Value(0.35)).current;
  const halo = useRef(new Animated.Value(0.5)).current;
  const voicePop = useRef(new Animated.Value(1)).current;
  const contentPop = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breath = Animated.loop(Animated.sequence([
      Animated.timing(listen, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(listen, { toValue: 0.28, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const haloLoop = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0.35, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const shine = Animated.loop(Animated.timing(shimmer, {
      toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    }));
    breath.start();
    haloLoop.start();
    shine.start();
    return () => { breath.stop(); haloLoop.stop(); shine.stop(); };
  }, [halo, listen, shimmer]);

  useEffect(() => {
    const from = displayedScore.current;
    const to = score;
    displayedScore.current = to;
    const start = Date.now();
    const dur = 640;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setScoreText(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    Animated.timing(arc, {
      toValue: to,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => cancelAnimationFrame(frame);
  }, [score, analysis?.id, arc]);

  useEffect(() => {
    Animated.timing(bar, {
      toValue: Math.min(100, Math.max(6, analysis?.contentVerdictScore ?? 6)),
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [analysis?.contentVerdictScore, analysis?.id, bar]);

  useEffect(() => {
    if (!analysis?.id) return;
    bloom.setValue(0);
    sheen.setValue(0);
    voicePop.setValue(0.92);
    contentPop.setValue(0.92);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bloom, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(bloom, { toValue: 0, duration: 860, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(sheen, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(voicePop, { toValue: 1, tension: 140, friction: 10, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(70),
        Animated.spring(contentPop, { toValue: 1, tension: 140, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
    if (Platform.OS !== 'web') {
      const traj = analysis.trajectoryLabel;
      if (traj === 'rising') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  }, [analysis?.id, analysis?.trajectoryLabel, bloom, sheen, voicePop, contentPop]);

  const voice = analysis?.callerType ?? 'unknown';
  const content = analysis?.contentVerdict ?? 'insufficient';
  const voiceIcon = voice === 'ai_synthetic' ? 'smart-toy' : voice === 'human' ? 'person' : 'graphic-eq';
  const voiceColor = voice === 'ai_synthetic' ? Colors.warning : voice === 'human' ? Colors.safe : Colors.textMuted;
  const voiceTitle = voice === 'ai_synthetic' ? 'AI / synthetic voice' : voice === 'human' ? 'Human voice' : 'Voice';
  const verdictIcon = content === 'scam' ? 'dangerous' : content === 'genuine' ? 'check-circle' : content === 'suspicious' ? 'warning' : 'psychology';
  const verdictColor = content === 'scam' ? Colors.danger : content === 'genuine' ? Colors.safe : content === 'suspicious' ? Colors.warning : Colors.textMuted;
  const verdictTitle = content === 'scam' ? 'Scam' : content === 'genuine' ? 'Genuine' : content === 'suspicious' ? 'Suspicious' : 'Verdict pending';
  const traj = analysis?.trajectoryLabel || 'stable';
  const trajColor = traj === 'rising' ? Colors.danger : traj === 'falling' ? Colors.safe : Colors.textMuted;
  const trajIcon = traj === 'rising' ? 'trending-up' : traj === 'falling' ? 'trending-down' : 'trending-flat';
  const trajLabel = !ready ? 'LISTENING' : traj === 'rising' ? 'RISK UP' : traj === 'falling' ? 'RISK DOWN' : 'HOLDING';
  const source = analysis?.poweredByCore ? 'CORE' : analysis?.poweredByClaude ? 'CLAUDE' : 'ON-DEVICE';

  const dashOffset = arc.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRC, CIRC * 0.06],
  });
  const barWidth = bar.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-120, 380] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-40, 220] });
  const litTicks = useMemo(() => Math.round((score / 100) * TICKS), [score]);

  return (
    <View style={[styles.card, { borderColor: color + '70' }]}>
      <LinearGradient
        colors={[`rgba(${rgb.r},${rgb.g},${rgb.b},0.16)`, 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.bloom, { backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`, opacity: bloom }]}
      />
      <Animated.View pointerEvents="none" style={[styles.sheen, { transform: [{ translateX: sheenX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.14)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: 70 }}
        />
      </Animated.View>

      <View style={styles.cardHead}>
        <View style={styles.headLeft}>
          <Animated.View style={[styles.levelDot, { backgroundColor: color, opacity: ready ? 1 : listen }]} />
          <Text style={[styles.levelLabel, { color: ready ? color : Colors.primary }]}>
            {ready ? SentinelEngine.getThreatLabel(level) : 'LIVE VERDICT'}
          </Text>
          <View style={[styles.trajChip, { borderColor: trajColor + '55', backgroundColor: trajColor + '16' }]}>
            <MaterialIcons name={trajIcon as any} size={11} color={trajColor} />
            <Text style={[styles.trajText, { color: trajColor }]}>{trajLabel}</Text>
          </View>
        </View>
        {isAnalyzing ? (
          <View style={styles.analyzingBadge}>
            <Animated.View style={[styles.analyzingDot, { opacity: listen }]} />
            <Text style={styles.analyzingText}>REVISING</Text>
          </View>
        ) : (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{ready ? source : 'STANDBY'}</Text>
          </View>
        )}
      </View>

      <View style={styles.mainRow}>
        <View style={styles.ringWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                borderColor: color,
                opacity: halo.interpolate({ inputRange: [0.35, 1], outputRange: [0.12, 0.38] }),
                transform: [{ scale: halo.interpolate({ inputRange: [0.35, 1], outputRange: [0.92, 1.18] }) }],
              },
            ]}
          />
          <Orbit color={color} duration={5200} size={5} inset={4} />
          <Orbit color={color + 'AA'} duration={7800} size={3} inset={10} />
          {ready ? <SparkBurst trigger={analysis!.id} color={color} /> : null}

          <View style={styles.tickDisk} pointerEvents="none">
            {Array.from({ length: TICKS }).map((_, i) => {
              const on = i < litTicks;
              return (
                <View key={i} style={[styles.tickArm, { transform: [{ rotate: `${(i / TICKS) * 360}deg` }] }]}>
                  <View
                    style={[
                      styles.tick,
                      {
                        backgroundColor: on ? color : color + '26',
                        height: on ? 8 : 4,
                        opacity: on ? 1 : 0.7,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <Svg width={RING} height={RING} style={styles.svg}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={color + '22'}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={dashOffset}
              rotation="-90"
              origin={`${RING / 2}, ${RING / 2}`}
            />
          </Svg>
          <View style={[styles.ringCore, { borderColor: color + '55', backgroundColor: color + '12' }]}>
            <Text style={[styles.ringScore, { color }]}>{scoreText}</Text>
            <Text style={[styles.ringPct, { color: color + 'CC' }]}>risk</Text>
          </View>
        </View>

        <View style={styles.likelihoodCol}>
          <Animated.View style={[styles.likeCard, { borderColor: voiceColor + '55', transform: [{ scale: voicePop }] }]}>
            <LinearGradient
              colors={[voiceColor + '24', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialIcons name={voiceIcon as any} size={18} color={voiceColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.likeTitle, { color: voiceColor }]}>{voiceTitle}</Text>
              <Text style={styles.likeSub}>{ready ? analysis!.voiceLikelihoodLabel : 'Waiting for speech'}</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.likeCard, { borderColor: verdictColor + '55', transform: [{ scale: contentPop }] }]}>
            <LinearGradient
              colors={[verdictColor + '24', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialIcons name={verdictIcon as any} size={18} color={verdictColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.likeTitle, { color: verdictColor }]}>{verdictTitle}</Text>
              <Text style={styles.likeSub}>
                {ready ? analysis!.contentLikelihoodLabel : 'Verdict builds as the call continues'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.confTrack}>
        <Animated.View style={[styles.confFill, { width: barWidth, backgroundColor: verdictColor }]} />
        <Animated.View pointerEvents="none" style={[styles.confShine, { transform: [{ translateX: shimmerX }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: 48, height: 5 }}
          />
        </Animated.View>
      </View>

      {ready && analysis?.claudeReasoning ? (
        <Text style={styles.reason} numberOfLines={3}>{analysis.claudeReasoning}</Text>
      ) : null}

      <View style={styles.excerpt}>
        <Text style={ready && analysis?.chunkText ? styles.excerptText : styles.excerptMuted} numberOfLines={3}>
          {ready && analysis?.chunkText
            ? analysis.chunkText
            : 'Stay on this screen. The card revises in place as each window of speech is scored.'}
        </Text>
      </View>

      {ready && analysis && analysis.flags.length > 0 ? (
        <View style={styles.flags}>
          {analysis.flags.slice(0, 5).map(f => (
            <View key={f} style={[styles.flag, { borderColor: color + '44', backgroundColor: color + '14' }]}>
              <Text style={[styles.flagText, { color }]}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {ready && analysis?.scamType ? (
        <Text style={styles.scamType}>{analysis.scamType}</Text>
      ) : null}

      <Text style={styles.metaLine}>
        {ready && analysis
          ? `Window ${analysis.chunkIndex} · ${formatClock(analysis.atSeconds)} · ${analysis.wordsAnalyzed}w · running verdict`
          : 'No windows yet · listening on this phone'}
      </Text>
    </View>
  );
}

export function ChunkTileFeed({
  tiles,
  isAnalyzing,
}: {
  tiles: ChunkAnalysis[];
  isAnalyzing: boolean;
}) {
  return <LiveResultCard analysis={tiles[0] ?? null} isAnalyzing={isAnalyzing} />;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    gap: 14,
    overflow: 'hidden',
  },
  bloom: { ...StyleSheet.absoluteFillObject },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 70 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { fontSize: 13, fontWeight: FontWeight.extrabold, letterSpacing: 1.2 },
  trajChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  trajText: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.7 },
  sourceBadge: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  sourceText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.textMuted, letterSpacing: 0.8 },
  analyzingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningGlow, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.warning + '44',
  },
  analyzingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  analyzingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.warning, letterSpacing: 0.6 },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 2 },
  likelihoodCol: { flex: 1, gap: 8 },
  likeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1,
    overflow: 'hidden', backgroundColor: Colors.bgSurface,
  },
  likeTitle: { fontSize: 13, fontWeight: FontWeight.bold, lineHeight: 17 },
  likeSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },

  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5 },
  orbit: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  orbitDot: { position: 'absolute' },
  sparkLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  tickDisk: { ...StyleSheet.absoluteFillObject },
  tickArm: { position: 'absolute', width: RING, height: RING, alignItems: 'center' },
  tick: { width: 2, borderRadius: 1, marginTop: 3 },
  svg: { position: 'absolute' },
  ringCore: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  ringPct: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginTop: -2, textTransform: 'uppercase' },

  confTrack: { height: 5, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden', zIndex: 2 },
  confFill: { height: '100%', borderRadius: 3 },
  confShine: { position: 'absolute', top: 0, bottom: 0 },

  reason: { fontSize: 12, color: Colors.primary, lineHeight: 18, fontStyle: 'italic', zIndex: 2 },
  excerpt: {
    backgroundColor: Colors.bgSurface, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 11, zIndex: 2, minHeight: 52,
  },
  excerptText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  excerptMuted: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, zIndex: 2 },
  flag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  flagText: { fontSize: 10, fontWeight: FontWeight.semibold },
  scamType: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.danger, letterSpacing: 0.3, zIndex: 2 },
  metaLine: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium, letterSpacing: 0.2, zIndex: 2 },
});

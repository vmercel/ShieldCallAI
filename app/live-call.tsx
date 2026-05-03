import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { ThreatService } from '../services/threatService';
import { ThreatLevel } from '../constants/mockData';
import { useApp } from '../contexts/AppContext';

const CALLER = { name: 'Unknown Caller', number: '+1 (202) 555-0147', org: 'VoIP Service' };

const TRANSCRIPT_SCRIPT = [
  { role: 'caller', text: 'Hello, is this the account holder?', delay: 2000 },
  { role: 'caller', text: 'This is Officer Davis calling from the IRS regarding your tax account.', delay: 5000 },
  { role: 'caller', text: 'We have flagged your account for suspicious activity and need to verify your identity immediately.', delay: 9000 },
  { role: 'caller', text: 'You owe $4,200 in back taxes. Failure to pay today will result in your arrest.', delay: 13000 },
  { role: 'caller', text: 'You must pay using Google Play gift cards. Do you have access to a CVS or Walgreens nearby?', delay: 18000 },
];

function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function LiveCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ghostModeEnabled, personaName } = useApp();
  const [duration, setDuration] = useState(0);
  const [threatScore, setThreatScore] = useState(5);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('safe');
  const [flags, setFlags] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [ghostActive, setGhostActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scoreTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const transcriptRef = useRef<ScrollView>(null);

  const SCORE_TIMELINE = [
    { time: 3000, score: 15, level: 'safe' as ThreatLevel, flags: [] },
    { time: 6000, score: 32, level: 'safe' as ThreatLevel, flags: ['Government impersonation'] },
    { time: 10000, score: 58, level: 'warning' as ThreatLevel, flags: ['Government impersonation', 'Urgency escalation'] },
    { time: 14000, score: 79, level: 'danger' as ThreatLevel, flags: ['Government impersonation', 'Urgency escalation', 'Threat of legal action'] },
    { time: 19000, score: 94, level: 'danger' as ThreatLevel, flags: ['Government impersonation', 'Urgency escalation', 'Threat of legal action', 'Unusual payment method'] },
  ];

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);

    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]).start(pulsate);
    };
    pulsate();

    SCORE_TIMELINE.forEach(({ time, score, level, flags }) => {
      const t = setTimeout(() => {
        setThreatScore(score);
        setThreatLevel(level);
        setFlags(flags);
      }, time);
      scoreTimers.current.push(t);
    });

    TRANSCRIPT_SCRIPT.forEach(({ role, text, delay }) => {
      const t = setTimeout(() => {
        setTranscript(prev => [...prev, { role, text }]);
        setTimeout(() => transcriptRef.current?.scrollToEnd({ animated: true }), 100);
      }, delay);
      scoreTimers.current.push(t);
    });

    return () => {
      clearInterval(timer);
      scoreTimers.current.forEach(clearTimeout);
    };
  }, []);

  const threatColor = ThreatService.getThreatColor(threatLevel);
  const threatLabel = ThreatService.getThreatLabel(threatLevel);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Call</Text>
        <View style={styles.durationPill}>
          <View style={styles.recDot} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Caller Info */}
      <View style={styles.callerCard}>
        <Animated.View style={[styles.callerAvatarWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.callerAvatarRing, { borderColor: threatColor }]}>
            <View style={[styles.callerAvatar, { backgroundColor: threatColor + '22' }]}>
              <MaterialIcons name="person" size={32} color={threatColor} />
            </View>
          </View>
        </Animated.View>
        <Text style={styles.callerName}>{CALLER.name}</Text>
        <Text style={styles.callerNumber}>{CALLER.number}</Text>
        <Text style={styles.callerOrg}>{CALLER.org}</Text>
      </View>

      {/* Threat Meter */}
      <View style={[styles.threatCard, { borderColor: threatColor + '55' }]}>
        <View style={styles.threatRow}>
          <View style={styles.threatLeft}>
            <View style={[styles.threatDot, { backgroundColor: threatColor }]} />
            <Text style={[styles.threatLabel, { color: threatColor }]}>{threatLabel}</Text>
          </View>
          <Text style={[styles.threatScore, { color: threatColor }]}>{threatScore}<Text style={styles.threatScoreUnit}>%</Text></Text>
        </View>
        <View style={styles.meterTrack}>
          <Animated.View style={[styles.meterFill, { width: `${threatScore}%`, backgroundColor: threatColor }]} />
        </View>
        {flags.length > 0 && (
          <View style={styles.flagsRow}>
            {flags.map(f => (
              <View key={f} style={[styles.flagChip, { backgroundColor: threatColor + '18', borderColor: threatColor + '44' }]}>
                <MaterialIcons name="warning" size={10} color={threatColor} />
                <Text style={[styles.flagText, { color: threatColor }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.threatDesc}>{ThreatService.getThreatDescription(threatLevel, threatScore)}</Text>
      </View>

      {/* Ghost Mode Banner */}
      {ghostModeEnabled && !ghostActive && (
        <TouchableOpacity
          style={styles.ghostBanner}
          onPress={() => { setGhostActive(true); router.push('/ghost-mode'); }}
          activeOpacity={0.85}
        >
          <MaterialIcons name="hearing" size={20} color={Colors.primary} />
          <Text style={styles.ghostBannerText}>Activate Ghost Mode — let {personaName} handle this</Text>
          <MaterialIcons name="arrow-forward-ios" size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Live Transcript */}
      <Text style={styles.transcriptTitle}>Live Transcript</Text>
      <ScrollView
        ref={transcriptRef}
        style={styles.transcriptBox}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {transcript.length === 0 && (
          <Text style={styles.waitingText}>Waiting for audio...</Text>
        )}
        {transcript.map((line, i) => (
          <View key={i} style={styles.transcriptLine}>
            <View style={styles.transcriptRole}>
              <Text style={[styles.transcriptRoleText, { color: line.role === 'caller' ? Colors.warning : Colors.primary }]}>
                {line.role === 'caller' ? 'CALLER' : personaName.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.transcriptText}>{line.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Call Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <MaterialIcons name="volume-off" size={22} color={Colors.textSecondary} />
          <Text style={styles.actionLabel}>Mute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.endBtn]} onPress={() => router.back()} activeOpacity={0.85}>
          <MaterialIcons name="call-end" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/ghost-mode')} activeOpacity={0.8}>
          <MaterialIcons name="hearing" size={22} color={Colors.primary} />
          <Text style={[styles.actionLabel, { color: Colors.primary }]}>Ghost</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgCard, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  callerCard: { alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  callerAvatarWrap: { marginBottom: Spacing.sm },
  callerAvatarRing: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  callerAvatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  callerName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  callerNumber: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  callerOrg: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  threatCard: {
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1.5, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  threatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  threatLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  threatDot: { width: 10, height: 10, borderRadius: 5 },
  threatLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  threatScore: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  threatScoreUnit: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  meterTrack: { height: 6, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1,
  },
  flagText: { fontSize: 10, fontWeight: FontWeight.semibold },
  threatDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  ghostBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.borderStrong,
  },
  ghostBannerText: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primary },
  transcriptTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, paddingHorizontal: Spacing.md, marginBottom: 6, letterSpacing: 0.5 },
  transcriptBox: { flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  waitingText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
  transcriptLine: { gap: 4 },
  transcriptRole: {},
  transcriptRoleText: { fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn: { alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 16 },
  actionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  endBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', ...Shadow.danger,
  },
});

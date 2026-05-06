import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Animated,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useCallRecords } from '../../hooks/useCallRecords';
import { useCommunityThreats } from '../../hooks/useCommunityThreats';
import { SentinelEngine } from '../../services/sentinelEngine';

// ─── Live Threat Ticker ─────────────────────────────────────────────────────
function LiveThreatTicker({ threats }: { threats: { scam_type?: string; report_count: number; region: string; phone_number: string }[] }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (threats.length < 2) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % threats.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [threats.length]);

  if (threats.length === 0) return null;
  const alert = threats[index] || threats[0];

  return (
    <Animated.View style={[styles.ticker, { opacity: fadeAnim }]}>
      <View style={styles.tickerDot} />
      <Text style={styles.tickerText} numberOfLines={1}>
        <Text style={{ color: Colors.danger, fontWeight: FontWeight.bold }}>{alert.scam_type || 'Scam'} </Text>
        — {alert.report_count.toLocaleString()} reports · {alert.region}
      </Text>
    </Animated.View>
  );
}

// ─── SENTINEL Engine Demo ───────────────────────────────────────────────────
function SentinelDemo() {
  const engine = useRef(new SentinelEngine()).current;
  const [demoIndex, setDemoIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<'safe' | 'warning' | 'danger'>('safe');
  const [flags, setFlags] = useState<string[]>([]);
  const scoreAnim = useRef(new Animated.Value(0)).current;

  const DEMO_PHRASES = [
    'Hello, is this the account holder?',
    'This is Officer Davis from the IRS regarding your tax account.',
    'You owe $4,200 in back taxes. You must pay today or face arrest.',
    'You need to go buy Google Play gift cards immediately.',
  ];

  useEffect(() => { engine.reset(); }, []);

  const handleNext = () => {
    if (demoIndex >= DEMO_PHRASES.length) return;
    const phrase = DEMO_PHRASES[demoIndex];
    const window = engine.ingestSegment(phrase);
    setScore(window.score);
    setLevel(window.level);
    setFlags(window.flags);
    setDemoIndex(i => i + 1);
    Animated.timing(scoreAnim, { toValue: window.score, duration: 600, useNativeDriver: false }).start();
  };

  const color = SentinelEngine.getThreatColor(level);
  const meterWidth = scoreAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.demoCard}>
      <View style={styles.demoHeader}>
        <MaterialIcons name="security" size={18} color={Colors.primary} />
        <Text style={styles.demoTitle}>SENTINEL™ Live Demo</Text>
        <View style={[styles.demoLevelBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <View style={[styles.levelDot, { backgroundColor: color }]} />
          <Text style={[styles.demoLevelText, { color }]}>{SentinelEngine.getThreatLabel(level)}</Text>
        </View>
      </View>

      {demoIndex > 0 && (
        <View style={styles.demoPhrase}>
          <Text style={styles.demoPhraseLabel}>LAST ANALYZED</Text>
          <Text style={styles.demoPhraseText}>{DEMO_PHRASES[demoIndex - 1]}</Text>
        </View>
      )}

      <View style={styles.demoMeterRow}>
        <Text style={styles.demoMeterLabel}>Threat Score</Text>
        <View style={styles.demoMeterTrack}>
          <Animated.View style={[styles.demoMeterFill, { width: meterWidth, backgroundColor: color }]} />
        </View>
        <Text style={[styles.demoScore, { color }]}>{score}%</Text>
      </View>

      {flags.length > 0 && (
        <View style={styles.demoFlags}>
          {flags.map(f => (
            <View key={f} style={[styles.demoFlagChip, { borderColor: color + '55', backgroundColor: color + '18' }]}>
              <Text style={[styles.demoFlagText, { color }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {demoIndex < DEMO_PHRASES.length ? (
        <TouchableOpacity style={styles.demoBtn} onPress={handleNext} activeOpacity={0.85}>
          <MaterialIcons name="play-arrow" size={16} color={Colors.textInverse} />
          <Text style={styles.demoBtnText}>Analyze Next Statement ({demoIndex + 1}/{DEMO_PHRASES.length})</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.demoBtn, { backgroundColor: Colors.safe }]}
          onPress={() => { engine.reset(); setDemoIndex(0); setScore(0); setLevel('safe'); setFlags([]); scoreAnim.setValue(0); }}
          activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={16} color={Colors.textInverse} />
          <Text style={styles.demoBtnText}>Restart Demo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { ghostModeEnabled, personaName, setGhostMode } = useApp();
  const router = useRouter();
  const { calls, stats, loading } = useCallRecords();
  const { threats } = useCommunityThreats();

  const THREAT_COLORS = { safe: Colors.safe, warning: Colors.warning, danger: Colors.danger };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>CALLSHIELD</Text>
          <Text style={styles.headerSub}>SENTINEL™ AI Active</Text>
        </View>
        <View style={styles.headerStatus}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>PROTECTED</Text>
        </View>
      </View>

      {/* Live Threat Ticker — Real Data */}
      <LiveThreatTicker threats={threats} />

      {/* Shield Hero */}
      <View style={styles.shieldCard}>
        <Image
          source={require('../../assets/images/shield_hero.png')}
          style={styles.shieldImage}
          contentFit="contain"
          transition={200}
        />
        <View style={styles.shieldOverlay}>
          <Text style={styles.shieldTitle}>AI Protection Active</Text>
          {loading ? (
            <ActivityIndicator color={Colors.safe} size="small" />
          ) : (
            <>
              <Text style={styles.shieldSub}>{stats.scamsBlocked} threats blocked this month</Text>
              <View style={styles.shieldSavingsRow}>
                <MaterialIcons name="savings" size={14} color={Colors.safe} />
                <Text style={styles.shieldSavings}>${stats.estimatedSavings.toLocaleString()} estimated savings</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/live-call')}
        >
          <MaterialIcons name="security" size={20} color={Colors.bg} />
          <Text style={styles.quickTextDark}>Analyze Call</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickSecondary, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/ghost-mode')}
        >
          <MaterialIcons name="hearing" size={20} color={Colors.primary} />
          <Text style={styles.quickTextLight}>Ghost Mode</Text>
        </Pressable>
      </View>

      {/* Incoming Call Demo */}
      <Pressable
        style={({ pressed }) => [styles.incomingDemo, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/incoming-call', params: { callerNumber: '+1 (800) 555-0982', callerName: 'Unknown Caller' } })}
      >
        <View style={styles.incomingRing}>
          <MaterialIcons name="phone" size={16} color={Colors.safe} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.incomingDemoTitle}>Simulate Incoming Call</Text>
          <Text style={styles.incomingDemoSub}>See SENTINEL™ pre-screen + Ghost Mode in action</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
      </Pressable>

      {/* SENTINEL Live Demo */}
      <SentinelDemo />

      {/* Ghost Toggle */}
      <View style={styles.ghostCard}>
        <View style={styles.ghostLeft}>
          <View style={[styles.ghostIcon, { backgroundColor: ghostModeEnabled ? Colors.primaryGlow : Colors.bgSurface }]}>
            <MaterialIcons name="hearing" size={22} color={ghostModeEnabled ? Colors.primary : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ghostTitle}>Ghost Mode</Text>
            <Text style={styles.ghostSub}>
              {ghostModeEnabled
                ? `"${personaName}" answers + SENTINEL™ + OnSpace AI responds in real-time`
                : 'AI answers suspicious calls while you listen silently'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setGhostMode(!ghostModeEnabled)}
          style={[styles.toggle, ghostModeEnabled && styles.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[styles.toggleThumb, ghostModeEnabled && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* Real Stats */}
      <Text style={styles.sectionTitle}>Shield Report</Text>
      {loading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      ) : (
        <View style={styles.statsRow}>
          {[
            { icon: 'shield', val: stats.scamsBlocked, label: 'Threats\nBlocked', color: Colors.safe, glow: Colors.safeGlow },
            { icon: 'hearing', val: stats.ghostModeCalls, label: 'Ghost\nHandled', color: Colors.primary, glow: Colors.primaryGlow },
            { icon: 'call', val: stats.totalCalls, label: 'Total\nCalls', color: Colors.warning, glow: Colors.warningGlow },
          ].map(item => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: item.glow, borderColor: item.color + '44' }]}>
              <MaterialIcons name={item.icon as any} size={26} color={item.color} />
              <Text style={[styles.statNum, { color: item.color }]}>{item.val}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Community Threat Feed — Real Data */}
      {threats.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Live Threat Feed</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/insights')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {threats.slice(0, 3).map(alert => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertType}>{alert.scam_type || 'Suspicious Activity'}</Text>
                <Text style={styles.alertNum}>{alert.phone_number} · {alert.region}</Text>
              </View>
              <View style={styles.alertBadge}>
                <Text style={styles.alertCount}>{alert.report_count.toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Recent Calls — Real Data */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent Calls</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/calls')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={Colors.primary} size="small" />
        </View>
      ) : calls.length === 0 ? (
        <View style={styles.noCallsCard}>
          <MaterialIcons name="phone-missed" size={28} color={Colors.textMuted} />
          <Text style={styles.noCallsText}>No calls analyzed yet</Text>
          <Text style={styles.noCallsSub}>Calls analyzed by SENTINEL™ will appear here</Text>
        </View>
      ) : (
        calls.slice(0, 3).map(call => {
          const color = THREAT_COLORS[call.threat_level];
          const startedAt = new Date(call.started_at);
          const minsAgo = Math.round(Math.abs(Date.now() - startedAt.getTime()) / 60000);
          return (
            <TouchableOpacity
              key={call.id}
              style={styles.callCard}
              onPress={() => router.push({ pathname: '/call-detail', params: { id: call.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.callAvatar, { borderColor: color }]}>
                <MaterialIcons name={call.ghost_handled ? 'hearing' : 'person'} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.callName}>{call.caller_name}</Text>
                <Text style={styles.callMeta}>
                  {minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`}
                  {call.ghost_handled ? '  ·  Ghost handled' : ''}
                </Text>
              </View>
              <View style={[styles.threatTag, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <Text style={[styles.threatTagText, { color }]}>
                  {call.threat_level === 'danger' ? 'HIGH RISK' : call.threat_level === 'warning' ? 'SUSPICIOUS' : 'SAFE'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  headerLabel: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 2 },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  headerStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.safeGlow, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.safe + '55',
  },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.safe },
  activeText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.safe, letterSpacing: 1 },

  ticker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.dangerGlow + '80', marginBottom: Spacing.md,
  },
  tickerDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.danger },
  tickerText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },

  shieldCard: {
    borderRadius: Radius.xl, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    overflow: 'hidden', height: 190, marginBottom: Spacing.md,
    alignItems: 'center', justifyContent: 'flex-end', ...Shadow.primary,
  },
  shieldImage: { position: 'absolute', width: '100%', height: '100%', opacity: 0.8 },
  shieldOverlay: { width: '100%', padding: Spacing.md, backgroundColor: 'rgba(6,14,30,0.65)' },
  shieldTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  shieldSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  shieldSavingsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  shieldSavings: { fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.semibold },

  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: Radius.md,
  },
  quickPrimary: { backgroundColor: Colors.primary, ...Shadow.primary },
  quickSecondary: { backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong },
  quickTextDark: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  quickTextLight: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },

  demoCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderStrong, marginBottom: Spacing.md, gap: Spacing.sm,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  demoTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  demoLevelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1,
  },
  levelDot: { width: 7, height: 7, borderRadius: 3.5 },
  demoLevelText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 0.5 },
  demoPhrase: { backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: Spacing.sm, gap: 3 },
  demoPhraseLabel: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.textMuted, letterSpacing: 0.8 },
  demoPhraseText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },
  demoMeterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  demoMeterLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 72 },
  demoMeterTrack: { flex: 1, height: 6, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  demoMeterFill: { height: '100%', borderRadius: 3 },
  demoScore: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, width: 36, textAlign: 'right' },
  demoFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  demoFlagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  demoFlagText: { fontSize: 10, fontWeight: FontWeight.semibold },
  demoBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  demoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },

  incomingDemo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.safe + '44', marginBottom: Spacing.md,
  },
  incomingRing: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.safeGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.safe + '55',
  },
  incomingDemoTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  incomingDemoSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  ghostCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    flexDirection: 'row', alignItems: 'center',
  },
  ghostLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ghostIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  ghostTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  ghostSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  toggle: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: Colors.bgSurface,
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', padding: 3,
  },
  toggleOn: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textMuted },
  toggleThumbOn: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },

  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  statsLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 3, lineHeight: 16 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.dangerGlow + '80',
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  alertType: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  alertNum: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  alertBadge: {
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  alertCount: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.bold },

  noCallsCard: {
    alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  noCallsText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  noCallsSub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  callAvatar: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 2, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  callName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  callMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  threatTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  threatTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});

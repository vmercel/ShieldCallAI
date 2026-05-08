/**
 * CALLSHIELD Shield Screen — Home
 *
 * 100% real data. No simulations, no mocks, no demos.
 *
 * Data sources:
 * - Call records: Supabase call_records table (via useCallRecords)
 * - Community threats: Supabase community_threats table (via useCommunityThreats)
 * - Ghost mode / persona: AppContext (AsyncStorage backed)
 * - All stats computed from real records
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCallRecords } from '../../hooks/useCallRecords';
import { useCommunityThreats } from '../../hooks/useCommunityThreats';

// ─── Live Threat Ticker ────────────────────────────────────────────────────────
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
    }, 3500);
    return () => clearInterval(interval);
  }, [threats.length]);

  if (threats.length === 0) return null;
  const alert = threats[index] || threats[0];

  return (
    <Animated.View style={[styles.ticker, { opacity: fadeAnim }]}>
      <View style={styles.tickerDot} />
      <Text style={styles.tickerText} numberOfLines={1}>
        <Text style={{ color: Colors.danger, fontWeight: FontWeight.bold }}>
          {alert.scam_type || 'Unknown Scam'}
        </Text>
        {' '}— {alert.report_count.toLocaleString()} community reports · {alert.region}
      </Text>
    </Animated.View>
  );
}

// ─── SENTINEL™ Intelligence Panel ─────────────────────────────────────────────
// Shows real threat analytics derived from call_records
function SentinelIntelligencePanel({ stats, calls }: {
  stats: {
    totalCalls: number;
    scamsBlocked: number;
    ghostModeCalls: number;
    estimatedSavings: number;
    topScamTypes: { type: string; count: number }[];
    safeCallsPercent: number;
  };
  calls: any[];
}) {
  const dangerCalls = calls.filter(c => c.threat_level === 'danger');
  const warnCalls = calls.filter(c => c.threat_level === 'warning');
  const safeCalls = calls.filter(c => c.threat_level === 'safe');
  const peakScore = calls.length > 0 ? Math.max(...calls.map(c => c.threat_score)) : 0;
  const topScam = stats.topScamTypes[0];

  if (calls.length === 0) {
    return (
      <View style={styles.intelCard}>
        <View style={styles.intelHeader}>
          <MaterialIcons name="security" size={16} color={Colors.primary} />
          <Text style={styles.intelTitle}>SENTINEL™ Intelligence</Text>
          <View style={styles.intelLiveBadge}>
            <View style={styles.intelLiveDot} />
            <Text style={styles.intelLiveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.intelEmpty}>
          <MaterialIcons name="phone-missed" size={32} color={Colors.textMuted} />
          <Text style={styles.intelEmptyTitle}>No Calls Analyzed Yet</Text>
          <Text style={styles.intelEmptySub}>
            Start a call analysis to see SENTINEL™ threat intelligence here. Data updates in real-time after each call.
          </Text>
        </View>
      </View>
    );
  }

  const total = calls.length || 1;
  const dangerPct = Math.round((dangerCalls.length / total) * 100);
  const warnPct = Math.round((warnCalls.length / total) * 100);
  const safePct = 100 - dangerPct - warnPct;

  return (
    <View style={styles.intelCard}>
      <View style={styles.intelHeader}>
        <MaterialIcons name="security" size={16} color={Colors.primary} />
        <Text style={styles.intelTitle}>SENTINEL™ Intelligence</Text>
        <View style={styles.intelLiveBadge}>
          <View style={styles.intelLiveDot} />
          <Text style={styles.intelLiveText}>LIVE</Text>
        </View>
      </View>

      {/* Threat Breakdown Bar */}
      <View style={styles.intelBreakdown}>
        <Text style={styles.intelBreakdownLabel}>Threat Distribution · {calls.length} calls analyzed</Text>
        <View style={styles.intelBar}>
          {dangerPct > 0 && (
            <View style={[styles.intelBarSeg, { flex: dangerPct, backgroundColor: Colors.danger }]} />
          )}
          {warnPct > 0 && (
            <View style={[styles.intelBarSeg, { flex: warnPct, backgroundColor: Colors.warning }]} />
          )}
          {safePct > 0 && (
            <View style={[styles.intelBarSeg, { flex: Math.max(safePct, 2), backgroundColor: Colors.safe }]} />
          )}
        </View>
        <View style={styles.intelBarLegend}>
          <View style={styles.intelLegendItem}>
            <View style={[styles.intelLegendDot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.intelLegendText}>High {dangerPct}%</Text>
          </View>
          <View style={styles.intelLegendItem}>
            <View style={[styles.intelLegendDot, { backgroundColor: Colors.warning }]} />
            <Text style={styles.intelLegendText}>Suspicious {warnPct}%</Text>
          </View>
          <View style={styles.intelLegendItem}>
            <View style={[styles.intelLegendDot, { backgroundColor: Colors.safe }]} />
            <Text style={styles.intelLegendText}>Safe {safePct}%</Text>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.intelMetrics}>
        <View style={styles.intelMetric}>
          <Text style={[styles.intelMetricVal, { color: Colors.danger }]}>{peakScore}%</Text>
          <Text style={styles.intelMetricLabel}>Peak Threat{'\n'}Score Recorded</Text>
        </View>
        <View style={[styles.intelMetricDivider]} />
        <View style={styles.intelMetric}>
          <Text style={[styles.intelMetricVal, { color: Colors.safe }]}>{stats.safeCallsPercent}%</Text>
          <Text style={styles.intelMetricLabel}>Calls{'\n'}Verified Safe</Text>
        </View>
        <View style={[styles.intelMetricDivider]} />
        <View style={styles.intelMetric}>
          <Text style={[styles.intelMetricVal, { color: Colors.primary }]}>{stats.ghostModeCalls}</Text>
          <Text style={styles.intelMetricLabel}>Ghost AI{'\n'}Interventions</Text>
        </View>
      </View>

      {/* Top Scam Type */}
      {topScam && (
        <View style={styles.intelTopScam}>
          <MaterialIcons name="local-police" size={14} color={Colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.intelTopScamLabel}>Most Common Threat Detected</Text>
            <Text style={styles.intelTopScamVal}>{topScam.type}</Text>
          </View>
          <View style={styles.intelTopScamCount}>
            <Text style={styles.intelTopScamCountText}>{topScam.count}×</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Protection Status Card ───────────────────────────────────────────────────
function ProtectionStatusCard({ stats, loading }: {
  stats: { scamsBlocked: number; estimatedSavings: number; totalCalls: number };
  loading: boolean;
}) {
  return (
    <View style={styles.shieldCard}>
      <Image
        source={require('../../assets/images/shield_hero.png')}
        style={styles.shieldImage}
        contentFit="contain"
        transition={200}
      />
      <View style={styles.shieldOverlay}>
        <View style={styles.shieldTitleRow}>
          <Text style={styles.shieldTitle}>AI Protection Active</Text>
          <View style={styles.shieldLiveBadge}>
            <View style={styles.shieldLiveDot} />
            <Text style={styles.shieldLiveText}>REAL-TIME</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={Colors.safe} size="small" style={{ marginTop: 4 }} />
        ) : (
          <>
            <Text style={styles.shieldSub}>
              {stats.scamsBlocked > 0
                ? `${stats.scamsBlocked} threat${stats.scamsBlocked !== 1 ? 's' : ''} intercepted · ${stats.totalCalls} calls analyzed`
                : 'SENTINEL™ is monitoring all calls'}
            </Text>
            {stats.estimatedSavings > 0 && (
              <View style={styles.shieldSavingsRow}>
                <MaterialIcons name="savings" size={13} color={Colors.safe} />
                <Text style={styles.shieldSavings}>
                  ${stats.estimatedSavings.toLocaleString()} estimated losses prevented
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Community Threat Intelligence ────────────────────────────────────────────
function CommunityThreatSection({
  threats,
  loading,
  onViewAll,
}: {
  threats: any[];
  loading: boolean;
  onViewAll: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.communityLoadWrap}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={styles.communityLoadText}>Loading threat intelligence...</Text>
      </View>
    );
  }

  if (threats.length === 0) {
    return (
      <View style={styles.communityEmpty}>
        <MaterialIcons name="verified-user" size={24} color={Colors.safe} />
        <Text style={styles.communityEmptyText}>No active community threats reported</Text>
      </View>
    );
  }

  return (
    <>
      {threats.slice(0, 4).map(alert => {
        const isHigh = alert.report_count >= 100;
        const isMed = alert.report_count >= 20;
        const color = isHigh ? Colors.danger : isMed ? Colors.warning : Colors.textMuted;
        return (
          <View key={alert.id} style={[styles.alertCard, { borderColor: color + '33' }]}>
            <View style={[styles.alertDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertType} numberOfLines={1}>
                {alert.scam_type || 'Suspicious Activity'}
              </Text>
              <Text style={styles.alertNum}>
                {alert.phone_number} · {alert.region}
              </Text>
            </View>
            <View style={[styles.alertBadge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
              <Text style={[styles.alertCount, { color }]}>{alert.report_count.toLocaleString()}</Text>
            </View>
          </View>
        );
      })}
      {threats.length > 4 && (
        <TouchableOpacity onPress={onViewAll} style={styles.viewMoreBtn} activeOpacity={0.8}>
          <Text style={styles.viewMoreText}>+{threats.length - 4} more threats · View in Insights</Text>
          <MaterialIcons name="chevron-right" size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { ghostModeEnabled, personaName, setGhostMode } = useApp();
  const { profile } = useAuth();
  const router = useRouter();
  const { calls, stats, loading, refresh } = useCallRecords();
  const { threats, loading: threatsLoading } = useCommunityThreats();
  const [refreshing, setRefreshing] = useState(false);

  const THREAT_COLORS = { safe: Colors.safe, warning: Colors.warning, danger: Colors.danger };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const firstName = profile?.full_name?.split(' ')[0] ?? profile?.username ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>CALLSHIELD</Text>
          <Text style={styles.headerSub}>
            {firstName ? `Welcome back, ${firstName}` : 'SENTINEL™ AI Active'}
          </Text>
        </View>
        <View style={styles.headerStatus}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>PROTECTED</Text>
        </View>
      </View>

      {/* Live Threat Ticker — Real Community Data */}
      <LiveThreatTicker threats={threats} />

      {/* Protection Status — Real stats only */}
      <ProtectionStatusCard stats={stats} loading={loading} />

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/live-call')}
        >
          <MaterialIcons name="security" size={20} color={Colors.bg} />
          <Text style={styles.quickTextDark}>Live Call Analysis</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickSecondary, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/ghost-mode')}
        >
          <MaterialIcons name="hearing" size={20} color={Colors.primary} />
          <Text style={styles.quickTextLight}>Ghost Mode</Text>
        </Pressable>
      </View>

      {/* SENTINEL™ Intelligence — Real Analytics from Call Records */}
      <SentinelIntelligencePanel stats={stats} calls={calls} />

      {/* Ghost Mode Toggle */}
      <View style={styles.ghostCard}>
        <View style={styles.ghostLeft}>
          <View style={[styles.ghostIcon, { backgroundColor: ghostModeEnabled ? Colors.primaryGlow : Colors.bgSurface }]}>
            <MaterialIcons name="hearing" size={22} color={ghostModeEnabled ? Colors.primary : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ghostTitle}>Ghost Mode</Text>
            <Text style={styles.ghostSub}>
              {ghostModeEnabled
                ? `"${personaName}" is answering suspicious calls automatically via OnSpace AI`
                : 'AI answers suspicious calls while you listen silently in real-time'}
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

      {/* Shield Report — Real Stats */}
      <Text style={styles.sectionTitle}>Shield Report</Text>
      {loading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
        <View style={styles.statsRow}>
          {[
            { icon: 'shield', val: stats.scamsBlocked, label: 'Threats\nBlocked', color: Colors.safe, glow: Colors.safeGlow },
            { icon: 'hearing', val: stats.ghostModeCalls, label: 'Ghost AI\nInterventions', color: Colors.primary, glow: Colors.primaryGlow },
            { icon: 'call', val: stats.totalCalls, label: 'Calls\nAnalyzed', color: Colors.warning, glow: Colors.warningGlow },
          ].map(item => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: item.glow, borderColor: item.color + '44' }]}>
              <MaterialIcons name={item.icon as any} size={26} color={item.color} />
              <Text style={[styles.statNum, { color: item.color }]}>{item.val}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Savings Card — only show when there's real data */}
      {!loading && stats.estimatedSavings > 0 && (
        <View style={styles.savingsCard}>
          <View style={styles.savingsIconWrap}>
            <MaterialIcons name="account-balance-wallet" size={22} color={Colors.safe} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.savingsTitle}>
              ${stats.estimatedSavings.toLocaleString()} Prevented
            </Text>
            <Text style={styles.savingsSub}>
              Based on FTC avg. fraud loss: $700/high-risk · $200/suspicious call
            </Text>
          </View>
        </View>
      )}

      {/* Community Threat Feed — Real Data */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Community Threat Intelligence</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/insights')}>
          <Text style={styles.seeAll}>View All</Text>
        </TouchableOpacity>
      </View>
      <CommunityThreatSection
        threats={threats}
        loading={threatsLoading}
        onViewAll={() => router.push('/(tabs)/insights')}
      />

      {/* Recent Calls — Real Data */}
      <View style={[styles.sectionRow, { marginTop: Spacing.lg }]}>
        <Text style={styles.sectionTitle}>Recent Calls</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/calls')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading calls...</Text>
        </View>
      ) : calls.length === 0 ? (
        <View style={styles.noCallsCard}>
          <MaterialIcons name="phone-missed" size={28} color={Colors.textMuted} />
          <Text style={styles.noCallsText}>No calls analyzed yet</Text>
          <Text style={styles.noCallsSub}>
            Tap "Live Call Analysis" to start SENTINEL™ monitoring on your next call
          </Text>
        </View>
      ) : (
        calls.slice(0, 4).map(call => {
          const color = THREAT_COLORS[call.threat_level as keyof typeof THREAT_COLORS];
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
                <MaterialIcons
                  name={call.ghost_handled ? 'hearing' : call.threat_level === 'danger' ? 'warning' : 'person'}
                  size={20} color={color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.callName} numberOfLines={1}>{call.caller_name}</Text>
                <Text style={styles.callMeta}>
                  {minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`}
                  {call.ghost_handled ? '  ·  Ghost handled' : ''}
                  {call.scam_type ? `  ·  ${call.scam_type}` : ''}
                </Text>
              </View>
              <View style={[styles.threatTag, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <View style={[styles.threatDot, { backgroundColor: color }]} />
                <Text style={[styles.threatTagText, { color }]}>
                  {call.threat_level === 'danger' ? 'HIGH RISK' : call.threat_level === 'warning' ? 'SUSPICIOUS' : 'SAFE'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Top Scam Types from Real Data */}
      {!loading && stats.topScamTypes.length > 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Scam Pattern Analysis</Text>
          <View style={styles.scamPatternCard}>
            {stats.topScamTypes.map((item, i) => {
              const maxCount = stats.topScamTypes[0].count;
              const pct = Math.round((item.count / maxCount) * 100);
              const colors = [Colors.danger, Colors.warning, Colors.primary, Colors.textSecondary];
              const barColor = colors[Math.min(i, colors.length - 1)];
              return (
                <View key={item.type} style={styles.scamPatternRow}>
                  <Text style={styles.scamPatternType} numberOfLines={1}>{item.type}</Text>
                  <View style={styles.scamPatternBarWrap}>
                    <View style={[styles.scamPatternBar, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.scamPatternCount, { color: barColor }]}>{item.count}×</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
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

  // Shield Card
  shieldCard: {
    borderRadius: Radius.xl, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderStrong,
    overflow: 'hidden', height: 180, marginBottom: Spacing.md,
    alignItems: 'center', justifyContent: 'flex-end', ...Shadow.primary,
  },
  shieldImage: { position: 'absolute', width: '100%', height: '100%', opacity: 0.8 },
  shieldOverlay: { width: '100%', padding: Spacing.md, backgroundColor: 'rgba(6,14,30,0.65)', gap: 5 },
  shieldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shieldTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, flex: 1 },
  shieldLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.safe + '44',
  },
  shieldLiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.safe },
  shieldLiveText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.safe, letterSpacing: 1 },
  shieldSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  shieldSavingsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shieldSavings: { fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.semibold },

  // Quick Actions
  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md,
  },
  quickPrimary: { backgroundColor: Colors.primary, ...Shadow.primary },
  quickSecondary: { backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong },
  quickTextDark: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  quickTextLight: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  // SENTINEL Intelligence Panel
  intelCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderStrong, marginBottom: Spacing.md, gap: Spacing.md,
  },
  intelHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  intelTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  intelLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  intelLiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.primary },
  intelLiveText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 1 },
  intelEmpty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  intelEmptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  intelEmptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  intelBreakdown: { gap: 8 },
  intelBreakdownLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  intelBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  intelBarSeg: { borderRadius: 5 },
  intelBarLegend: { flexDirection: 'row', gap: Spacing.md },
  intelLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  intelLegendDot: { width: 8, height: 8, borderRadius: 4 },
  intelLegendText: { fontSize: 11, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  intelMetrics: {
    flexDirection: 'row', backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md, padding: Spacing.md, gap: 0,
  },
  intelMetric: { flex: 1, alignItems: 'center', gap: 4 },
  intelMetricVal: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  intelMetricLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },
  intelMetricDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  intelTopScam: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.danger + '33',
  },
  intelTopScamLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.semibold, letterSpacing: 0.3 },
  intelTopScamVal: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: FontWeight.bold, marginTop: 2 },
  intelTopScamCount: {
    backgroundColor: Colors.danger + '22', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  intelTopScamCountText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: FontWeight.extrabold },

  // Ghost Card
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

  // Shield Report
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  statsLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 3, lineHeight: 16 },

  // Savings Card
  savingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.safe + '44', marginBottom: Spacing.md,
  },
  savingsIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.safe + '22', alignItems: 'center', justifyContent: 'center',
  },
  savingsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.safe },
  savingsSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },

  // Community Threats
  communityLoadWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  communityLoadText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  communityEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.safe + '44',
    marginBottom: Spacing.md,
  },
  communityEmptyText: { fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.medium },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertType: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  alertNum: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  alertBadge: {
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  alertCount: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  viewMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
  },
  viewMoreText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },

  // Recent Calls
  noCallsCard: {
    alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  noCallsText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  noCallsSub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

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
  threatTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1,
  },
  threatDot: { width: 5, height: 5, borderRadius: 2.5 },
  threatTagText: { fontSize: 10, fontWeight: FontWeight.bold },

  // Scam Pattern Analysis
  scamPatternCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  scamPatternRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scamPatternType: { fontSize: FontSize.sm, color: Colors.textSecondary, width: 110 },
  scamPatternBarWrap: { flex: 1, height: 8, backgroundColor: Colors.bgSurface, borderRadius: 4, overflow: 'hidden' },
  scamPatternBar: { height: '100%', borderRadius: 4 },
  scamPatternCount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, width: 28, textAlign: 'right' },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { MOCK_CALLS, MOCK_SCAM_ALERTS, MOCK_STATS } from '../../constants/mockData';
import { ThreatService } from '../../services/threatService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { ghostModeEnabled, personaName, setGhostMode } = useApp();
  const router = useRouter();
  const [ghostPulse, setGhostPulse] = useState(false);

  const recentDanger = MOCK_CALLS.filter(c => c.threatLevel === 'danger').length;
  const totalToday = MOCK_CALLS.filter(c => {
    const diff = Date.now() - c.timestamp.getTime();
    return diff < 86400000;
  }).length;

  const handleSimulateCall = () => {
    router.push('/live-call');
  };

  const handleGhostToggle = async () => {
    setGhostPulse(true);
    await setGhostMode(!ghostModeEnabled);
    setTimeout(() => setGhostPulse(false), 600);
  };

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
          <Text style={styles.headerSub}>AI Communications Agent</Text>
        </View>
        <View style={styles.headerStatus}>
          <View style={styles.activeIndicator} />
          <Text style={styles.activeText}>ACTIVE</Text>
        </View>
      </View>

      {/* Shield Hero */}
      <View style={styles.shieldCard}>
        <Image
          source={require('../../assets/images/shield_hero.png')}
          style={styles.shieldHeroImage}
          contentFit="contain"
          transition={200}
        />
        <View style={styles.shieldOverlay}>
          <Text style={styles.shieldProtecting}>Protected</Text>
          <Text style={styles.shieldStats}>{MOCK_STATS.scamsBlocked} scams blocked this month</Text>
          <View style={styles.shieldSavings}>
            <MaterialIcons name="savings" size={16} color={Colors.safe} />
            <Text style={styles.shieldSavingsText}>${MOCK_STATS.estimatedSavings.toLocaleString()} estimated savings</Text>
          </View>
        </View>
      </View>

      {/* Quick Action Row */}
      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickBtnPrimary, pressed && { opacity: 0.85 }]}
          onPress={handleSimulateCall}
        >
          <MaterialIcons name="phone" size={22} color={Colors.bg} />
          <Text style={styles.quickBtnTextDark}>Simulate Call</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickBtnSecondary, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/ghost-mode')}
        >
          <MaterialIcons name="hearing" size={22} color={Colors.primary} />
          <Text style={styles.quickBtnTextLight}>Ghost Mode</Text>
        </Pressable>
      </View>

      {/* Ghost Mode Toggle */}
      <View style={styles.ghostCard}>
        <View style={styles.ghostInfo}>
          <View style={styles.ghostIconWrap}>
            <MaterialIcons name="hearing" size={24} color={ghostModeEnabled ? Colors.primary : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ghostTitle}>Ghost Mode</Text>
            <Text style={styles.ghostSub}>
              {ghostModeEnabled
                ? `"${personaName}" answers suspicious calls for you`
                : 'Enable to have AI answer suspicious calls'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleGhostToggle} style={[styles.toggleTrack, ghostModeEnabled && styles.toggleTrackOn]} activeOpacity={0.8}>
          <View style={[styles.toggleThumb, ghostModeEnabled && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* Stat Cards */}
      <Text style={styles.sectionTitle}>Today's Activity</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardSafe]}>
          <MaterialIcons name="shield" size={28} color={Colors.safe} />
          <Text style={[styles.statNum, { color: Colors.safe }]}>{MOCK_STATS.scamsBlocked}</Text>
          <Text style={styles.statLabel}>Threats{'\n'}Blocked</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <MaterialIcons name="hearing" size={28} color={Colors.primary} />
          <Text style={[styles.statNum, { color: Colors.primary }]}>{MOCK_STATS.ghostModeCalls}</Text>
          <Text style={styles.statLabel}>Ghost{'\n'}Handled</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <MaterialIcons name="call" size={28} color={Colors.warning} />
          <Text style={[styles.statNum, { color: Colors.warning }]}>{totalToday}</Text>
          <Text style={styles.statLabel}>Total{'\n'}Calls</Text>
        </View>
      </View>

      {/* Community Threat Feed */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Community Threat Feed</Text>
        <TouchableOpacity onPress={() => router.push('/calls')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      {MOCK_SCAM_ALERTS.slice(0, 3).map(alert => (
        <View key={alert.id} style={styles.alertCard}>
          <View style={styles.alertDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertType}>{alert.scamType}</Text>
            <Text style={styles.alertNumber}>{alert.number} · {alert.region}</Text>
          </View>
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{alert.reportCount.toLocaleString()} reports</Text>
          </View>
        </View>
      ))}

      {/* Recent Calls Preview */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent Calls</Text>
        <TouchableOpacity onPress={() => router.push('/calls')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      {MOCK_CALLS.slice(0, 3).map(call => {
        const color = ThreatService.getThreatColor(call.threatLevel);
        const label = ThreatService.getThreatLabel(call.threatLevel);
        const mins = Math.floor(call.timestamp.getTime() - Date.now());
        const agoMin = Math.round(Math.abs(mins) / 60000);
        return (
          <TouchableOpacity
            key={call.id}
            style={styles.callCard}
            onPress={() => router.push({ pathname: '/call-detail', params: { id: call.id } })}
            activeOpacity={0.8}
          >
            <View style={[styles.callAvatar, { borderColor: color }]}>
              <MaterialIcons
                name={call.ghostHandled ? 'hearing' : 'person'}
                size={22}
                color={color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.callName}>{call.callerName}</Text>
              <Text style={styles.callTime}>
                {agoMin < 60 ? `${agoMin}m ago` : `${Math.round(agoMin / 60)}h ago`}
                {call.ghostHandled ? '  ·  Ghost handled' : ''}
              </Text>
            </View>
            <View style={[styles.threatTag, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[styles.threatTagText, { color }]}>{label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerLabel: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: 2,
  },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  headerStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.safeGlow, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.safe + '55',
  },
  activeIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.safe },
  activeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.safe, letterSpacing: 1 },

  shieldCard: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Shadow.primary,
  },
  shieldHeroImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  shieldOverlay: {
    width: '100%',
    padding: Spacing.lg,
    backgroundColor: 'rgba(6,14,30,0.6)',
  },
  shieldProtecting: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.text },
  shieldStats: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  shieldSavings: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  shieldSavingsText: { fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.semibold },

  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md,
  },
  quickBtnPrimary: { backgroundColor: Colors.primary, ...Shadow.primary },
  quickBtnSecondary: {
    backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong,
  },
  quickBtnTextDark: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  quickBtnTextLight: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },

  ghostCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    flexDirection: 'row', alignItems: 'center',
  },
  ghostInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ghostIconWrap: {
    width: 44, height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
  },
  ghostTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  ghostSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  toggleTrack: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: Colors.bgSurface,
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', padding: 3,
  },
  toggleTrackOn: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textMuted },
  toggleThumbOn: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },

  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1,
  },
  statCardSafe: { backgroundColor: Colors.safeGlow, borderColor: Colors.safe + '44' },
  statCardPrimary: { backgroundColor: Colors.primaryGlow, borderColor: Colors.border },
  statCardWarning: { backgroundColor: Colors.warningGlow, borderColor: Colors.warning + '44' },
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, marginTop: 6 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.dangerGlow + '80',
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  alertType: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  alertNumber: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  alertBadge: {
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  alertBadgeText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.bold },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  callAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  callName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  callTime: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  threatTag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1,
  },
  threatTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});

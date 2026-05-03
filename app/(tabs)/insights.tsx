import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { MOCK_STATS, MOCK_CALLS } from '../../constants/mockData';
import { ThreatService } from '../../services/threatService';

const MONTH = 'May 2026';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();

  const handleShare = async () => {
    try {
      await Share.share({
        message: `CALLSHIELD protected me from ${MOCK_STATS.scamsBlocked} scam attempts this month, worth an estimated $${MOCK_STATS.estimatedSavings.toLocaleString()} in potential losses. 🛡️ callshield.ai`,
      });
    } catch {}
  };

  const safeCount = MOCK_CALLS.filter(c => c.threatLevel === 'safe').length;
  const dangerCount = MOCK_CALLS.filter(c => c.threatLevel === 'danger').length;
  const warnCount = MOCK_CALLS.filter(c => c.threatLevel === 'warning').length;
  const total = MOCK_CALLS.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.month}>{MONTH}</Text>
      </View>

      {/* Personal Fraud Report Card */}
      <View style={styles.reportCard}>
        <View style={styles.reportTop}>
          <View style={styles.reportIconWrap}>
            <MaterialIcons name="shield" size={32} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Personal Fraud Report</Text>
            <Text style={styles.reportSub}>Your protection summary for {MONTH}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.8}>
            <MaterialIcons name="share" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.reportDivider} />

        <View style={styles.reportStats}>
          <View style={styles.reportStat}>
            <Text style={[styles.reportStatNum, { color: Colors.danger }]}>{MOCK_STATS.scamsBlocked}</Text>
            <Text style={styles.reportStatLabel}>Scams{'\n'}Blocked</Text>
          </View>
          <View style={styles.reportStatDivider} />
          <View style={styles.reportStat}>
            <Text style={[styles.reportStatNum, { color: Colors.safe }]}>${MOCK_STATS.estimatedSavings.toLocaleString()}</Text>
            <Text style={styles.reportStatLabel}>Estimated{'\n'}Savings</Text>
          </View>
          <View style={styles.reportStatDivider} />
          <View style={styles.reportStat}>
            <Text style={[styles.reportStatNum, { color: Colors.primary }]}>{MOCK_STATS.ghostModeCalls}</Text>
            <Text style={styles.reportStatLabel}>Ghost{'\n'}Calls</Text>
          </View>
        </View>
      </View>

      {/* Call Breakdown */}
      <Text style={styles.sectionTitle}>Call Breakdown</Text>
      <View style={styles.breakdownCard}>
        {/* Bar chart visual */}
        <View style={styles.barChart}>
          {[
            { label: 'Safe', count: safeCount, color: Colors.safe },
            { label: 'Suspicious', count: warnCount, color: Colors.warning },
            { label: 'High Risk', count: dangerCount, color: Colors.danger },
          ].map(item => (
            <View key={item.label} style={styles.barItem}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(4, (item.count / total) * 100)}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={[styles.barNum, { color: item.color }]}>{item.count}</Text>
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Calls Analyzed</Text>
          <Text style={styles.totalNum}>{total}</Text>
        </View>
      </View>

      {/* Threat Distribution */}
      <Text style={styles.sectionTitle}>Top Scam Types Targeting You</Text>
      {MOCK_STATS.topScamTypes.map((item, i) => (
        <View key={i} style={styles.scamRow}>
          <View style={styles.scamRank}>
            <Text style={styles.scamRankText}>{i + 1}</Text>
          </View>
          <Text style={styles.scamType}>{item.type}</Text>
          <View style={styles.scamBarTrack}>
            <View
              style={[styles.scamBarFill, {
                width: `${(item.count / MOCK_STATS.scamsBlocked) * 100}%`,
                backgroundColor: i === 0 ? Colors.danger : i === 1 ? Colors.warning : Colors.primary,
              }]}
            />
          </View>
          <Text style={styles.scamCount}>{item.count}</Text>
        </View>
      ))}

      {/* Protection Timeline */}
      <Text style={styles.sectionTitle}>Recent Threat Events</Text>
      {MOCK_CALLS.filter(c => c.threatLevel !== 'safe').map(call => {
        const color = ThreatService.getThreatColor(call.threatLevel);
        const mins = Math.round(Math.abs(Date.now() - call.timestamp.getTime()) / 60000);
        const timeStr = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
        return (
          <View key={call.id} style={styles.eventCard}>
            <View style={[styles.eventDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>{call.scamType || 'Suspicious Call'}</Text>
              <Text style={styles.eventNum}>{call.callerNumber}</Text>
            </View>
            <View style={styles.eventRight}>
              <Text style={[styles.eventScore, { color }]}>{call.threatScore}%</Text>
              <Text style={styles.eventTime}>{timeStr}</Text>
            </View>
          </View>
        );
      })}

      {/* Community Contribution */}
      <View style={styles.communityCard}>
        <MaterialIcons name="groups" size={28} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.communityTitle}>Community Impact</Text>
          <Text style={styles.communityText}>
            Your threat detections have been anonymously shared with{' '}
            <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>2.4M CALLSHIELD users</Text>,
            helping protect others from the same scam campaigns.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  month: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.lg },

  reportCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.borderStrong, marginBottom: Spacing.lg,
  },
  reportTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  reportIconWrap: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
  },
  reportTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  reportSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  shareBtn: {
    width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  reportDivider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.md },
  reportStats: { flexDirection: 'row', alignItems: 'center' },
  reportStat: { flex: 1, alignItems: 'center' },
  reportStatNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  reportStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  reportStatDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  breakdownCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, marginBottom: Spacing.md },
  barItem: { alignItems: 'center', gap: 4, width: 70 },
  barTrack: {
    width: 36, height: 100, backgroundColor: Colors.bgSurface, borderRadius: 4,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 4 },
  barNum: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  barLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md,
  },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },

  scamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  scamRank: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  scamRankText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  scamType: { fontSize: FontSize.sm, color: Colors.text, width: 140 },
  scamBarTrack: { flex: 1, height: 6, backgroundColor: Colors.bgCard, borderRadius: 3, overflow: 'hidden' },
  scamBarFill: { height: '100%', borderRadius: 3 },
  scamCount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, width: 20, textAlign: 'right' },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  eventNum: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  eventRight: { alignItems: 'flex-end' },
  eventScore: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  eventTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  communityCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderStrong, marginTop: Spacing.md,
  },
  communityTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  communityText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});

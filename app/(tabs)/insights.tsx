import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { SCAM_PATTERNS, ScamCategory } from '../../constants/scamPatterns';
import { SentinelEngine } from '../../services/sentinelEngine';
import { MOCK_STATS, MOCK_CALLS } from '../../constants/mockData';
import { Share } from 'react-native';

const MONTH = 'May 2026';

const CATEGORY_ICONS: Partial<Record<ScamCategory, string>> = {
  government_impersonation: 'account-balance',
  payment_manipulation: 'payment',
  urgency_coercion: 'access-alarm',
  threat_intimidation: 'gavel',
  secrecy_demand: 'visibility-off',
  identity_harvesting: 'fingerprint',
  prize_lottery: 'emoji-events',
  tech_support: 'computer',
  bank_impersonation: 'account-balance',
  deepfake_indicator: 'record-voice-over',
  grandparent_scam: 'elderly',
  investment_fraud: 'trending-up',
};

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const [expandedCategory, setExpandedCategory] = useState<ScamCategory | null>(null);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `CALLSHIELD SENTINEL™ protected me from ${MOCK_STATS.scamsBlocked} scam attempts this month — estimated $${MOCK_STATS.estimatedSavings.toLocaleString()} in losses prevented. callshield.ai`,
      });
    } catch {}
  };

  const safeCount = MOCK_CALLS.filter(c => c.threatLevel === 'safe').length;
  const dangerCount = MOCK_CALLS.filter(c => c.threatLevel === 'danger').length;
  const warnCount = MOCK_CALLS.filter(c => c.threatLevel === 'warning').length;
  const total = MOCK_CALLS.length;

  // Group patterns by category for taxonomy explorer
  const categoryCounts: Partial<Record<ScamCategory, number>> = {};
  SCAM_PATTERNS.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });
  const categories = Object.entries(categoryCounts) as [ScamCategory, number][];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.month}>{MONTH}</Text>
      </View>

      {/* Personal Fraud Report */}
      <View style={styles.reportCard}>
        <View style={styles.reportTop}>
          <View style={styles.reportIcon}>
            <MaterialIcons name="shield" size={28} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Personal Fraud Report</Text>
            <Text style={styles.reportSub}>SENTINEL™ analysis · {MONTH}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.8}>
            <MaterialIcons name="share" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.reportDivider} />
        <View style={styles.reportStats}>
          {[
            { num: MOCK_STATS.scamsBlocked, label: 'Scams\nBlocked', color: Colors.danger },
            { num: `$${(MOCK_STATS.estimatedSavings / 1000).toFixed(1)}k`, label: 'Est.\nSavings', color: Colors.safe },
            { num: MOCK_STATS.ghostModeCalls, label: 'Ghost\nCalls', color: Colors.primary },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.statDiv} />}
              <View style={styles.reportStat}>
                <Text style={[styles.reportNum, { color: s.color }]}>{s.num}</Text>
                <Text style={styles.reportLabel}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* SENTINEL Capability Score */}
      <View style={styles.capabilityCard}>
        <View style={styles.capHeader}>
          <MaterialIcons name="security" size={18} color={Colors.primary} />
          <Text style={styles.capTitle}>SENTINEL™ Engine Capabilities</Text>
        </View>
        {[
          { label: 'Linguistic Pattern Coverage', value: 22, max: 22, unit: 'categories', color: Colors.primary },
          { label: 'Pattern Markers Active', value: SCAM_PATTERNS.length, max: SCAM_PATTERNS.length, unit: 'markers', color: Colors.safe },
          { label: 'Trajectory Multiplier', value: 4.0, max: 5, unit: '×', color: Colors.warning },
          { label: 'Acoustic Analysis Windows', value: 60, max: 60, unit: 'samples/6s', color: Colors.accent },
        ].map(item => (
          <View key={item.label} style={styles.capRow}>
            <Text style={styles.capLabel}>{item.label}</Text>
            <View style={styles.capRight}>
              <View style={styles.capTrack}>
                <View style={[styles.capFill, { width: `${(item.value / item.max) * 100}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={[styles.capValue, { color: item.color }]}>{item.value} {item.unit}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Call Breakdown */}
      <Text style={styles.sectionTitle}>Call Breakdown</Text>
      <View style={styles.breakdownCard}>
        <View style={styles.barChart}>
          {[
            { label: 'Safe', count: safeCount, color: Colors.safe },
            { label: 'Suspicious', count: warnCount, color: Colors.warning },
            { label: 'High Risk', count: dangerCount, color: Colors.danger },
          ].map(item => (
            <View key={item.label} style={styles.barItem}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  height: `${Math.max(4, (item.count / total) * 100)}%`,
                  backgroundColor: item.color,
                }]} />
              </View>
              <Text style={[styles.barNum, { color: item.color }]}>{item.count}</Text>
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Calls Analyzed</Text>
          <Text style={styles.totalNum}>{total}</Text>
        </View>
      </View>

      {/* Threat Taxonomy Explorer */}
      <Text style={styles.sectionTitle}>SENTINEL™ Threat Taxonomy</Text>
      <Text style={styles.taxSubtitle}>22 pattern categories · {SCAM_PATTERNS.length} active linguistic markers</Text>
      {categories.slice(0, 8).map(([cat, count]) => {
        const icon = CATEGORY_ICONS[cat] || 'warning';
        const isExpanded = expandedCategory === cat;
        const patternsInCat = SCAM_PATTERNS.filter(p => p.category === cat);
        return (
          <TouchableOpacity
            key={cat}
            style={styles.taxCard}
            onPress={() => setExpandedCategory(isExpanded ? null : cat)}
            activeOpacity={0.8}
          >
            <View style={styles.taxRow}>
              <View style={styles.taxIcon}>
                <MaterialIcons name={icon as any} size={16} color={Colors.primary} />
              </View>
              <Text style={styles.taxName}>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
              <Text style={styles.taxCount}>{count} marker{count > 1 ? 's' : ''}</Text>
              <MaterialIcons
                name={isExpanded ? 'expand-less' : 'expand-more'}
                size={18} color={Colors.textMuted}
              />
            </View>
            {isExpanded && patternsInCat.map((p, i) => (
              <View key={i} style={styles.taxDetail}>
                <View style={styles.taxDetailDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taxFlag}>{p.flag}</Text>
                  {p.factCheck && (
                    <View style={styles.taxFactCheck}>
                      <MaterialIcons name="info" size={11} color={Colors.warning} />
                      <Text style={styles.taxFactText}>{p.factCheck}</Text>
                    </View>
                  )}
                  <View style={styles.taxMeta}>
                    <Text style={styles.taxWeight}>Weight: {p.weight}pt</Text>
                    <Text style={styles.taxMultiplier}>Trajectory: {p.escalationMultiplier}×</Text>
                  </View>
                </View>
              </View>
            ))}
          </TouchableOpacity>
        );
      })}

      {/* Top Scam Types */}
      <Text style={styles.sectionTitle}>Top Scam Types Targeting You</Text>
      {MOCK_STATS.topScamTypes.map((item, i) => (
        <View key={i} style={styles.scamRow}>
          <View style={styles.scamRank}>
            <Text style={styles.scamRankText}>{i + 1}</Text>
          </View>
          <Text style={styles.scamType}>{item.type}</Text>
          <View style={styles.scamTrack}>
            <View style={[styles.scamFill, {
              width: `${(item.count / MOCK_STATS.scamsBlocked) * 100}%`,
              backgroundColor: i === 0 ? Colors.danger : i === 1 ? Colors.warning : Colors.primary,
            }]} />
          </View>
          <Text style={styles.scamCount}>{item.count}</Text>
        </View>
      ))}

      {/* Community Impact */}
      <View style={styles.communityCard}>
        <MaterialIcons name="groups" size={28} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.communityTitle}>Community Network Effect</Text>
          <Text style={styles.communityText}>
            Your SENTINEL™ threat detections are anonymously contributed to{' '}
            <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>2.4M CALLSHIELD users</Text>
            , neutralizing scam campaigns before they reach others.
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
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.lg },
  taxSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },

  reportCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.borderStrong, marginBottom: Spacing.lg,
  },
  reportTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  reportIcon: {
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
  },
  reportTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  reportSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  shareBtn: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  reportDivider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.md },
  reportStats: { flexDirection: 'row', alignItems: 'center' },
  reportStat: { flex: 1, alignItems: 'center' },
  reportNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  reportLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  statDiv: { width: 1, height: 40, backgroundColor: Colors.border },

  capabilityCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderStrong, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  capHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  capTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  capRow: { gap: 4 },
  capLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  capRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  capTrack: { flex: 1, height: 5, backgroundColor: Colors.bgSurface, borderRadius: 2.5, overflow: 'hidden' },
  capFill: { height: '100%', borderRadius: 2.5 },
  capValue: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, width: 90, textAlign: 'right' },

  breakdownCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 110, marginBottom: Spacing.md },
  barItem: { alignItems: 'center', gap: 4, width: 70 },
  barTrack: { width: 34, height: 90, backgroundColor: Colors.bgSurface, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barNum: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  barLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },

  taxCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  taxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  taxIcon: {
    width: 32, height: 32, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
  },
  taxName: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
  taxCount: { fontSize: FontSize.xs, color: Colors.textMuted },
  taxDetail: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: 4 },
  taxDetailDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.primary, marginTop: 6 },
  taxFlag: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  taxFactCheck: { flexDirection: 'row', gap: 4, alignItems: 'flex-start', marginTop: 3 },
  taxFactText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 16 },
  taxMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 3 },
  taxWeight: { fontSize: 10, color: Colors.textMuted },
  taxMultiplier: { fontSize: 10, color: Colors.primary },

  scamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  scamRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  scamRankText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  scamType: { fontSize: FontSize.sm, color: Colors.text, width: 140 },
  scamTrack: { flex: 1, height: 6, backgroundColor: Colors.bgCard, borderRadius: 3, overflow: 'hidden' },
  scamFill: { height: '100%', borderRadius: 3 },
  scamCount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, width: 20, textAlign: 'right' },

  communityCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderStrong, marginTop: Spacing.md,
  },
  communityTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  communityText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});

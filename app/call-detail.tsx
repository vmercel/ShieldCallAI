import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { MOCK_CALLS } from '../constants/mockData';
import { ThreatService } from '../services/threatService';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function formatDateTime(d: Date) {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function CallDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const call = MOCK_CALLS.find(c => c.id === id) || MOCK_CALLS[0];

  const color = ThreatService.getThreatColor(call.threatLevel);
  const label = ThreatService.getThreatLabel(call.threatLevel);
  const desc = ThreatService.getThreatDescription(call.threatLevel, call.threatScore);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Caller Header */}
        <View style={[styles.callerCard, { borderColor: color + '55' }]}>
          <View style={[styles.callerAvatar, { borderColor: color, backgroundColor: color + '18' }]}>
            <MaterialIcons
              name={call.ghostHandled ? 'hearing' : call.threatLevel === 'danger' ? 'warning' : 'person'}
              size={32}
              color={color}
            />
          </View>
          <Text style={styles.callerName}>{call.callerName}</Text>
          <Text style={styles.callerNumber}>{call.callerNumber}</Text>
          {call.callerOrg && <Text style={styles.callerOrg}>{call.callerOrg}</Text>}

          <View style={[styles.threatBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <View style={[styles.threatDot, { backgroundColor: color }]} />
            <Text style={[styles.threatBadgeText, { color }]}>{label} · {call.threatScore}% threat score</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          {[
            { icon: 'access-time', label: 'Time', value: formatDateTime(call.timestamp) },
            { icon: 'timer', label: 'Duration', value: formatDuration(call.duration) },
            { icon: 'hearing', label: 'Handled By', value: call.ghostHandled ? 'AI Agent' : 'You' },
          ].map(item => (
            <View key={item.label} style={styles.metaCard}>
              <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Threat Analysis */}
        <Text style={styles.sectionTitle}>Threat Analysis</Text>
        <View style={[styles.analysisCard, { borderColor: color + '44' }]}>
          <View style={styles.analysisRow}>
            <Text style={styles.analysisLabel}>Risk Level</Text>
            <Text style={[styles.analysisValue, { color }]}>{label}</Text>
          </View>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${call.threatScore}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.analysisDesc}>{desc}</Text>

          {call.scamType && (
            <View style={[styles.scamTypeBadge, { backgroundColor: color + '18', borderColor: color + '44' }]}>
              <MaterialIcons name="local-police" size={14} color={color} />
              <Text style={[styles.scamTypeText, { color }]}>Classified: {call.scamType}</Text>
            </View>
          )}

          {call.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {call.tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI Summary */}
        <Text style={styles.sectionTitle}>AI Call Summary</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{call.summary}</Text>
        </View>

        {call.aiNotes && (
          <>
            <Text style={styles.sectionTitle}>AI Agent Notes</Text>
            <View style={styles.aiNotesCard}>
              <MaterialIcons name="hearing" size={18} color={Colors.primary} />
              <Text style={styles.aiNotesText}>{call.aiNotes}</Text>
            </View>
          </>
        )}

        {/* Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <MaterialIcons name="block" size={22} color={Colors.danger} />
            <Text style={styles.actionLabel}>Block Number</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <MaterialIcons name="report" size={22} color={Colors.warning} />
            <Text style={styles.actionLabel}>Report to FTC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <MaterialIcons name="share" size={22} color={Colors.primary} />
            <Text style={styles.actionLabel}>Share Expose</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <MaterialIcons name="call" size={22} color={Colors.safe} />
            <Text style={styles.actionLabel}>Call Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  content: { paddingHorizontal: Spacing.md },
  callerCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: 'center', borderWidth: 1.5, marginBottom: Spacing.md, gap: Spacing.sm,
  },
  callerAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  callerName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  callerNumber: { fontSize: FontSize.md, color: Colors.textSecondary },
  callerOrg: { fontSize: FontSize.sm, color: Colors.textMuted },
  threatBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1,
  },
  threatDot: { width: 8, height: 8, borderRadius: 4 },
  threatBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  metaRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  metaCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm + 4,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border,
  },
  metaLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaValue: { fontSize: FontSize.xs, color: Colors.text, fontWeight: FontWeight.semibold, textAlign: 'center' },
  analysisCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, gap: Spacing.sm,
  },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  analysisLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  analysisValue: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  meterTrack: { height: 8, backgroundColor: Colors.bgSurface, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  analysisDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  scamTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start',
  },
  scamTypeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
  },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  summaryCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 22 },
  aiNotesCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  aiNotesText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border,
  },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary, textAlign: 'center' },
});

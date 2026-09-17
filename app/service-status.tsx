/**
 * Service status screen — shows which ShieldCall backend services are live.
 *
 * Probes are cheap: each edge function answers { ping: true } without spending
 * AI or transcription budget. No secrets are shown; functions only report
 * whether their own provider key is configured.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  checkServiceHealth,
  HealthReport,
  ServiceProbe,
  ServiceStatus,
} from '../services/serviceHealth';

const STATUS_META: Record<ServiceStatus, { color: string; label: string; icon: string }> = {
  ok: { color: Colors.safe, label: 'Operational', icon: 'check-circle' },
  degraded: { color: Colors.warning, label: 'Degraded', icon: 'warning' },
  down: { color: Colors.danger, label: 'Unreachable', icon: 'error' },
};

function ServiceCard({ probe }: { probe: ServiceProbe }) {
  const meta = STATUS_META[probe.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{probe.label}</Text>
          <Text style={styles.cardDesc}>{probe.description}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
          <MaterialIcons name={meta.icon as any} size={14} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={styles.cardDetail}>{probe.detail}</Text>
      {probe.latencyMs != null && (
        <Text style={styles.cardLatency}>{probe.latencyMs} ms</Text>
      )}
    </View>
  );
}

export default function ServiceStatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  const runProbe = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkServiceHealth();
      setReport(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runProbe();
  }, [runProbe]);

  const issues = report?.services.filter((s) => s.status !== 'ok').length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service status</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={runProbe} tintColor={Colors.primary} />}
      >
        {!report && loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Checking services…</Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.banner,
                {
                  backgroundColor:
                    issues === 0 ? Colors.safeGlow : Colors.warningGlow,
                  borderColor: issues === 0 ? Colors.safe : Colors.warning,
                },
              ]}
            >
              <MaterialIcons
                name={issues === 0 ? 'check-circle' : 'warning'}
                size={22}
                color={issues === 0 ? Colors.safe : Colors.warning}
              />
              <Text style={styles.bannerText}>
                {issues === 0
                  ? 'All services operational'
                  : `${issues} service${issues === 1 ? '' : 's'} need${issues === 1 ? 's' : ''} attention`}
              </Text>
            </View>

            {report?.services.map((probe) => (
              <ServiceCard key={probe.id} probe={probe} />
            ))}

            {report && (
              <Text style={styles.checkedAt}>
                Last checked {new Date(report.probedAt).toLocaleTimeString()}
              </Text>
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={runProbe} activeOpacity={0.8} disabled={loading}>
              <MaterialIcons name="refresh" size={18} color={Colors.textInverse} />
              <Text style={styles.refreshText}>{loading ? 'Checking…' : 'Check again'}</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Status checks are lightweight and never place calls, transcribe audio, or spend AI budget.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  loadingWrap: { alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.sm },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bannerText: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  cardDesc: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  cardDetail: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },
  cardLatency: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },
  checkedAt: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.sm },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  refreshText: { color: Colors.textInverse, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  footnote: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});

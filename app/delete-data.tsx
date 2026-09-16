/**
 * Delete My Data (P3-1, GDPR/CCPA right to erasure).
 *
 * Review -> type-DELETE confirm -> verified erasure -> receipt.
 * The server RPC deletes analytics rows, quota rows, and the auth account,
 * then re-counts what is left; the screen only reports success when every
 * residual count is zero, and the device wipe is verified the same way.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  getMyDataSummary, deleteMyData, DataSummary, DeletionReport,
} from '../services/dataDeletion';

type Phase = 'loading' | 'review' | 'confirm' | 'deleting' | 'done' | 'error';

function Row({ icon, label, value, danger }: { icon: string; label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <MaterialIcons name={icon as any} size={20} color={danger ? Colors.danger : Colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && { color: Colors.danger }]}>{value}</Text>
    </View>
  );
}

export default function DeleteDataScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [report, setReport] = useState<DeletionReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyDataSummary().then((s) => {
      setSummary(s);
      setPhase('review');
    });
  }, []);

  const runDelete = async () => {
    setPhase('deleting');
    setError('');
    try {
      const r = await deleteMyData();
      setReport(r);
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || 'Deletion failed. Please try again.');
      setPhase('error');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete my data</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        {phase === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.muted}>Checking what we hold about you...</Text>
          </View>
        )}

        {phase === 'review' && summary && (
          <>
            <View style={styles.callout}>
              <Text style={styles.calloutText}>
                This is what ShieldCall AI currently holds. Deleting is permanent
                and cannot be undone.
              </Text>
            </View>
            <Row icon="person" label="Account" value={summary.signedIn ? 'Signed in' : 'Guest (no account)'} />
            <Row icon="insights" label="Usage events on our servers" value={String(summary.analyticsEvents)} />
            <Row icon="speed" label="Quota records on our servers" value={String(summary.quotaRows)} />
            <Row icon="smartphone" label="Settings and history on this device" value={`${summary.localKeys} items`} />

            <Text style={styles.sectionTitle}>What deletion does</Text>
            {[
              'Deletes your usage events and quota records from our servers.',
              summary.signedIn
                ? 'Deletes your ShieldCall AI account permanently.'
                : 'No account to delete (you are using the app as a guest).',
              'Removes all ShieldCall AI settings, consent records, and call history from this device.',
              'Verifies every deletion and shows you a receipt before you leave.',
            ].map((line) => (
              <View key={line.slice(0, 32)} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>{'\u2022'}</Text>
                <Text style={styles.body}>{line}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('confirm')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <View style={styles.warnCard}>
              <MaterialIcons name="warning" size={28} color={Colors.danger} />
              <Text style={styles.warnTitle}>This cannot be undone</Text>
              <Text style={styles.body}>
                Your account, server data, and everything on this device will be
                permanently deleted. To confirm, type DELETE below.
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.dangerBtn, confirmText.trim() !== 'DELETE' && styles.btnDisabled]}
              onPress={runDelete}
              disabled={confirmText.trim() !== 'DELETE'}
              activeOpacity={0.85}
            >
              <Text style={styles.dangerBtnText}>Delete everything</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPhase('review')} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>Keep my data</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'deleting' && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.danger} size="large" />
            <Text style={styles.muted}>Deleting and verifying. This takes a moment...</Text>
          </View>
        )}

        {phase === 'done' && report && (
          <>
            <View style={styles.successCard}>
              <MaterialIcons name="check-circle" size={40} color={Colors.safe} />
              <Text style={styles.successTitle}>Deletion verified</Text>
              <Text style={styles.body}>
                Every deletion was checked. Nothing of yours remains with ShieldCall AI.
              </Text>
            </View>
            <Row icon="insights" label="Usage events deleted" value={String(report.deletedAnalyticsEvents)} />
            <Row icon="speed" label="Quota records deleted" value={String(report.deletedQuotaRows)} />
            {report.accountDeleted && <Row icon="person-off" label="Account" value="Deleted" danger />}
            <Row icon="smartphone" label="Device items removed" value={String(report.localKeysRemoved)} />
            <Text style={styles.verifiedNote}>
              Verified: 0 server rows and 0 device items remain.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/onboarding' as any)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'error' && (
          <>
            <View style={styles.warnCard}>
              <MaterialIcons name="error" size={28} color={Colors.danger} />
              <Text style={styles.warnTitle}>Deletion did not complete</Text>
              <Text style={styles.body}>{error}</Text>
              <Text style={[styles.body, { marginTop: 8 }]}>
                Nothing was deleted halfway: the server checks its work before
                the device is touched. You can retry, or email privacy@shieldcallai.com.
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('review')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  centered: { alignItems: 'center', paddingTop: 80, gap: 16 },
  muted: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  callout: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.primary, marginBottom: Spacing.md,
  },
  calloutText: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: 8,
  },
  rowLabel: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm },
  rowValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  sectionTitle: {
    color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 6 },
  bulletMark: { color: Colors.primary, fontSize: FontSize.sm, lineHeight: 21 },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21, flex: 1 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: Spacing.lg,
  },
  primaryBtnText: { color: '#06283D', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  dangerBtn: {
    backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: Spacing.md,
  },
  dangerBtnText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  ghostBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  warnCard: {
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.lg,
    alignItems: 'center', gap: 8, marginBottom: Spacing.md,
  },
  warnTitle: { color: Colors.danger, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  input: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.textMuted,
    color: Colors.text, fontSize: FontSize.md,
    padding: Spacing.md, marginTop: Spacing.sm,
  },
  successCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.lg,
    alignItems: 'center', gap: 8, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.safe + '44',
  },
  successTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  verifiedNote: {
    color: Colors.safe, fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
    textAlign: 'center', marginTop: Spacing.md,
  },
});

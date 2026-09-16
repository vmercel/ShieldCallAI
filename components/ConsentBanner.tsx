/**
 * First-launch usage-data consent banner (P3-1, GDPR/CCPA).
 *
 * Rendered as a blocking overlay until the user answers. Accept turns on
 * privacy-safe analytics (feature usage only, never audio or transcripts);
 * Decline keeps it off permanently (changeable later in Settings).
 * Uses the app theme with high-contrast text for legibility.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { setAnalyticsEnabled } from '../services/analytics';

export default function ConsentBanner({ onAnswered }: { onAnswered: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const choose = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline');
    try {
      // Records consent AND the analytics toggle in one call, so the
      // startup-cached analytics state is consistent immediately.
      await setAnalyticsEnabled(accept);
    } finally {
      onAnswered();
    }
  };

  return (
    <View style={[styles.overlay, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="shield" size={34} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Help improve ShieldCall AI</Text>
        <Text style={styles.body}>
          We collect anonymous feature-usage data only: which screens you open,
          which toggles you use. Never call audio, never transcripts, never
          contacts or phone numbers.
        </Text>
        <Text style={styles.body}>
          You can change this any time in Settings, under Usage analytics.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, busy !== null && styles.btnDisabled]}
          onPress={() => choose(true)}
          disabled={busy !== null}
          activeOpacity={0.85}
        >
          {busy === 'accept' ? (
            <ActivityIndicator color="#06283D" />
          ) : (
            <Text style={styles.primaryBtnText}>Accept</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, busy !== null && styles.btnDisabled]}
          onPress={() => choose(false)}
          disabled={busy !== null}
          activeOpacity={0.85}
        >
          {busy === 'decline' ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.secondaryBtnText}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/privacy' as any)}
          style={styles.policyLink}
          activeOpacity={0.8}
        >
          <Text style={styles.policyLinkText}>Read the privacy policy</Text>
          <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 10, 20, 0.92)',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    alignItems: 'center',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary + '1A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm, textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21,
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#06283D', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  secondaryBtn: {
    borderWidth: 1, borderColor: Colors.textMuted,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
  },
  secondaryBtnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  btnDisabled: { opacity: 0.6 },
  policyLink: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  policyLinkText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

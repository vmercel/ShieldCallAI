/**
 * Paywall screen — ShieldCall Pro and Family subscriptions.
 *
 * Real StoreKit / Play Billing purchases through react-native-iap. Products
 * are fetched live from the store: a plan card only shows a working Buy
 * button when the store actually returned that product. If the store is
 * unreachable or the products are not configured yet, the screen says so
 * honestly instead of offering a button that cannot work.
 *
 * Purchases are auto-renewing subscriptions billed through Apple / Google.
 * Server-side receipt validation runs through the validate-receipt edge
 * function (P1-2); until the store API credentials are configured there,
 * purchases validate on-device only and retry in the background.
 * Entitlements here are device-local until the server confirms them.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  PlanId,
  StoreProductInfo,
  IapUnavailableError,
  IapStoreError,
  fetchPlanProducts,
  subscribe,
  restorePurchases,
  connect,
  disconnect,
  openManageSubscriptions,
} from '../services/iap';

type LoadState = 'loading' | 'ready' | 'unavailable';

const PLAN_ICONS: Record<Exclude<PlanId, 'free'>, string> = {
  pro_monthly: 'shield',
  family_monthly: 'group',
};

const PLAN_PERKS: Record<Exclude<PlanId, 'free'>, string[]> = {
  pro_monthly: [
    'Live Protect: real-time scam analysis on calls',
    'Ghost Mode AI answers screened calls for you',
    'Post-call summaries and threat notes',
    'Call history sync across your devices',
  ],
  family_monthly: [
    'Everything in ShieldCall Pro',
    'Up to 5 family lines under one subscription',
    'Shared family threat alerts',
  ],
};

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [products, setProducts] = useState<StoreProductInfo[]>([]);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      await connect();
      const fetched = await fetchPlanProducts();
      setProducts(fetched);
      setLoadState('ready');
    } catch (err) {
      if (err instanceof IapUnavailableError) {
        setLoadState('unavailable');
      } else {
        setProducts([]);
        setLoadState('ready');
      }
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      disconnect();
    };
  }, [load]);

  const handleBuy = useCallback(
    async (planId: Exclude<PlanId, 'free'>) => {
      setBusyPlan(planId);
      try {
        const result = await subscribe(planId);
        Alert.alert(
          'Subscription active',
          'Thanks for supporting ShieldCall AI. Your subscription is billed through the app store and renews automatically.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        void result;
      } catch (err) {
        if (err instanceof IapStoreError) {
          if (err.code === 'E_USER_CANCELLED') {
            // Cancelling is normal; do not surface an alert for it.
          } else {
            Alert.alert('Purchase failed', err.message);
          }
        } else if (err instanceof IapUnavailableError) {
          Alert.alert('Not available', err.message);
        } else {
          Alert.alert('Purchase failed', 'An unexpected error occurred. Please try again.');
        }
      } finally {
        setBusyPlan(null);
      }
    },
    [router]
  );

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const plans = await restorePurchases();
      Alert.alert(
        'Restore complete',
        plans.length > 0
          ? 'Your purchases were restored.'
          : 'No previous purchases were found for this store account.'
      );
    } catch (err) {
      Alert.alert(
        'Restore failed',
        err instanceof IapStoreError || err instanceof IapUnavailableError
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setRestoring(false);
    }
  }, []);

  const handleManage = useCallback(async () => {
    try {
      await openManageSubscriptions();
    } catch (err) {
      Alert.alert(
        'Could not open',
        err instanceof IapStoreError ? err.message : 'Subscription management is not available right now.'
      );
    }
  }, []);

  const availableCount = products.filter((p) => p.localizedPrice !== null).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ShieldCall plans</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Protect every call</Text>
        <Text style={styles.subtitle}>
          Subscriptions are auto-renewing and billed through the App Store or Google Play. Cancel
          anytime in your store subscription settings.
        </Text>

        {loadState === 'loading' ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        ) : loadState === 'unavailable' ? (
          <View style={[styles.banner, { backgroundColor: Colors.warningGlow, borderColor: Colors.warning }]}>
            <MaterialIcons name="info" size={22} color={Colors.warning} />
            <Text style={styles.bannerText}>
              In-app purchases are not available on this device or build. Plans can be purchased
              from a production build with the store products configured.
            </Text>
          </View>
        ) : availableCount === 0 ? (
          <View style={[styles.banner, { backgroundColor: Colors.warningGlow, borderColor: Colors.warning }]}>
            <MaterialIcons name="info" size={22} color={Colors.warning} />
            <Text style={styles.bannerText}>
              The store did not return any products yet. Plans will appear here once the
              subscriptions are created in App Store Connect and Google Play Console.
            </Text>
          </View>
        ) : (
          products.map(({ plan, localizedPrice, localizedTitle }) => {
            const isAvailable = localizedPrice !== null;
            const busy = busyPlan === plan.planId;
            return (
              <View key={plan.planId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.planIcon}>
                    <MaterialIcons name={PLAN_ICONS[plan.planId as Exclude<PlanId, 'free'>] as any} size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{localizedTitle || plan.name}</Text>
                    <Text style={styles.planBlurb}>{plan.blurb}</Text>
                  </View>
                </View>
                {PLAN_PERKS[plan.planId as Exclude<PlanId, 'free'>].map((perk) => (
                  <View key={perk} style={styles.perkRow}>
                    <MaterialIcons name="check" size={16} color={Colors.safe} />
                    <Text style={styles.perkText}>{perk}</Text>
                  </View>
                ))}
                {isAvailable ? (
                  <TouchableOpacity
                    style={[styles.buyBtn, busy && styles.buyBtnDisabled]}
                    onPress={() => handleBuy(plan.planId as Exclude<PlanId, 'free'>)}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={Colors.textInverse} />
                    ) : (
                      <Text style={styles.buyBtnText}>Subscribe · {localizedPrice}/month</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.notAvailableRow}>
                    <Text style={styles.notAvailableText}>Not available in the store yet</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleRestore}
          disabled={restoring || loadState !== 'ready'}
          activeOpacity={0.7}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialIcons name="restore" size={18} color={Colors.primary} />
          )}
          <Text style={styles.linkText}>Restore purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={handleManage} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={18} color={Colors.primary} />
          <Text style={styles.linkText}>Manage subscriptions</Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/terms' as any)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms of use</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy policy</Text>
          </TouchableOpacity>
        </View>
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
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.xl * 2 },
  loadingText: { marginTop: Spacing.sm, color: Colors.textSecondary, fontSize: FontSize.sm },
  banner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  bannerText: { flex: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  planBlurb: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 19 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  perkText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  buyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { color: Colors.textInverse, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  notAvailableRow: { alignItems: 'center', marginTop: Spacing.md, paddingVertical: Spacing.sm },
  notAvailableText: { color: Colors.textMuted, fontSize: FontSize.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  linkText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  legalLink: { color: Colors.textMuted, fontSize: FontSize.sm },
  legalSep: { color: Colors.textMuted, marginHorizontal: Spacing.sm },
});

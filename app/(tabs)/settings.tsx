import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

const PERSONAS = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley'];

function SettingRow({ icon, label, sub, children }: {
  icon: string; label: string; sub?: string; children?: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <MaterialIcons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ghostModeEnabled, personaName, setGhostMode, setPersonaName } = useApp();
  const { profile, signOut, isAuthenticated } = useAuth();
  const [deepfakeDetect, setDeepfakeDetect] = useState(true);
  const [communityFeed, setCommunityFeed] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [federatedLearning, setFederatedLearning] = useState(false);
  const [autoScreenUnknown, setAutoScreenUnknown] = useState(true);
  const [showPersona, setShowPersona] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [alertState, setAlertState] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      setAlertState({ visible: true, title, message, onConfirm });
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleSignOut = () => {
    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out of CALLSHIELD?',
      async () => {
        setSigningOut(true);
        await signOut();
        router.replace('/onboarding');
      }
    );
  };

  const displayName = profile?.full_name ?? profile?.username ?? 'CALLSHIELD User';
  const displayEmail = profile?.email ?? '';
  const planLabel = (profile?.plan ?? 'free').toUpperCase();
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <Modal visible={alertState.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{alertState.title}</Text>
            <Text style={styles.modalMessage}>{alertState.message}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAlertState(p => ({ ...p, visible: false }))}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setAlertState(p => ({ ...p, visible: false }));
                  alertState.onConfirm();
                }}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            {initials ? (
              <Text style={styles.profileInitials}>{initials}</Text>
            ) : (
              <MaterialIcons name="shield" size={32} color={Colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName}</Text>
            {displayEmail ? <Text style={styles.profileEmail}>{displayEmail}</Text> : null}
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>{planLabel} PLAN</Text>
            </View>
          </View>
          {planLabel === 'FREE' && (
            <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85}>
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ghost Mode / AI Agent */}
        <Text style={styles.sectionTitle}>AI Agent</Text>
        <View style={styles.section}>
          <SettingRow icon="hearing" label="Ghost Mode" sub="AI answers suspicious calls while you listen">
            <Switch
              value={ghostModeEnabled}
              onValueChange={setGhostMode}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={ghostModeEnabled ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>

          <View style={styles.divider} />

          <SettingRow icon="person" label="AI Voice Persona" sub={`Currently: "${personaName}"`}>
            <TouchableOpacity onPress={() => setShowPersona(v => !v)} style={styles.editBtn} activeOpacity={0.8}>
              <MaterialIcons name={showPersona ? 'expand-less' : 'edit'} size={18} color={Colors.primary} />
            </TouchableOpacity>
          </SettingRow>
          {showPersona && (
            <View style={styles.personaGrid}>
              {PERSONAS.map(name => (
                <TouchableOpacity
                  key={name}
                  style={[styles.personaChip, personaName === name && styles.personaChipSelected]}
                  onPress={() => { setPersonaName(name); setShowPersona(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.personaText, personaName === name && styles.personaTextSelected]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <SettingRow icon="filter-none" label="Auto-screen unknown callers" sub="Ghost mode activates for non-contacts">
            <Switch
              value={autoScreenUnknown}
              onValueChange={setAutoScreenUnknown}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={autoScreenUnknown ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>

          <View style={styles.divider} />

          <SettingRow icon="bedtime" label="Quiet Hours" sub="Screen all calls automatically 10 PM–8 AM">
            <Switch
              value={quietHours}
              onValueChange={setQuietHours}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={quietHours ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Protection */}
        <Text style={styles.sectionTitle}>Protection</Text>
        <View style={styles.section}>
          <SettingRow icon="record-voice-over" label="Deepfake Voice Detection" sub="Detect AI-synthesized caller voices">
            <Switch
              value={deepfakeDetect}
              onValueChange={setDeepfakeDetect}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={deepfakeDetect ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="groups" label="Community Threat Feed" sub="Benefit from anonymized scam reports">
            <Switch
              value={communityFeed}
              onValueChange={setCommunityFeed}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={communityFeed ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Privacy */}
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.section}>
          <SettingRow icon="lock" label="On-Device Processing Only" sub="Audio never leaves your device">
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ON</Text>
            </View>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow
            icon="model-training"
            label="Contribute to Model Improvement"
            sub="Share encrypted gradient updates (no audio, no transcripts)"
          >
            <Switch
              value={federatedLearning}
              onValueChange={setFederatedLearning}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={federatedLearning ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          {[
            { name: 'Free', price: '$0', features: ['Real-time detection', '5 Ghost Mode calls/mo', '30-day history'] },
            { name: 'Plus', price: '$6.99/mo', features: ['Unlimited Ghost Mode', 'AI Dialer', 'AI Receptionist', 'Caller dossier', 'Post-call summaries'] },
            { name: 'Family', price: '$12.99/mo', features: ['Plus for 6 members', 'Family dashboard', 'Elder-optimized UI'] },
          ].map((plan, i) => (
            <View key={plan.name} style={[styles.planItem, i < 2 && styles.planItemBorder]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={[styles.planPrice, i > 0 && { color: Colors.primary }]}>{plan.price}</Text>
              </View>
              {plan.features.map(f => (
                <View key={f} style={styles.planFeatureRow}>
                  <MaterialIcons name="check" size={14} color={i === 0 ? Colors.textMuted : Colors.primary} />
                  <Text style={styles.planFeature}>{f}</Text>
                </View>
              ))}
              {i > 0 && (
                <TouchableOpacity style={styles.planBtn} activeOpacity={0.85}>
                  <Text style={styles.planBtnText}>Upgrade to {plan.name}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Account / Sign Out */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow icon="account-circle" label="Signed in as" sub={displayEmail || displayName} />
          <View style={styles.divider} />
          <TouchableOpacity onPress={handleSignOut} disabled={signingOut} activeOpacity={0.8}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.dangerGlow }]}>
                <MaterialIcons name="logout" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.settingLabel, { color: Colors.danger }]}>
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>CALLSHIELD v1.0 Prototype · Built by OnSpace AI</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  settingSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.md },
  editBtn: {
    width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  personaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  personaChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.bgSurface, borderWidth: 1.5, borderColor: Colors.border,
  },
  personaChipSelected: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  personaText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  personaTextSelected: { color: Colors.primary, fontWeight: FontWeight.bold },
  activeBadge: {
    backgroundColor: Colors.safeGlow, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.safe + '55',
  },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.safe },
  profileCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.borderStrong,
  },
  profileInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  profileName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  tierBadge: {
    backgroundColor: Colors.bgSurface, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start',
  },
  tierText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  upgradeBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
  },
  upgradeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  planCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  planItem: { padding: Spacing.md, gap: 4 },
  planItemBorder: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  planPrice: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, color: Colors.textSecondary },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planFeature: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planBtn: {
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
    paddingVertical: 10, alignItems: 'center', marginTop: Spacing.sm,
  },
  planBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  version: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.bgCard, padding: Spacing.lg,
    borderRadius: Radius.lg, width: '100%', maxWidth: 320,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 8 },
  modalMessage: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.full,
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.full,
    backgroundColor: Colors.dangerGlow, borderWidth: 1.5, borderColor: Colors.danger + '55',
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },
});

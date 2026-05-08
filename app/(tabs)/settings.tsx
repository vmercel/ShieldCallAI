import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
  Platform, Modal, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { checkAllPermissions, PermissionsState } from '../../services/permissionsService';

const PERSONAS = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley'];

// ─── Persistent settings keys ─────────────────────────────────────────────────
const SETTINGS_KEY = 'callshield_settings_v1';

interface PersistedSettings {
  deepfakeDetect: boolean;
  communityFeed: boolean;
  quietHours: boolean;
  federatedLearning: boolean;
  autoScreenUnknown: boolean;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  deepfakeDetect: true,
  communityFeed: true,
  quietHours: false,
  federatedLearning: false,
  autoScreenUnknown: true,
};

async function loadSettings(): Promise<PersistedSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

// ─── Helper components ────────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, iconColor, children }: {
  icon: string; label: string; sub?: string; iconColor?: string; children?: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: (iconColor || Colors.primary) + '22' }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor || Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────
function UpgradeModal({ visible, plan, onClose }: { visible: boolean; plan: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.upgradeModalCard}>
          <View style={styles.upgradeModalHeader}>
            <MaterialIcons name="workspace-premium" size={32} color={Colors.primary} />
            <Text style={styles.upgradeModalTitle}>Upgrade to {plan}</Text>
            <TouchableOpacity onPress={onClose} style={styles.upgradeModalClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.upgradeModalSub}>
            Full subscription management is coming in the next release. For early access or team pricing, contact:
          </Text>
          <View style={styles.upgradeContactCard}>
            <MaterialIcons name="email" size={16} color={Colors.primary} />
            <Text style={styles.upgradeContactText}>contact@callshield.ai</Text>
          </View>
          <View style={styles.upgradeFeatureList}>
            {plan === 'Plus' ? [
              'Unlimited Ghost Mode AI calls',
              'AI Dialer for all task scenarios',
              'AI Receptionist for all incoming',
              'Full caller dossier history',
              'Post-call AI summaries',
              'Live fact-checker during calls',
            ] : [
              'Plus features for up to 6 family members',
              'Family Protection Network dashboard',
              'Elder-optimized UI mode',
              'Shared family fraud report',
              'Priority community threat alerts',
            ].map(f => (
              <View key={f} style={styles.upgradeFeatureRow}>
                <MaterialIcons name="check-circle" size={14} color={Colors.safe} />
                <Text style={styles.upgradeFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.upgradeModalDismiss} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.upgradeModalDismissText}>Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Profile Edit Modal ────────────────────────────────────────────────────────
function EditProfileModal({ visible, profile, onClose, onSave }: {
  visible: boolean;
  profile: { full_name: string; email: string; phone: string };
  onClose: () => void;
  onSave: (data: { full_name: string; phone: string }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setFullName(profile.full_name);
      setPhone(profile.phone);
      setError('');
    }
  }, [visible, profile]);

  const handleSave = async () => {
    if (!fullName.trim()) { setError('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await onSave({ full_name: fullName.trim(), phone: phone.trim() });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.editModalCard}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.editFieldLabel}>Full Name</Text>
          <View style={styles.editInput}>
            <MaterialIcons name="person" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.editInputText}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.editFieldLabel}>Phone</Text>
          <View style={styles.editInput}>
            <MaterialIcons name="phone" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.editInputText}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.editFieldLabel}>Email</Text>
          <View style={[styles.editInput, { opacity: 0.6 }]}>
            <MaterialIcons name="email" size={16} color={Colors.textMuted} />
            <Text style={[styles.editInputText, { color: Colors.textSecondary, paddingVertical: 12 }]}>
              {profile.email || 'No email'}
            </Text>
          </View>
          <Text style={styles.editEmailNote}>Email cannot be changed here. Contact support to update.</Text>

          {error ? (
            <View style={styles.editErrorBox}>
              <MaterialIcons name="error-outline" size={14} color={Colors.danger} />
              <Text style={styles.editErrorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.editModalBtns}>
            <TouchableOpacity style={styles.editCancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editSaveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={Colors.textInverse} size="small" /> : <Text style={styles.editSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ghostModeEnabled, personaName, setGhostMode, setPersonaName } = useApp();
  const { profile, signOut, updateProfile } = useAuth();

  // Persisted settings
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // UI state
  const [showPersona, setShowPersona] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [alertState, setAlertState] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [upgradeModal, setUpgradeModal] = useState<{ visible: boolean; plan: string }>({ visible: false, plan: 'Plus' });
  const [editProfileModal, setEditProfileModal] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<PermissionsState>({
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
  });

  // Load persisted settings on mount
  useEffect(() => {
    loadSettings().then(s => {
      setSettings(s);
      setSettingsLoaded(true);
    });
    // Check permission statuses
    if (Platform.OS !== 'web') {
      checkAllPermissions().then(setPermissions);
    }
  }, []);

  // Update a single setting and persist immediately
  const updateSetting = useCallback(<K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

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
    showConfirm('Sign Out', 'Are you sure you want to sign out of CALLSHIELD?', async () => {
      setSigningOut(true);
      await signOut();
      router.replace('/onboarding');
    });
  };

  const handleSaveProfile = async (data: { full_name: string; phone: string }) => {
    const { error } = await updateProfile(data);
    if (error) throw new Error(error);
  };

  const displayName = profile?.full_name ?? profile?.username ?? 'CALLSHIELD User';
  const displayEmail = profile?.email ?? '';
  const displayPhone = profile?.phone ?? '';
  const planLabel = (profile?.plan ?? 'free').toUpperCase();
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  if (!settingsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      {/* Web Sign-out Confirm Modal */}
      <Modal visible={alertState.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{alertState.title}</Text>
            <Text style={styles.modalMessage}>{alertState.message}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAlertState(p => ({ ...p, visible: false }))} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => { setAlertState(p => ({ ...p, visible: false })); alertState.onConfirm(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UpgradeModal
        visible={upgradeModal.visible}
        plan={upgradeModal.plan}
        onClose={() => setUpgradeModal(p => ({ ...p, visible: false }))}
      />

      <EditProfileModal
        visible={editProfileModal}
        profile={{ full_name: displayName, email: displayEmail, phone: displayPhone }}
        onClose={() => setEditProfileModal(false)}
        onSave={handleSaveProfile}
      />

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
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditProfileModal(true)} activeOpacity={0.85}>
            <MaterialIcons name="edit" size={16} color={Colors.primary} />
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </TouchableOpacity>
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
              value={settings.autoScreenUnknown}
              onValueChange={v => updateSetting('autoScreenUnknown', v)}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={settings.autoScreenUnknown ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="bedtime" label="Quiet Hours" sub="Screen all calls automatically 10 PM–8 AM">
            <Switch
              value={settings.quietHours}
              onValueChange={v => updateSetting('quietHours', v)}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={settings.quietHours ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Protection */}
        <Text style={styles.sectionTitle}>Protection</Text>
        <View style={styles.section}>
          <SettingRow icon="record-voice-over" label="Deepfake Voice Detection" sub="Detect AI-synthesized caller voices">
            <Switch
              value={settings.deepfakeDetect}
              onValueChange={v => updateSetting('deepfakeDetect', v)}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={settings.deepfakeDetect ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="groups" label="Community Threat Feed" sub="Benefit from anonymized scam reports">
            <Switch
              value={settings.communityFeed}
              onValueChange={v => updateSetting('communityFeed', v)}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={settings.communityFeed ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Privacy */}
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.section}>
          <SettingRow icon="lock" label="Local Audio Processing" sub="Acoustic analysis runs on-device; transcripts sent to AI agents are anonymized">
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ON</Text>
            </View>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="cloud-off" label="AI Agent Calls" sub="Ghost Mode and AI Dialer use secure cloud inference (OnSpace AI) — no raw audio transmitted">
            <View style={[styles.activeBadge, { backgroundColor: Colors.warningGlow, borderColor: Colors.warning + '44' }]}>
              <Text style={[styles.activeBadgeText, { color: Colors.warning }]}>CLOUD</Text>
            </View>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow
            icon="model-training"
            label="Contribute to Model Improvement"
            sub="Share encrypted gradient updates (no audio, no transcripts)"
          >
            <Switch
              value={settings.federatedLearning}
              onValueChange={v => updateSetting('federatedLearning', v)}
              trackColor={{ false: Colors.bgSurface, true: Colors.primaryGlow }}
              thumbColor={settings.federatedLearning ? Colors.primary : Colors.textMuted}
              ios_backgroundColor={Colors.bgSurface}
            />
          </SettingRow>
        </View>

        {/* Permissions & Privacy */}
        <Text style={styles.sectionTitle}>Permissions & Privacy</Text>
        <View style={styles.section}>
          {[
            { key: 'microphone', icon: 'mic', label: 'Microphone', sub: 'Required for live call analysis' },
            { key: 'contacts', icon: 'contacts', label: 'Contacts', sub: 'Caller identification from phonebook' },
            { key: 'notifications', icon: 'notifications', label: 'Notifications', sub: 'Scam alerts and call summaries' },
          ].map((item, i) => {
            const status = permissions[item.key as keyof PermissionsState];
            const color = status === 'granted' ? Colors.safe : status === 'denied' ? Colors.danger : Colors.textMuted;
            const statusLabel = status === 'granted' ? 'Granted' : status === 'denied' ? 'Denied' : status === 'limited' ? 'Limited' : 'Not set';
            return (
              <React.Fragment key={item.key}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.settingRow}>
                  <View style={[styles.settingIcon, { backgroundColor: color + '22' }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingSub}>{item.sub}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openSettings()}
                    style={[styles.permBadge, { backgroundColor: color + '1A', borderColor: color + '55' }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.permBadgeText, { color }]}>{statusLabel}</Text>
                  </TouchableOpacity>
                </View>
              </React.Fragment>
            );
          })}
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={[styles.settingRow, { gap: Spacing.sm }]}
            activeOpacity={0.8}
          >
            <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '22' }]}>
              <MaterialIcons name="settings" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Open iOS Settings</Text>
              <Text style={styles.settingSub}>Manage all CallShield permissions</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* CallKit Setup Guide */}
        {Platform.OS === 'ios' && (
          <>
            <Text style={styles.sectionTitle}>Default Call App Setup</Text>
            <View style={[styles.section, { padding: Spacing.md, gap: Spacing.sm }]}>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
                <MaterialIcons name="phone-in-talk" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { marginBottom: 4 }]}>Use CallShield as Call Screener</Text>
                  <Text style={styles.settingSub}>
                    After installing a development build, enable CallShield in:
                  </Text>
                  <View style={styles.callkitSteps}>
                    {[
                      'Open iOS Settings',
                      'Tap "Phone"',
                      'Tap "Call Blocking & Identification"',
                      'Enable "CallShield"',
                    ].map((step, i) => (
                      <View key={step} style={styles.callkitStep}>
                        <View style={styles.callkitStepNum}>
                          <Text style={styles.callkitStepNumText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.callkitStepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                style={styles.openSettingsBtn}
                activeOpacity={0.85}
              >
                <MaterialIcons name="settings" size={16} color={Colors.primary} />
                <Text style={styles.openSettingsBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.planCard}>
          {[
            { name: 'Free', price: '$0', features: ['Real-time detection', '5 Ghost Mode calls/mo', '30-day history'] },
            { name: 'Plus', price: '$6.99/mo', features: ['Unlimited Ghost Mode', 'AI Dialer', 'AI Receptionist', 'Caller dossier', 'Post-call summaries'] },
            { name: 'Family', price: '$12.99/mo', features: ['Plus for 6 members', 'Family dashboard', 'Elder-optimized UI'] },
          ].map((plan, i) => {
            const isCurrent = plan.name.toLowerCase() === (profile?.plan ?? 'free').toLowerCase();
            return (
              <View key={plan.name} style={[styles.planItem, i < 2 && styles.planItemBorder]}>
                <View style={styles.planHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {isCurrent && (
                      <View style={styles.currentPlanBadge}>
                        <Text style={styles.currentPlanText}>CURRENT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.planPrice, i > 0 && { color: Colors.primary }]}>{plan.price}</Text>
                </View>
                {plan.features.map(f => (
                  <View key={f} style={styles.planFeatureRow}>
                    <MaterialIcons name="check" size={14} color={i === 0 ? Colors.textMuted : Colors.primary} />
                    <Text style={styles.planFeature}>{f}</Text>
                  </View>
                ))}
                {i > 0 && !isCurrent && (
                  <TouchableOpacity
                    style={styles.planBtn}
                    onPress={() => setUpgradeModal({ visible: true, plan: plan.name })}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="workspace-premium" size={14} color={Colors.primary} />
                    <Text style={styles.planBtnText}>Upgrade to {plan.name}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
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
  section: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  settingIcon: {
    width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  settingSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.md },
  editBtn: { width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center' },
  personaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  personaChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1.5, borderColor: Colors.border },
  personaChipSelected: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  personaText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  personaTextSelected: { color: Colors.primary, fontWeight: FontWeight.bold },
  activeBadge: { backgroundColor: Colors.safeGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.safe + '55' },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.safe },

  profileCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.borderStrong },
  profileInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  profileName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  tierBadge: { backgroundColor: Colors.bgSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  tierText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.borderStrong },
  editProfileBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },

  planCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  planItem: { padding: Spacing.md, gap: 4 },
  planItemBorder: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  planPrice: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, color: Colors.textSecondary },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planFeature: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planBtn: { backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary, paddingVertical: 10, alignItems: 'center', marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  planBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  currentPlanBadge: { backgroundColor: Colors.safeGlow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.safe + '44' },
  currentPlanText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.safe, letterSpacing: 0.5 },

  version: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },

  // Permissions badges
  permBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  permBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // CallKit setup
  callkitSteps: { gap: 8, marginTop: Spacing.sm },
  callkitStep: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callkitStepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  callkitStepNumText: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.textInverse },
  callkitStepText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  openSettingsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.borderStrong, marginTop: 4 },
  openSettingsBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.bgCard, padding: Spacing.lg, borderRadius: Radius.lg, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 8 },
  modalMessage: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.dangerGlow, borderWidth: 1.5, borderColor: Colors.danger + '55', alignItems: 'center' },
  modalConfirmText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },

  // Upgrade Modal
  upgradeModalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', maxWidth: 380, borderWidth: 1.5, borderColor: Colors.borderStrong, gap: Spacing.md },
  upgradeModalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  upgradeModalTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.text },
  upgradeModalClose: { padding: 4 },
  upgradeModalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  upgradeContactCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryGlow, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong },
  upgradeContactText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  upgradeFeatureList: { gap: Spacing.xs },
  upgradeFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upgradeFeatureText: { fontSize: FontSize.sm, color: Colors.text, flex: 1 },
  upgradeModalDismiss: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 13, alignItems: 'center' },
  upgradeModalDismissText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },

  // Edit Profile Modal
  editModalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  editModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.text },
  editFieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5 },
  editInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.bgSurface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  editInputText: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false, paddingVertical: 12 },
  editEmailNote: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  editErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.danger + '44' },
  editErrorText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger },
  editModalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  editCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  editSaveBtn: { flex: 1.5, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
});

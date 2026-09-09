import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Platform, Modal, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { checkAllPermissions, PermissionsState } from '../../services/permissionsService';
import { supabase } from '../../services/supabaseClient';
import { sidecarHealth } from '../../services/shieldcallSidecar';

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
  const { profile, signOut, updateProfile, isAuthenticated } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false, title: '', message: '', confirmLabel: 'Confirm', onConfirm: () => {},
  });
  const [editProfileModal, setEditProfileModal] = useState(false);

  const [permissions, setPermissions] = useState<PermissionsState>({
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
  });
  const [coreStatus, setCoreStatus] = useState('Checking shieldcall-core…');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      checkAllPermissions().then(setPermissions);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    sidecarHealth()
      .then(h => {
        if (cancelled) return;
        setCoreStatus(
          h.live
            ? `Core live · ${h.actuation} · ${h.active_calls} calls · fail-open`
            : 'Core not live (fail-open: app still works)',
        );
      })
      .catch(() => {
        if (!cancelled) setCoreStatus('Core offline (fail-open: on-device + Claude still score)');
      });
    return () => { cancelled = true; };
  }, []);

  const showConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      setAlertState({ visible: true, title, message, confirmLabel, onConfirm });
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleSignOut = () => {
    showConfirm('Sign Out', 'Sign out of ShieldCall on this device?', 'Sign Out', async () => {
      setSigningOut(true);
      await signOut();
      router.replace('/onboarding');
    });
  };

  const handleSaveProfile = async (data: { full_name: string; phone: string }) => {
    const { error } = await updateProfile(data);
    if (error) throw new Error(error);
  };

  const handleDeleteData = () => {
    const doDelete = async () => {
      setSigningOut(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('call_records').delete().eq('user_id', user.id);
        }
        const keys = await AsyncStorage.getAllKeys();
        const appKeys = keys.filter(k => k.toLowerCase().includes('callshield') || k.toLowerCase().includes('shieldcall'));
        if (appKeys.length) await AsyncStorage.multiRemove(appKeys);
        if (isAuthenticated) await signOut();
        router.replace('/onboarding' as any);
      } catch {
        setSigningOut(false);
      }
    };
    showConfirm(
      'Delete my data',
      'This permanently deletes ShieldCall data on this device, including settings and call history. This cannot be undone.',
      'Delete',
      doDelete,
    );
  };

  const displayName = profile?.full_name ?? profile?.username ?? (isAuthenticated ? 'ShieldCall user' : 'Guest');
  const displayEmail = profile?.email ?? '';
  const displayPhone = profile?.phone ?? '';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const micStatus = permissions.microphone;
  const micColor = micStatus === 'granted' ? Colors.safe : micStatus === 'denied' ? Colors.danger : Colors.textMuted;
  const micLabel = micStatus === 'granted' ? 'Granted' : micStatus === 'denied' ? 'Denied' : micStatus === 'limited' ? 'Limited' : 'Not set';

  return (
    <>
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
                <Text style={styles.modalConfirmText}>{alertState.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isAuthenticated ? (
        <EditProfileModal
          visible={editProfileModal}
          profile={{ full_name: displayName, email: displayEmail, phone: displayPhone }}
          onClose={() => setEditProfileModal(false)}
          onSave={handleSaveProfile}
        />
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

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
            {displayEmail ? <Text style={styles.profileEmail}>{displayEmail}</Text> : (
              <Text style={styles.profileEmail}>Using ShieldCall as a guest — no account required</Text>
            )}
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>FREE</Text>
            </View>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditProfileModal(true)} activeOpacity={0.85}>
              <MaterialIcons name="edit" size={16} color={Colors.primary} />
              <Text style={styles.editProfileBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/onboarding')} activeOpacity={0.85}>
              <Text style={styles.editProfileBtnText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Live Protect</Text>
        <View style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/protect')} activeOpacity={0.85}>
            <SettingRow
              icon="mic"
              label="Start Live Protect"
              sub="Analyze this phone's conversation while the call is on. Tiles show AI vs human, scam vs genuine, likelihood."
              iconColor={Colors.primary}
            >
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </SettingRow>
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: micColor + '22' }]}>
              <MaterialIcons name="mic" size={20} color={micColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Microphone</Text>
              <Text style={styles.settingSub}>Required so ShieldCall can analyze this phone's live conversation</Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={[styles.permBadge, { backgroundColor: micColor + '1A', borderColor: micColor + '55' }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.permBadgeText, { color: micColor }]}>{micLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)} activeOpacity={0.8}>
            <SettingRow icon="privacy-tip" label="Privacy Policy" sub="How ShieldCall handles call audio and transcripts">
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </SettingRow>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity onPress={() => router.push('/terms' as any)} activeOpacity={0.8}>
            <SettingRow icon="gavel" label="Terms of Service" sub="All-party consent and acceptable use">
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </SettingRow>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your data</Text>
        <View style={styles.section}>
          <TouchableOpacity onPress={handleDeleteData} disabled={signingOut} activeOpacity={0.8}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.dangerGlow }]}>
                <MaterialIcons name="delete-forever" size={20} color={Colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: Colors.danger }]}>Delete my data</Text>
                <Text style={styles.settingSub}>Remove local settings and call history from this device</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          {isAuthenticated ? (
            <>
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
            </>
          ) : (
            <TouchableOpacity onPress={() => router.push('/onboarding')} activeOpacity={0.8}>
              <SettingRow icon="login" label="Create account (optional)" sub="ShieldCall is free. An account is not required to use Live Protect.">
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </SettingRow>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Research</Text>
        <Text style={styles.engineerNote}>Engineer only — not the product path</Text>
        <View style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/lab-call')} activeOpacity={0.85}>
            <SettingRow
              icon="hub"
              label="shieldcall-core"
              sub={coreStatus}
              iconColor={Colors.primary}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="science"
              label="Detector Lab"
              sub="Talk to every core API: health, calls, chunk, scripts, scores."
              iconColor={Colors.warning}
            >
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </SettingRow>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>ShieldCall v1.0.0</Text>
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
  engineerNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: -4, marginBottom: Spacing.sm },
  section: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  settingIcon: {
    width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  settingSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.md },

  profileCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.borderStrong },
  profileInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  profileName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  tierBadge: { backgroundColor: Colors.bgSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  tierText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.borderStrong },
  editProfileBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },

  version: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  permBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  permBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.bgCard, padding: Spacing.lg, borderRadius: Radius.lg, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 8 },
  modalMessage: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.dangerGlow, borderWidth: 1.5, borderColor: Colors.danger + '55', alignItems: 'center' },
  modalConfirmText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },

  editModalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  editModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.text },
  editFieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5 },
  editInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.bgSurface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  editInputText: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false, paddingVertical: 12 },
  editErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.danger + '44' },
  editErrorText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger },
  editModalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  editCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  editSaveBtn: { flex: 1.5, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
});

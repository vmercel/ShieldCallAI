import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

const PERSONAS = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley'];

function SettingRow({ icon, label, sub, children }: { icon: string; label: string; sub?: string; children?: React.ReactNode }) {
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
  const { ghostModeEnabled, personaName, setGhostMode, setPersonaName } = useApp();
  const [deepfakeDetect, setDeepfakeDetect] = useState(true);
  const [communityFeed, setCommunityFeed] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [federatedLearning, setFederatedLearning] = useState(false);
  const [autoScreenUnknown, setAutoScreenUnknown] = useState(true);
  const [showPersona, setShowPersona] = useState(false);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Settings</Text>

      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <MaterialIcons name="shield" size={32} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>CALLSHIELD User</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>FREE PLAN</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85}>
          <Text style={styles.upgradeBtnText}>Upgrade</Text>
        </TouchableOpacity>
      </View>

      {/* Ghost Mode */}
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
          <TouchableOpacity onPress={() => setShowPersona(!showPersona)} style={styles.editBtn} activeOpacity={0.8}>
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

        <SettingRow icon="bedtime" label="Quiet Hours" sub="Screen all calls automatically from 10 PM–8 AM">
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
        <SettingRow icon="record-voice-over" label="Deepfake Voice Detection" sub="Detect AI-synthesized voices">
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

      {/* Plan */}
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

      {/* Version */}
      <Text style={styles.version}>CALLSHIELD v1.0 Prototype · Built by OnSpace AI</Text>
    </ScrollView>
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
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
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
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.borderStrong,
  },
  profileName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  tierBadge: {
    backgroundColor: Colors.bgSurface, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start',
  },
  tierText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  upgradeBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
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
});

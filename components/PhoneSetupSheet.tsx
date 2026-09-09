/**
 * One-tap calling setup. iOS: Allow -> system dialogs. Settings only if denied.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  checkAllPermissions, requestCallingPermissions, PermissionsState,
} from '../services/permissionsService';
import { deniedSettingsHint, hostAppLabel, openHostAppSettings, promptDefaultDialer } from '../services/defaultDialer';

type StepKey = 'contacts' | 'microphone' | 'phone';

function StepRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <View style={styles.step}>
      <MaterialIcons
        name={ok ? 'check-circle' : 'radio-button-unchecked'}
        size={22}
        color={ok ? Colors.safe : Colors.textMuted}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.stepLabel}>{label}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function PhoneSetupSheet({
  visible,
  onClose,
  onReady,
}: {
  visible: boolean;
  onClose: () => void;
  onReady?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [perms, setPerms] = useState<PermissionsState | null>(null);

  const refresh = async () => {
    const state = await checkAllPermissions();
    setPerms(state);
    return state;
  };

  useEffect(() => {
    if (visible) refresh().catch(() => {});
  }, [visible]);

  const contactsOk = perms?.contacts === 'granted';
  const micOk = perms?.microphone === 'granted';
  const ready = contactsOk && micOk;
  const blocked = !ready && (
    perms?.contacts === 'denied' || perms?.microphone === 'denied'
  );

  const handleAllow = async () => {
    setBusy(true);
    try {
      await requestCallingPermissions();
      if (Platform.OS === 'android') await promptDefaultDialer();
      const state = await refresh();
      if (state.contacts === 'granted' && state.microphone === 'granted') {
        onReady?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="phone-in-talk" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{ready ? 'You are ready to call' : 'Set up calling'}</Text>
          <Text style={styles.sub}>
            {ready
              ? 'Say a name, or pick someone from Contacts. ShieldCall dials and watches the call.'
              : 'Tap Allow. iOS will ask for Contacts and Microphone. That is the whole setup.'}
          </Text>

          <StepRow ok={contactsOk} label="Contacts" detail="So you can say a name and dial" />
          <StepRow ok={micOk} label="Microphone" detail="So ShieldCall can score the live call" />
          {Platform.OS === 'android' ? (
            <StepRow
              ok={perms?.phone === 'granted'}
              label="Default Phone app"
              detail="Android will ask once. Accept to receive calls here."
            />
          ) : null}

          {blocked ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>{deniedSettingsHint()}</Text>
            </View>
          ) : null}

          {ready ? (
            <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.btnText}>Start calling</Text>
            </TouchableOpacity>
          ) : blocked ? (
            <TouchableOpacity
              style={styles.btn}
              onPress={async () => { await openHostAppSettings(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Open {hostAppLabel()} settings</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={handleAllow}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.btnText}>Allow</Text>}
            </TouchableOpacity>
          )}

          {blocked ? (
            <TouchableOpacity style={styles.secondary} onPress={handleAllow} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>I turned them on. Check again</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondary} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>Not now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function callingIsReady(perms: PermissionsState | null): boolean {
  return perms?.contacts === 'granted' && perms?.microphone === 'granted';
}

export type { StepKey };

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(6,14,30,0.88)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.borderStrong,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16, alignSelf: 'center',
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderStrong, marginBottom: 4,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center' },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  stepLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  stepDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  hint: {
    backgroundColor: Colors.warningGlow, borderRadius: Radius.md, padding: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.warning + '44', marginTop: 4,
  },
  hintText: { fontSize: FontSize.sm, color: Colors.warning, lineHeight: 20 },
  btn: {
    marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  btnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  secondary: { paddingVertical: 8, alignItems: 'center' },
  secondaryText: { fontSize: FontSize.sm, color: Colors.textMuted },
});

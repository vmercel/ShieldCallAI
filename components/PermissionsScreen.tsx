/**
 * CALLSHIELD Permissions Request Screen (component for onboarding)
 *
 * Shown after persona selection, before the main app.
 * Requests all iOS permissions needed for full functionality.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { requestCallingPermissions, PermissionsState } from '../services/permissionsService';

interface PermissionItem {
  key: keyof PermissionsState;
  icon: string;
  title: string;
  description: string;
  required: boolean;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    key: 'contacts',
    icon: 'contacts',
    title: 'Contacts',
    description: 'So you can say a name and ShieldCall dials that person.',
    required: true,
  },
  {
    key: 'microphone',
    icon: 'mic',
    title: 'Microphone',
    description: 'So ShieldCall can score the live call for scams and AI voices.',
    required: true,
  },
];

interface PermissionsScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function PermissionsScreen({ onComplete, onSkip }: PermissionsScreenProps) {
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<PermissionsState | null>(null);

  const handleRequest = async () => {
    setRequesting(true);
    const perms = await requestCallingPermissions();
    setResult(perms);
    setRequesting(false);
    setDone(true);
  };

  const statusColor = (status: string) => {
    if (status === 'granted') return Colors.safe;
    if (status === 'denied') return Colors.danger;
    if (status === 'limited') return Colors.warning;
    return Colors.textMuted;
  };

  const statusIcon = (status: string) => {
    if (status === 'granted') return 'check-circle';
    if (status === 'denied') return 'cancel';
    if (status === 'limited') return 'warning';
    return 'radio-button-unchecked';
  };

  const statusLabel = (status: string) => {
    if (status === 'granted') return 'Granted';
    if (status === 'denied') return 'Denied';
    if (status === 'limited') return 'Limited';
    return 'Not yet';
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="verified-user" size={48} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Set up calling</Text>
      <Text style={styles.subtitle}>
        Tap Allow. iOS will ask for Contacts and Microphone.{'\n'}
        That is the whole setup.
      </Text>

      <View style={styles.permList}>
        {PERMISSION_ITEMS.map(item => {
          const status = result?.[item.key] ?? 'undetermined';
          return (
            <View key={item.key} style={styles.permRow}>
              <View style={[styles.permIcon, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialIcons name={item.icon as any} size={22} color={Colors.primary} />
              </View>
              <View style={styles.permText}>
                <View style={styles.permTitleRow}>
                  <Text style={styles.permTitle}>{item.title}</Text>
                  {item.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>REQUIRED</Text>
                    </View>
                  )}
                  {done && (
                    <MaterialIcons name={statusIcon(status) as any} size={14} color={statusColor(status)} />
                  )}
                </View>
                <Text style={styles.permDesc}>{item.description}</Text>
                {done && status !== 'undetermined' && (
                  <Text style={[styles.permStatus, { color: statusColor(status) }]}>
                    {statusLabel(status)}
                    {status === 'denied' ? '. Turn them on in this app\'s iOS settings page.' : ''}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {!done ? (
        <TouchableOpacity
          style={[styles.btn, requesting && { opacity: 0.7 }]}
          onPress={handleRequest}
          disabled={requesting}
          activeOpacity={0.85}
        >
          {requesting ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <>
              <MaterialIcons name="check" size={18} color={Colors.textInverse} />
              <Text style={styles.btnText}>Allow</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={onComplete} activeOpacity={0.85}>
          <MaterialIcons name="phone" size={18} color={Colors.textInverse} />
          <Text style={styles.btnText}>Start calling</Text>
        </TouchableOpacity>
      )}

      {!done && (
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.8}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  iconWrap: {
    width: 88, height: 88, borderRadius: Radius.xl,
    backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  permList: { width: '100%', gap: Spacing.md },
  permRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  permIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  permText: { flex: 1, gap: 3 },
  permTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  requiredBadge: { backgroundColor: Colors.dangerGlow, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.danger + '44' },
  requiredText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  permDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  permStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  callkitNote: {
    width: '100%', flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  callkitNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  btn: {
    width: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 16,
  },
  btnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: FontSize.sm, color: Colors.textMuted },
});

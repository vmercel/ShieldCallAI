/**
 * Completes the email recovery link. User sets a new password, then lands in the app.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { supabase } from '../services/supabaseClient';
import { useApp } from '../contexts/AppContext';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboarded } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await setOnboarded();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.icon}>
        <MaterialIcons name="lock-reset" size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.sub}>This finishes the reset link from your email.</Text>

      <View style={styles.field}>
        <MaterialIcons name="lock" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
        />
      </View>
      <View style={styles.field}>
        <MaterialIcons name="lock-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={busy} activeOpacity={0.85}>
        {busy ? <ActivityIndicator color={Colors.textInverse} /> : (
          <Text style={styles.btnText}>Save and sign in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.lg, gap: Spacing.md, justifyContent: 'center' },
  icon: {
    width: 64, height: 64, borderRadius: 18, alignSelf: 'center',
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center' },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 14 },
  error: { color: Colors.danger, fontSize: FontSize.sm, textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

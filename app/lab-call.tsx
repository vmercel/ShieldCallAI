/**
 * Detector Lab — Experiment 0.
 * Recommend-only. Does not hang up. Does not auto-quiz.
 * Requires a running `python scripts/run_sidecar.py` in shieldcall-core.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  LAB_SCRIPTS,
  SidecarEvent,
  sidecarBaseUrl,
  sidecarCloseCall,
  sidecarHealth,
  sidecarInject,
  sidecarOpenCall,
  sidecarTranscript,
  sidecarCapabilities,
  sidecarScripts,
} from '../services/shieldcallSidecar';

function actionColor(action: string): string {
  if (action === 'warn' || action === 'escalate') return Colors.warning;
  if (action === 'challenge') return Colors.danger;
  if (action === 'monitor' || action === 'abstain') return Colors.safe;
  return Colors.primary;
}

export default function LabCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [url, setUrl] = useState(sidecarBaseUrl());
  const [consented, setConsented] = useState(false);
  const [connected, setConnected] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState('Sidecar offline until you connect.');
  const [last, setLast] = useState<SidecarEvent | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [liveTurn, setLiveTurn] = useState('');

  const pushLog = useCallback((line: string) => {
    setLog(prev => [line, ...prev].slice(0, 30));
  }, []);

  const connect = useCallback(async () => {
    if (!consented) {
      setStatus('Consent is required before a copy of audio/text is sent to the local detector.');
      return;
    }
    setBusy(true);
    setOffline(false);
    try {
      const h = await sidecarHealth(url);
      const caps = await sidecarCapabilities(url).catch(() => null);
      const remoteScripts = await sidecarScripts(url).catch(() => null);
      const opened = await sidecarOpenCall(undefined, url);
      setCallId(opened.call_id);
      setConnected(true);
      const nScripts = remoteScripts?.scripts?.length ?? LAB_SCRIPTS.length;
      setStatus(
        `Core live. actuation=${caps?.actuation || h.actuation} fail-open=${caps?.fail_open ?? true} scripts=${nScripts}`,
      );
      pushLog(`open ${opened.call_id} shed=${opened.shed} endpoints=${caps?.endpoints?.length ?? 0}`);
    } catch (e: any) {
      setConnected(false);
      setOffline(true);
      setStatus('Sidecar unreachable (fail-open). The lab screen stays up. Start python scripts/run_sidecar.py');
      pushLog(`connect failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, [consented, url, pushLog]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      if (callId) await sidecarCloseCall(callId, url);
    } catch {
      /* fail-open */
    }
    setConnected(false);
    setCallId(null);
    setStatus('Disconnected. Recommend-only session ended.');
    setBusy(false);
  }, [callId, url]);

  const inject = useCallback(async (scriptId: string, label: string) => {
    if (!callId) {
      setStatus('Connect first.');
      return;
    }
    setBusy(true);
    setOffline(false);
    try {
      const ev = await sidecarInject(callId, { script_id: scriptId }, url);
      setLast(ev);
      pushLog(`${label}: action=${ev.action} fraud=${ev.fraud.toFixed(2)} synth=${ev.synth.toFixed(2)}`);
      setStatus(`Last action ${ev.action} (recommend-only). Challenge is logged, not a quiz.`);
    } catch (e: any) {
      setOffline(true);
      setStatus('Sidecar dropped mid-session (fail-open). Timer/UI still here.');
      pushLog(`inject failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, [callId, url, pushLog]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detector Lab</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.banner}>
          Experiment 0. Copies text (and later PCM) to a local Python sidecar. Does not hang up.
          Does not auto-quiz. If the sidecar dies, this screen stays up.
        </Text>

        <View style={styles.consentRow}>
          <Switch value={consented} onValueChange={setConsented} trackColor={{ true: Colors.primaryDark }} />
          <Text style={styles.consentText}>
            I understand this lab sends call text to a detector on my LAN. Audio is not saved to disk by default.
          </Text>
        </View>

        <Text style={styles.label}>Sidecar URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://127.0.0.1:8765"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.hint}>Phone on Wi-Fi: use your laptop’s LAN IP. iOS simulator: 127.0.0.1. Android emulator: 10.0.2.2</Text>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={connect} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.btnPrimaryText}>Connect</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={disconnect} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.btnText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.badge, { borderColor: offline ? Colors.danger : connected ? Colors.safe : Colors.border }]}>
          <Text style={styles.badgeLabel}>{offline ? 'SIDECAR OFFLINE (fail-open)' : connected ? 'CONNECTED' : 'IDLE'}</Text>
          <Text style={styles.status}>{status}</Text>
          {callId ? <Text style={styles.mono}>{callId}</Text> : null}
        </View>

        {last ? (
          <View style={styles.scoreCard}>
            <Text style={[styles.action, { color: actionColor(last.action) }]}>{last.action.toUpperCase()}</Text>
            <Text style={styles.meta}>
              fraud {(last.fraud * 100).toFixed(0)}% · synth {(last.synth * 100).toFixed(0)}% · {last.regime || '—'}
            </Text>
            {last.action === 'challenge' ? (
              <Text style={styles.warnNote}>CHALLENGE is logged only in Experiment 0. No quiz is shown.</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.label}>Live turn (type what you hear on the call)</Text>
        <TextInput
          style={styles.input}
          value={liveTurn}
          onChangeText={setLiveTurn}
          placeholder="Grandparent bond, refund, dentist reminder..."
          placeholderTextColor={Colors.textMuted}
          multiline
        />
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, { flex: 0 }]}
          onPress={async () => {
            if (!callId || !liveTurn.trim()) return;
            setBusy(true);
            try {
              const ev = await sidecarTranscript(callId, liveTurn.trim(), Date.now() / 1000, url);
              setLast(ev);
              pushLog(`live turn action=${ev.action} fraud=${ev.fraud.toFixed(2)}`);
              setLiveTurn('');
            } catch (e: any) {
              setOffline(true);
              pushLog(`live turn failed: ${e?.message || e}`);
            } finally {
              setBusy(false);
            }
          }}
          disabled={!connected || busy}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Push live turn</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Inject fixture (independent scripts)</Text>
        {LAB_SCRIPTS.map(s => (
          <TouchableOpacity
            key={s.id}
            style={styles.chip}
            onPress={() => inject(s.id, s.label)}
            disabled={!connected || busy}
            activeOpacity={0.85}
          >
            <MaterialIcons name={s.cell === 'safe' ? 'healing' : 'report'} size={16} color={s.cell === 'safe' ? Colors.safe : Colors.warning} />
            <Text style={styles.chipText}>{s.label}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>Event log</Text>
        {log.length === 0 ? <Text style={styles.hint}>No events yet.</Text> : null}
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold as any },
  body: { padding: Spacing.lg, paddingBottom: 48, gap: 10 },
  banner: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  consentText: { flex: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 18 },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, color: Colors.text, backgroundColor: Colors.bgCard,
  },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  btnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnPrimaryText: { color: Colors.textInverse, fontWeight: '700' },
  btnText: { color: Colors.text, fontWeight: '600' },
  badge: { borderWidth: 1, borderRadius: Radius.md, padding: 12, backgroundColor: Colors.bgCard },
  badgeLabel: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.xs, marginBottom: 4 },
  status: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 18 },
  mono: { color: Colors.textMuted, fontSize: 11, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  scoreCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 16 },
  action: { fontSize: 22, fontWeight: '800' },
  meta: { color: Colors.textSecondary, marginTop: 4 },
  warnNote: { color: Colors.danger, marginTop: 8, fontSize: FontSize.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { color: Colors.text, fontSize: FontSize.sm, flex: 1 },
  logLine: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
});

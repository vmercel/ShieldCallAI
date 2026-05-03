import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { AI_DIALER_SCENARIOS } from '../../constants/mockData';

type DialerStatus = 'idle' | 'dialing' | 'connected' | 'done';

const AI_RESPONSES: Record<string, string[]> = {
  pharmacy: [
    'Connecting to CVS Pharmacy...',
    'Navigating IVR menu...',
    'Requesting refill for blood pressure medication...',
    'Refill confirmed. Ready for pickup Thursday after 3 PM.',
  ],
  appointment: [
    'Calling Dr. Nguyen\'s office...',
    'Speaking with scheduling assistant...',
    'Confirming appointment on the 15th...',
    'Confirmed. Your appointment is at 2:30 PM on the 15th.',
  ],
  cancel: [
    'Connecting to customer service...',
    'Navigating to cancellations department...',
    'Requesting subscription cancellation...',
    'Cancellation confirmed. Confirmation #CS-88421 issued.',
  ],
  insurance: [
    'Dialing insurance claims department...',
    'On hold... (2m 14s)',
    'Speaking with claims supervisor...',
    'Claim #A-4821 escalated to review board. Expect callback in 3-5 days.',
  ],
  default: [
    'Placing call...',
    'Connected.',
    'AI agent handling your request...',
    'Task complete. Summary ready.',
  ],
};

function getResponseKey(text: string): string {
  if (/pharmacy|prescription|refill|medication/i.test(text)) return 'pharmacy';
  if (/appointment|doctor|confirm|schedule/i.test(text)) return 'appointment';
  if (/cancel|subscription|comcast/i.test(text)) return 'cancel';
  if (/insurance|claim|deny/i.test(text)) return 'insurance';
  return 'default';
}

export default function DialerScreen() {
  const insets = useSafeAreaInsets();
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<DialerStatus>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDial = () => {
    if (!instruction.trim()) return;
    const key = getResponseKey(instruction);
    const responses = AI_RESPONSES[key];
    setSteps([]);
    setCurrentStep(0);
    setResult('');
    setStatus('dialing');

    Animated.timing(progressAnim, { toValue: 0, duration: 0, useNativeDriver: false }).start();
    let idx = 0;
    intervalRef.current = setInterval(() => {
      if (idx < responses.length - 1) {
        setSteps(prev => [...prev, responses[idx]]);
        setCurrentStep(idx + 1);
        Animated.timing(progressAnim, {
          toValue: ((idx + 1) / (responses.length - 1)),
          duration: 800,
          useNativeDriver: false,
        }).start();
        if (idx === 1) setStatus('connected');
        idx++;
      } else {
        setSteps(prev => [...prev, responses[idx]]);
        setResult(responses[idx]);
        setStatus('done');
        if (intervalRef.current) clearInterval(intervalRef.current);
        Animated.timing(progressAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
      }
    }, 2200);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus('idle');
    setSteps([]);
    setCurrentStep(0);
    setResult('');
    setInstruction('');
    Animated.timing(progressAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.agentIcon}>
            <MaterialIcons name="support-agent" size={28} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>AI Dialer</Text>
            <Text style={styles.subtitle}>Tell your AI what to do. It handles the call.</Text>
          </View>
        </View>

        {/* Input Box */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={instruction}
            onChangeText={setInstruction}
            placeholder="e.g. Call my pharmacy and refill blood pressure medication..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            editable={status === 'idle'}
            returnKeyType="done"
          />
          {status === 'idle' ? (
            <TouchableOpacity
              style={[styles.dialBtn, !instruction.trim() && styles.dialBtnDisabled]}
              onPress={handleDial}
              disabled={!instruction.trim()}
              activeOpacity={0.85}
            >
              <MaterialIcons name="phone-forwarded" size={20} color={instruction.trim() ? Colors.textInverse : Colors.textMuted} />
              <Text style={[styles.dialBtnText, !instruction.trim() && { color: Colors.textMuted }]}>Let AI Dial</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
              <MaterialIcons name="refresh" size={18} color={Colors.textSecondary} />
              <Text style={styles.resetBtnText}>New Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scenarios */}
        {status === 'idle' && (
          <>
            <Text style={styles.sectionTitle}>Common Tasks</Text>
            <View style={styles.scenarioGrid}>
              {AI_DIALER_SCENARIOS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.scenarioChip}
                  onPress={() => setInstruction(s.example)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={s.icon as any} size={18} color={Colors.primary} />
                  <Text style={styles.scenarioLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Active Call UI */}
        {status !== 'idle' && (
          <View style={styles.callContainer}>
            {/* Status Bar */}
            <View style={styles.statusBar}>
              <View style={[styles.statusDot, status === 'done' ? styles.dotDone : styles.dotActive]} />
              <Text style={styles.statusText}>
                {status === 'dialing' ? 'DIALING' : status === 'connected' ? 'CONNECTED' : 'COMPLETED'}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>

            {/* Steps */}
            <View style={styles.stepsCard}>
              <Text style={styles.stepsTitle}>AI Activity Log</Text>
              {steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepDot, i === steps.length - 1 && status === 'done' && styles.stepDotDone]} />
                  <Text style={[styles.stepText, i === steps.length - 1 && { color: Colors.text }]}>{step}</Text>
                </View>
              ))}
              {status !== 'done' && (
                <View style={styles.stepRow}>
                  <View style={[styles.stepDot, styles.stepDotLoading]} />
                  <Text style={styles.stepTextLoading}>Processing...</Text>
                </View>
              )}
            </View>

            {/* Result */}
            {status === 'done' && (
              <View style={styles.resultCard}>
                <MaterialIcons name="check-circle" size={28} color={Colors.safe} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>Task Complete</Text>
                  <Text style={styles.resultText}>{result}</Text>
                </View>
              </View>
            )}

            {/* Join CTA */}
            {status === 'connected' && (
              <TouchableOpacity style={styles.joinBtn} activeOpacity={0.85}>
                <MaterialIcons name="phone" size={20} color={Colors.textInverse} />
                <Text style={styles.joinBtnText}>Join This Call</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* How it works */}
        {status === 'idle' && (
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>How AI Dialer Works</Text>
            {[
              { icon: 'record-voice-over', text: 'Type or speak a natural language instruction' },
              { icon: 'phone-forwarded', text: 'AI places the call and navigates IVR menus' },
              { icon: 'visibility', text: 'Watch the live transcript or join at any time' },
              { icon: 'summarize', text: 'Receive a full summary when the task is done' },
            ].map((item, i) => (
              <View key={i} style={styles.howRow}>
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{i + 1}</Text>
                </View>
                <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  agentIcon: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  inputCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderStrong, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  input: {
    fontSize: FontSize.md, color: Colors.text, lineHeight: 24,
    minHeight: 72, textAlignVertical: 'top', includeFontPadding: false,
  },
  dialBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 14,
  },
  dialBtnDisabled: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border },
  dialBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 10,
  },
  resetBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm },
  scenarioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  scenarioChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  scenarioLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
  callContainer: { gap: Spacing.md },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { backgroundColor: Colors.primary },
  dotDone: { backgroundColor: Colors.safe },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text, letterSpacing: 1.5 },
  progressTrack: {
    height: 4, backgroundColor: Colors.bgCard, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  stepsCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  stepsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: 4, letterSpacing: 0.5 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted, marginTop: 6 },
  stepDotDone: { backgroundColor: Colors.safe },
  stepDotLoading: { backgroundColor: Colors.primary },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  stepTextLoading: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
  resultCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.safe + '55',
  },
  resultTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.safe, marginBottom: 4 },
  resultText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  joinBtn: {
    backgroundColor: Colors.safe, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 14,
  },
  joinBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  howCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md, marginTop: Spacing.md,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  howNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  howNumText: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.primary },
  howText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useGhostMode } from '../hooks/useGhostMode';
import { SentinelEngine } from '../services/sentinelEngine';

function formatDur(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Animated Waveform Ring ────────────────────────────────────────────────
function PulseRing({ color, isActive }: { color: string; isActive: boolean }) {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isActive) return;
    const anim1 = Animated.loop(
      Animated.parallel([
        Animated.timing(scale1, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity1, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(scale2, { toValue: 1.9, duration: 1400, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      ])
    );
    anim1.start();
    anim2.start();
    return () => { anim1.stop(); anim2.stop(); scale1.setValue(1); scale2.setValue(1); opacity1.setValue(0.6); opacity2.setValue(0.4); };
  }, [isActive, color]);

  return (
    <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale1 }], opacity: opacity1 }]} />
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale2 }], opacity: opacity2 }]} />
      <View style={[styles.avatarRing, { borderColor: color }]}>
        <View style={[styles.avatarCore, { backgroundColor: color + '22' }]}>
          <MaterialIcons name="hearing" size={36} color={color} />
        </View>
      </View>
    </View>
  );
}

// ─── Intelligence Card ─────────────────────────────────────────────────────
function IntelCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={[styles.intelCard, { borderColor: color + '44' }]}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={styles.intelLabel}>{label}</Text>
      <Text style={[styles.intelValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function GhostModeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { personaName } = useApp();
  const ghost = useGhostMode(personaName);
  const scrollRef = useRef<ScrollView>(null);
  const intelScrollRef = useRef<ScrollView>(null);
  const threatAnim = useRef(new Animated.Value(0)).current;

  const threatColor = SentinelEngine.getThreatColor(ghost.threatLevel);

  useEffect(() => {
    ghost.initialize();
  }, []);

  useEffect(() => {
    Animated.timing(threatAnim, { toValue: ghost.threatScore, duration: 600, useNativeDriver: false }).start();
  }, [ghost.threatScore]);

  useEffect(() => {
    if (ghost.messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [ghost.messages.length]);

  const meterWidth = threatAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const handleSend = async () => {
    if (ghost.inputText.trim()) {
      await ghost.submitCallerText(ghost.inputText.trim());
    }
  };

  const handleEnd = async () => {
    const result = await ghost.endSession();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.ghostBadge, ghost.isExposeMode && styles.ghostBadgeExpose]}>
              <View style={[styles.ghostDot, { backgroundColor: ghost.isExposeMode ? Colors.warning : Colors.primary }]} />
              <Text style={[styles.ghostBadgeText, { color: ghost.isExposeMode ? Colors.warning : Colors.primary }]}>
                {ghost.isExposeMode ? 'EXPOSE MODE' : 'GHOST ACTIVE'}
              </Text>
            </View>
          </View>
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{formatDur(ghost.duration)}</Text>
          </View>
        </View>

        {/* AI Avatar */}
        <View style={styles.avatarSection}>
          <PulseRing color={ghost.isAISpeaking ? Colors.primary : threatColor} isActive={ghost.isAISpeaking} />
          <Text style={styles.personaName}>{personaName}</Text>
          <Text style={[styles.personaStatus, { color: ghost.isAISpeaking ? Colors.primary : Colors.textSecondary }]}>
            {ghost.isAISpeaking ? 'Speaking...' : ghost.isProcessing ? 'Processing...' : 'Listening'}
          </Text>
        </View>

        {/* SENTINEL Score Row */}
        <View style={[styles.scoreRow, { borderColor: threatColor + '55' }]}>
          <View style={styles.scoreLeft}>
            <View style={[styles.levelDot, { backgroundColor: threatColor }]} />
            <Text style={[styles.levelLabel, { color: threatColor }]}>
              {SentinelEngine.getThreatLabel(ghost.threatLevel)}
            </Text>
            {ghost.trajectoryLabel === 'rising' && (
              <View style={styles.risingBadge}>
                <MaterialIcons name="trending-up" size={10} color={Colors.danger} />
                <Text style={styles.risingText}>RISING</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scoreNum, { color: threatColor }]}>{ghost.threatScore}%</Text>
        </View>
        <View style={styles.meterTrack}>
          <Animated.View style={[styles.meterFill, { width: meterWidth, backgroundColor: threatColor }]} />
        </View>

        {/* Fact Check */}
        {ghost.factChecks.length > 0 && (
          <View style={styles.factCheck}>
            <MaterialIcons name="fact-check" size={14} color={Colors.warning} />
            <Text style={styles.factCheckText} numberOfLines={2}>{ghost.factChecks[0]}</Text>
          </View>
        )}

        {/* Intelligence Dashboard */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={intelScrollRef}
          style={styles.intelScroll}
          contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.md }}
        >
          <IntelCard
            label="Time Wasted"
            value={`${ghost.intelligence.timeWasted}s`}
            icon="timer"
            color={Colors.primary}
          />
          <IntelCard
            label="Caller ID"
            value={ghost.intelligence.callerClaimedIdentity || 'Unknown'}
            icon="badge"
            color={Colors.textSecondary}
          />
          <IntelCard
            label="Payment"
            value={ghost.intelligence.paymentMentioned ? 'REQUESTED' : 'None'}
            icon="payments"
            color={ghost.intelligence.paymentMentioned ? Colors.danger : Colors.safe}
          />
          <IntelCard
            label="ID Consistency"
            value={`${ghost.intelligence.identityConsistency}%`}
            icon="verified-user"
            color={ghost.intelligence.identityConsistency < 70 ? Colors.danger : Colors.safe}
          />
          {ghost.deepfakeConfidence > 20 && (
            <IntelCard
              label="Deepfake"
              value={`${ghost.deepfakeConfidence}%`}
              icon="record-voice-over"
              color={Colors.warning}
            />
          )}
        </ScrollView>

        {/* Conversation Transcript */}
        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={{ padding: Spacing.sm + 4, gap: Spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {ghost.messages.length === 0 && (
            <View style={styles.emptyTranscript}>
              <MaterialIcons name="hearing" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{personaName} is ready to answer.</Text>
              <Text style={styles.emptySubText}>Type what the caller says below.</Text>
            </View>
          )}
          {ghost.messages.map((msg, i) => {
            const isAI = msg.role === 'ai';
            return (
              <View key={msg.id} style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleCaller]}>
                <Text style={[styles.bubbleRole, { color: isAI ? Colors.primary : Colors.warning }]}>
                  {isAI ? `${personaName} (CALLSHIELD AI)` : 'CALLER'}
                </Text>
                <Text style={[styles.bubbleText, isAI && { color: Colors.text }]}>{msg.text}</Text>
                {isAI && msg.state && (
                  <Text style={styles.stateTag}>{msg.state.replace(/_/g, ' ').toUpperCase()}</Text>
                )}
              </View>
            );
          })}
          {ghost.isProcessing && (
            <View style={[styles.bubble, styles.bubbleAI]}>
              <Text style={styles.typingDots}>● ● ●</Text>
            </View>
          )}
        </ScrollView>

        {/* Input Row */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 4 }]}>
          <TextInput
            style={styles.input}
            value={ghost.inputText}
            onChangeText={ghost.setInputText}
            placeholder={`Type what caller says → ${personaName} responds via voice`}
            placeholderTextColor={Colors.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!ghost.isProcessing}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!ghost.inputText.trim() || ghost.isProcessing) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!ghost.inputText.trim() || ghost.isProcessing}
            activeOpacity={0.85}
          >
            <MaterialIcons name="send" size={18} color={ghost.inputText.trim() ? Colors.bg : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.joinBtn} onPress={handleEnd} activeOpacity={0.85}>
            <MaterialIcons name="phone" size={16} color={Colors.textInverse} />
            <Text style={styles.joinText}>Join Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exposeBtn, ghost.isExposeMode && styles.exposeBtnActive]}
            onPress={ghost.enableExposeMode}
            disabled={ghost.isExposeMode}
            activeOpacity={0.85}
          >
            <MaterialIcons name="bug-report" size={16} color={ghost.isExposeMode ? Colors.textInverse : Colors.warning} />
            <Text style={[styles.exposeText, ghost.isExposeMode && { color: Colors.textInverse }]}>
              {ghost.isExposeMode ? 'Exposing...' : 'Expose Mode'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.85}>
            <MaterialIcons name="call-end" size={16} color="#fff" />
            <Text style={styles.endText}>End</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  ghostBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  ghostBadgeExpose: { backgroundColor: Colors.warningGlow, borderColor: Colors.warning + '55' },
  ghostDot: { width: 8, height: 8, borderRadius: 4 },
  ghostBadgeText: { fontSize: 11, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  durationPill: {
    backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  avatarSection: { alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.xs },
  pulseRing: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2,
  },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  avatarCore: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  personaName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  personaStatus: { fontSize: FontSize.sm },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, marginBottom: 4,
  },
  scoreLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  risingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.danger + '55',
  },
  risingText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  scoreNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  meterTrack: { height: 4, backgroundColor: Colors.bgSurface, marginHorizontal: Spacing.md, borderRadius: 2, overflow: 'hidden', marginBottom: Spacing.sm },
  meterFill: { height: '100%', borderRadius: 2 },

  factCheck: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    marginHorizontal: Spacing.md, backgroundColor: Colors.warningGlow,
    borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.warning + '55',
    marginBottom: Spacing.sm,
  },
  factCheckText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 17 },

  intelScroll: { maxHeight: 76, marginBottom: Spacing.sm },
  intelCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm + 2,
    alignItems: 'center', gap: 2, borderWidth: 1, minWidth: 90,
  },
  intelLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.bold, letterSpacing: 0.5, textAlign: 'center' },
  intelValue: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, textAlign: 'center' },

  transcript: {
    flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  emptyTranscript: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.xs, color: Colors.textMuted },
  bubble: {
    borderRadius: Radius.md, padding: Spacing.sm + 2, maxWidth: '88%', gap: 3,
  },
  bubbleAI: {
    alignSelf: 'flex-end', backgroundColor: Colors.primaryGlow,
    borderWidth: 1, borderColor: Colors.borderStrong, borderBottomRightRadius: 4,
  },
  bubbleCaller: {
    alignSelf: 'flex-start', backgroundColor: Colors.bgSurface,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderBottomLeftRadius: 4,
  },
  bubbleRole: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  bubbleText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  stateTag: { fontSize: 8, color: Colors.textMuted, letterSpacing: 0.5 },
  typingDots: { fontSize: FontSize.md, color: Colors.primary, letterSpacing: 5 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.sm, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong,
    maxHeight: 80, includeFontPadding: false,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  sendBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },

  actions: {
    flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
  },
  joinBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.safe, borderRadius: Radius.full, paddingVertical: 12,
  },
  joinText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  exposeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.warning + '55',
  },
  exposeBtnActive: { backgroundColor: Colors.warning },
  exposeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.warning },
  endBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.danger, borderRadius: Radius.full, paddingVertical: 12,
    ...Shadow.danger,
  },
  endText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
});

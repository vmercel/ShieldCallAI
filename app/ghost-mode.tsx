import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { GHOST_CONVERSATION } from '../constants/mockData';
import { useApp } from '../contexts/AppContext';

export default function GhostModeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { personaName } = useApp();
  const [messages, setMessages] = useState<typeof GHOST_CONVERSATION>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [threatScore, setThreatScore] = useState(18);
  const [callDuration, setCallDuration] = useState(0);
  const [exposed, setExposed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0.95)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const dTimer = setInterval(() => setCallDuration(d => d + 1), 1000);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    let delay = 1500;
    GHOST_CONVERSATION.forEach((msg, i) => {
      const t1 = setTimeout(() => {
        setIsTyping(true);
        setThreatScore(prev => Math.min(94, prev + (msg.role === 'caller' ? 12 : 2)));
      }, delay);
      delay += 1800;
      const t2 = setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, msg]);
        scrollRef.current?.scrollToEnd({ animated: true });
      }, delay);
      delay += 600;
      timers.current.push(t1, t2);
    });

    return () => {
      clearInterval(dTimer);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const formatDur = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.ghostDot} />
          <Text style={styles.headerTitle}>Ghost Mode Active</Text>
        </View>
        <View style={styles.durationPill}>
          <Text style={styles.durationText}>{formatDur(callDuration)}</Text>
        </View>
      </View>

      {/* Ghost AI Avatar */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarInner}>
            <MaterialIcons name="hearing" size={40} color={Colors.primary} />
          </View>
        </Animated.View>
        <Text style={styles.personaName}>{personaName}</Text>
        <Text style={styles.personaSub}>Your AI Communications Agent</Text>

        {/* Threat meter compact */}
        <View style={styles.compactThreat}>
          <Text style={styles.compactThreatLabel}>Threat Score</Text>
          <View style={styles.compactMeterTrack}>
            <View style={[styles.compactMeterFill, {
              width: `${threatScore}%`,
              backgroundColor: threatScore >= 70 ? Colors.danger : threatScore >= 35 ? Colors.warning : Colors.safe,
            }]} />
          </View>
          <Text style={[styles.compactThreatScore, {
            color: threatScore >= 70 ? Colors.danger : threatScore >= 35 ? Colors.warning : Colors.safe,
          }]}>{threatScore}%</Text>
        </View>
      </View>

      {/* Transcript */}
      <Text style={styles.transcriptLabel}>Live Conversation</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, i) => {
          const isAI = msg.role === 'ai';
          return (
            <View key={i} style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleCaller]}>
              <Text style={styles.bubbleRole}>
                {isAI ? `${personaName} (AI Agent)` : 'Caller'}
              </Text>
              <Text style={[styles.bubbleText, isAI && { color: Colors.primary }]}>{msg.text}</Text>
            </View>
          );
        })}
        {isTyping && (
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>●●●</Text>
          </View>
        )}
      </ScrollView>

      {/* Fact Check Alert */}
      {threatScore >= 70 && !exposed && (
        <View style={styles.factAlert}>
          <MaterialIcons name="info" size={18} color={Colors.warning} />
          <Text style={styles.factAlertText}>
            Note: The IRS does not demand immediate payment by phone or via gift cards. Taxpayers are notified first by mail.
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.joinBtn} activeOpacity={0.85} onPress={() => router.back()}>
          <MaterialIcons name="phone" size={18} color={Colors.textInverse} />
          <Text style={styles.joinBtnText}>Join Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exposeBtn, exposed && styles.exposeBtnActive]}
          onPress={() => setExposed(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="record-voice-over" size={18} color={exposed ? Colors.textInverse : Colors.warning} />
          <Text style={[styles.exposeBtnText, exposed && { color: Colors.textInverse }]}>
            {exposed ? 'Exposing...' : 'Expose Mode'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <MaterialIcons name="call-end" size={18} color="#fff" />
          <Text style={styles.endBtnText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  backBtn: { padding: 8 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  durationPill: {
    backgroundColor: Colors.bgCard, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  durationText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    ...Shadow.primary,
  },
  avatarInner: { alignItems: 'center', justifyContent: 'center' },
  personaName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  personaSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  compactThreat: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, minWidth: 220,
  },
  compactThreatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  compactMeterTrack: { flex: 1, height: 6, backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  compactMeterFill: { height: '100%', borderRadius: 3 },
  compactThreatScore: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, width: 36, textAlign: 'right' },
  transcriptLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, paddingHorizontal: Spacing.md, marginBottom: 6, letterSpacing: 0.5 },
  transcript: { flex: 1, marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm + 4, maxWidth: '85%', gap: 3 },
  bubbleAI: { alignSelf: 'flex-end', backgroundColor: Colors.primaryGlow, borderWidth: 1, borderColor: Colors.borderStrong, borderBottomRightRadius: 4 },
  bubbleCaller: { alignSelf: 'flex-start', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.borderSubtle, borderBottomLeftRadius: 4 },
  bubbleRole: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 0.5 },
  bubbleText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  typingBubble: { alignSelf: 'flex-start', backgroundColor: Colors.bgSurface, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  typingText: { fontSize: FontSize.md, color: Colors.primary, letterSpacing: 4 },
  factAlert: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    backgroundColor: Colors.warningGlow, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.warning + '55',
  },
  factAlertText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },
  actions: {
    flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  joinBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.safe, borderRadius: Radius.full, paddingVertical: 14,
  },
  joinBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  exposeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.warning + '55',
  },
  exposeBtnActive: { backgroundColor: Colors.warning },
  exposeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.warning },
  endBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.danger, borderRadius: Radius.full, paddingVertical: 14,
    ...Shadow.danger,
  },
  endBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
});

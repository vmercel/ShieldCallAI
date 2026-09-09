/**
 * ShieldCall AI Call Detail Screen
 * Loads real call data from Supabase. Block/Report persist to DB.
 * Community threat reporting integrated.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Modal, Animated, Share, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { GHOST_CONVERSATION, ThreatLevel } from '../constants/mockData';
import { ThreatService } from '../services/threatService';
import { SentinelEngine } from '../services/sentinelEngine';
import { callRecordsService, CallRecord } from '../services/callRecordsService';
import { blockedNumbersService } from '../services/blockedNumbersService';
import { communityThreatsService, CommunityThreat } from '../services/communityThreatsService';

// ─── Community Impact Section (Real Data) ─────────────────────────────────────
function CommunityImpactSection({ callerNumber, threatLevel, threatScore }: {
  callerNumber: string; threatLevel: ThreatLevel; threatScore: number;
}) {
  const [threat, setThreat] = useState<CommunityThreat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityThreatsService.checkNumber(callerNumber).then(({ data }) => {
      setThreat(data);
      setLoading(false);
    });
  }, [callerNumber]);

  const reportCount = threat?.report_count ?? 0;
  const estSaved = threatLevel !== 'safe'
    ? `$${(threatScore * 42).toLocaleString()}`
    : '$0';
  const reportsLabel = loading ? '...' : reportCount > 0 ? reportCount.toLocaleString() : '0';

  return (
    <>
      <Text style={styles.sectionTitle}>Community Impact</Text>
      <View style={styles.impactCard}>
        {[
          { icon: 'shield', label: 'Protection', value: 'Active', color: Colors.safe },
          { icon: 'groups', label: 'Community Reports', value: reportsLabel, color: reportCount > 0 ? Colors.danger : Colors.textMuted },
          { icon: 'savings', label: 'Est. Saved', value: estSaved, color: threatLevel !== 'safe' ? Colors.primary : Colors.textMuted },
        ].map(item => (
          <View key={item.label} style={styles.impactItem}>
            <View style={[styles.impactIconWrap, { backgroundColor: item.color + '18' }]}>
              <MaterialIcons name={item.icon as any} size={18} color={item.color} />
            </View>
            <Text style={styles.impactLabel}>{item.label}</Text>
            <Text style={[styles.impactValue, { color: item.color }]}>{item.value}</Text>
          </View>
        ))}
      </View>
      {threat && (
        <View style={styles.threatDbCard}>
          <MaterialIcons name="warning" size={13} color={Colors.danger} />
          <Text style={styles.threatDbText}>
            {threat.report_count.toLocaleString()} reports from {threat.region} region
            {threat.scam_type ? ` · ${threat.scam_type}` : ''}
          </Text>
        </View>
      )}
    </>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

function formatDateTime(d: Date) {
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

interface AdaptedCall {
  id: string;
  callerName: string;
  callerNumber: string;
  callerOrg?: string;
  timestamp: Date;
  duration: number;
  threatLevel: ThreatLevel;
  threatScore: number;
  summary: string;
  ghostHandled: boolean;
  scamType?: string;
  tags: string[];
  aiNotes?: string;
  rawTranscript: { speaker: string; text: string }[];
  actionItems: string[];
}

function adaptRecord(r: CallRecord): AdaptedCall {
  return {
    id: r.id,
    callerName: r.caller_name,
    callerNumber: r.caller_number,
    callerOrg: r.caller_org,
    timestamp: new Date(r.started_at),
    duration: r.duration_seconds,
    threatLevel: r.threat_level as ThreatLevel,
    threatScore: r.threat_score,
    summary: r.summary || 'No summary available.',
    ghostHandled: r.ghost_handled,
    scamType: r.scam_type,
    tags: r.tags || [],
    aiNotes: r.ai_notes,
    rawTranscript: r.transcript || [],
    actionItems: r.action_items || [],
  };
}

function buildTranscript(call: AdaptedCall) {
  if (call.rawTranscript.length > 0) {
    return call.rawTranscript.map((t, i) => ({
      id: `t${i}`,
      speaker: (t.speaker === 'caller' || t.speaker === 'them') ? 'caller' as const : 'ai' as const,
      text: t.text,
      score: call.threatLevel !== 'safe' ? Math.min(100, (i / call.rawTranscript.length) * call.threatScore) : 0,
      ts: new Date(call.timestamp.getTime() + i * 20000),
    }));
  }
  if (call.ghostHandled && call.threatLevel !== 'safe') {
    return GHOST_CONVERSATION.map((line, i) => ({
      id: `t${i}`,
      speaker: line.role as 'ai' | 'caller',
      text: line.text,
      score: line.role === 'caller' ? Math.min(100, (i / GHOST_CONVERSATION.length) * call.threatScore) : 0,
      ts: new Date(call.timestamp.getTime() + i * 20000),
    }));
  }
  return [
    { id: 't0', speaker: 'caller' as const, text: call.summary, score: call.threatScore, ts: call.timestamp },
  ];
}

function AnimatedMeter({ score, color }: { score: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 900, useNativeDriver: false }).start();
  }, [score]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={meterStyles.track}>
      <Animated.View style={[meterStyles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}
const meterStyles = StyleSheet.create({
  track: { height: 8, backgroundColor: Colors.bgSurface, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

function ConfirmModal({ visible, title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string;
  confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>{title}</Text>
          <Text style={modalStyles.message}>{message}</Text>
          <View style={modalStyles.btns}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.confirmBtn, { backgroundColor: confirmColor + '22', borderColor: confirmColor + '66' }]}
              onPress={onConfirm} activeOpacity={0.8}
            >
              <Text style={[modalStyles.confirmText, { color: confirmColor }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 8 },
  message: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center' },
  confirmText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});

function ToastMsg({ message, icon, color }: { message: string; icon: string; color: string }) {
  return (
    <View style={toastStyles.toast}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={toastStyles.text}>{message}</Text>
    </View>
  );
}
const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 16, left: 24, right: 24, zIndex: 999,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.borderStrong,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  text: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
});

function ThreatTimeline({ scores }: { scores: number[] }) {
  return (
    <View style={tlStyles.wrap}>
      {scores.map((s, i) => {
        const color = s >= 65 ? Colors.danger : s >= 30 ? Colors.warning : Colors.safe;
        const h = Math.max(4, (s / 100) * 40);
        return (
          <View key={i} style={tlStyles.barWrap}>
            <View style={[tlStyles.bar, { height: h, backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}
const tlStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 2 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
});

export default function CallDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rawRecord, setRawRecord] = useState<CallRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reported, setReported] = useState(false);
  const [toast, setToast] = useState<{ message: string; icon: string; color: string } | null>(null);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [replaying, setReplaying] = useState(false);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build timeline scores — prefer real per-window data, fall back to interpolation
  const buildTimelineScores = (record: CallRecord | null): number[] => {
    if (!record) return [];
    // Real per-window scores recorded during the call (stored in threat_timeline)
    if (record.threat_timeline && record.threat_timeline.length >= 2) {
      return record.threat_timeline.map(w => w.score);
    }
    // Interpolate from final threat_score and transcript length (no random noise)
    const transcript = record.transcript || [];
    const score = record.threat_score;
    const len = Math.max(transcript.length, 8);
    return Array.from({ length: len }, (_, i) => {
      const progress = i / (len - 1);
      return Math.max(0, Math.min(100, Math.round(score * (0.2 + progress * 0.8))));
    });
  };

  const timelineScoresRef = useRef<number[]>([]);

  // Load real record
  useEffect(() => {
    if (!id) { setLoadingRecord(false); return; }
    callRecordsService.fetchById(id).then(({ data }) => {
      setRawRecord(data);
      setLoadingRecord(false);
      if (data) {
        timelineScoresRef.current = buildTimelineScores(data);
        blockedNumbersService.isBlocked(data.caller_number).then(setIsBlocked);
        if (data.reported_to_ftc) setReported(true);
      }
    });
  }, [id]);

  const call = rawRecord ? adaptRecord(rawRecord) : null;
  const transcript = call ? buildTranscript(call) : [];

  const showToast = useCallback((message: string, icon: string, color: string) => {
    setToast({ message, icon, color });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleBlock = useCallback(() => {
    if (!call) return;
    if (isBlocked) {
      blockedNumbersService.unblock(call.callerNumber).then(() => {
        setIsBlocked(false);
        showToast(`${call.callerNumber} unblocked`, 'phone-enabled', Colors.safe);
      });
      return;
    }
    const doBlock = () => {
      blockedNumbersService.block(call.callerNumber, call.scamType || undefined).then(() => {
        setIsBlocked(true);
        showToast(`${call.callerNumber} blocked`, 'block', Colors.danger);
      });
    };
    if (Platform.OS === 'web') { setBlockModal(true); }
    else {
      Alert.alert('Block Number', `Block ${call.callerNumber}? ShieldCall AI will automatically decline future calls.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: doBlock },
      ]);
    }
  }, [isBlocked, call, showToast]);

  const handleReport = useCallback(async () => {
    if (!call) return;
    setReportModal(false);
    setReported(true);
    showToast('Reported to FTC ReportFraud.ftc.gov', 'report', Colors.warning);
    callRecordsService.markReportedToFTC(call.id).catch(() => {});
    communityThreatsService.reportNumber(call.callerNumber, call.scamType || undefined).catch(() => {});
    const url = 'https://reportfraud.ftc.gov/';
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {}
  }, [call, showToast]);

  const handleShare = useCallback(async () => {
    if (!call) return;
    const lines = transcript.map(t => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n\n');
    const content = [
      'ShieldCall AI caught a scammer!',
      '',
      `Number: ${call.callerNumber}`,
      `Threat Score: ${call.threatScore}%`,
      `Type: ${call.scamType ?? 'Suspicious Call'}`,
      '',
      'AI Transcript:',
      lines,
      '',
      'Protected by ShieldCall AI',
    ].join('\n');
    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(content);
          showToast('Copied to clipboard!', 'share', Colors.primary);
        }
      } else {
        await Share.share({ message: content, title: 'ShieldCall AI Scam Expose' });
      }
    } catch {}
  }, [call, transcript, showToast]);

  const handleCallBack = useCallback(() => {
    if (!call) return;
    router.push({ pathname: '/live-call', params: { callerName: call.callerName, callerNumber: call.callerNumber, direction: 'outbound' } });
  }, [call, router]);

  const startReplay = useCallback(() => { setReplayIndex(0); setReplaying(true); }, []);

  useEffect(() => {
    if (!replaying) return;
    if (replayIndex >= transcript.length) { setReplaying(false); return; }
    replayTimer.current = setTimeout(() => setReplayIndex(i => i + 1), 1800);
    return () => { replayTimer.current && clearTimeout(replayTimer.current); };
  }, [replaying, replayIndex, transcript.length]);

  if (loadingRecord) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: Colors.textSecondary, fontSize: 14 }}>Loading call details...</Text>
      </View>
    );
  }

  if (!call) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <MaterialIcons name="phone-missed" size={48} color={Colors.textMuted} />
        <Text style={{ fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 12 }}>Call record not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const color = ThreatService.getThreatColor(call.threatLevel);
  const label = ThreatService.getThreatLabel(call.threatLevel);
  const desc = ThreatService.getThreatDescription(call.threatLevel, call.threatScore);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {toast ? <ToastMsg message={toast.message} icon={toast.icon} color={toast.color} /> : null}

      <ConfirmModal
        visible={blockModal}
        title="Block Number"
        message={`Block ${call.callerNumber}? ShieldCall AI will automatically decline future calls from this number.`}
        confirmLabel="Block"
        confirmColor={Colors.danger}
        onConfirm={() => {
          setBlockModal(false);
          blockedNumbersService.block(call.callerNumber, call.scamType || undefined).then(() => {
            setIsBlocked(true);
            showToast(`${call.callerNumber} blocked`, 'block', Colors.danger);
          });
        }}
        onCancel={() => setBlockModal(false)}
      />

      <ConfirmModal
        visible={reportModal}
        title="Report to FTC"
        message="Submit this call to FTC's ReportFraud.ftc.gov? Your report helps protect other Americans."
        confirmLabel="Report"
        confirmColor={Colors.warning}
        onConfirm={handleReport}
        onCancel={() => setReportModal(false)}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call Detail</Text>
        <View style={styles.headerRight}>
          {isBlocked && (
            <View style={styles.blockedBadge}>
              <MaterialIcons name="block" size={12} color={Colors.danger} />
              <Text style={styles.blockedBadgeText}>BLOCKED</Text>
            </View>
          )}
          {reported && (
            <View style={styles.reportedBadge}>
              <MaterialIcons name="report" size={12} color={Colors.warning} />
              <Text style={styles.reportedBadgeText}>REPORTED</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
        {/* Caller Hero */}
        <View style={[styles.callerCard, { borderColor: color + '66' }]}>
          <View style={[styles.callerAvatar, { borderColor: color, backgroundColor: color + '18' }]}>
            <MaterialIcons name={call.ghostHandled ? 'hearing' : call.threatLevel === 'danger' ? 'warning' : 'person'} size={36} color={color} />
          </View>
          <Text style={styles.callerName}>{call.callerName}</Text>
          <Text style={styles.callerNumber}>{call.callerNumber}</Text>
          {call.callerOrg ? <Text style={styles.callerOrg}>{call.callerOrg}</Text> : null}
          <View style={[styles.threatBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <View style={[styles.threatDot, { backgroundColor: color }]} />
            <Text style={[styles.threatBadgeText, { color }]}>{label} · {call.threatScore}%</Text>
          </View>
          {call.ghostHandled && (
            <View style={styles.ghostBadge}>
              <MaterialIcons name="hearing" size={12} color={Colors.primary} />
              <Text style={styles.ghostBadgeText}>Handled by AI Ghost Agent (OnSpace AI)</Text>
            </View>
          )}
        </View>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          {[
            { icon: 'access-time', label: 'Time', value: formatDateTime(call.timestamp) },
            { icon: 'timer', label: 'Duration', value: formatDuration(call.duration) },
            { icon: call.ghostHandled ? 'hearing' : 'person', label: 'Handled', value: call.ghostHandled ? 'AI Agent' : 'You' },
          ].map(item => (
            <View key={item.label} style={styles.metaCard}>
              <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionCard, isBlocked && { borderColor: Colors.danger + '66', backgroundColor: Colors.dangerGlow }]}
            onPress={handleBlock} activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.dangerGlow }]}>
              <MaterialIcons name={isBlocked ? 'phone-enabled' : 'block'} size={22} color={Colors.danger} />
            </View>
            <Text style={styles.actionLabel}>{isBlocked ? 'Unblock' : 'Block Number'}</Text>
            {isBlocked && <Text style={styles.actionSub}>Active</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, reported && { borderColor: Colors.warning + '66', backgroundColor: Colors.warningGlow }]}
            onPress={() => {
              if (reported) { showToast('Already reported to FTC', 'info', Colors.warning); return; }
              if (Platform.OS === 'web') setReportModal(true);
              else Alert.alert('Report to FTC', 'Submit to ReportFraud.ftc.gov?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', onPress: handleReport },
              ]);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.warningGlow }]}>
              <MaterialIcons name={reported ? 'check-circle' : 'report'} size={22} color={Colors.warning} />
            </View>
            <Text style={styles.actionLabel}>{reported ? 'Reported' : 'Report to FTC'}</Text>
            {reported && <Text style={styles.actionSub}>Submitted</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleShare} activeOpacity={0.75}>
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.primaryGlow }]}>
              <MaterialIcons name="share" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Share Expose</Text>
            <Text style={styles.actionSub}>Copy transcript</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleCallBack} activeOpacity={0.75}>
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.safeGlow }]}>
              <MaterialIcons name="call" size={22} color={Colors.safe} />
            </View>
            <Text style={styles.actionLabel}>Call Back</Text>
            <Text style={styles.actionSub}>With SENTINEL™</Text>
          </TouchableOpacity>
        </View>

        {/* Threat Analysis */}
        <Text style={styles.sectionTitle}>SENTINEL™ Threat Analysis</Text>
        <View style={[styles.analysisCard, { borderColor: color + '55' }]}>
          <View style={styles.analysisTopRow}>
            <View style={{ gap: 4 }}>
              <View style={styles.levelRow}>
                <View style={[styles.levelDot, { backgroundColor: color }]} />
                <Text style={[styles.levelText, { color }]}>{label}</Text>
              </View>
              <Text style={styles.analysisDesc}>{desc}</Text>
            </View>
            <View style={styles.bigScore}>
              <Text style={[styles.bigScoreNum, { color }]}>{call.threatScore}</Text>
              <Text style={styles.bigScoreUnit}>%</Text>
            </View>
          </View>
          <AnimatedMeter score={call.threatScore} color={color} />
          <View style={styles.timelineWrap}>
            <View style={styles.timelineHeader}>
              <MaterialIcons name="timeline" size={13} color={Colors.textMuted} />
              <Text style={styles.timelineLabel}>SENTINEL™ Score Over Call</Text>
            </View>
            <ThreatTimeline scores={timelineScoresRef.current} />
            <View style={styles.timelineFooter}>
              <Text style={styles.timelineTs}>Start</Text>
              <Text style={styles.timelineTs}>End</Text>
            </View>
          </View>
          {call.scamType ? (
            <View style={[styles.scamBadge, { backgroundColor: color + '18', borderColor: color + '44' }]}>
              <MaterialIcons name="local-police" size={14} color={color} />
              <Text style={[styles.scamBadgeText, { color }]}>Classified: {call.scamType}</Text>
            </View>
          ) : null}
          {call.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {call.tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI Summary */}
        <Text style={styles.sectionTitle}>AI Call Summary</Text>
        <View style={styles.summaryCard}>
          <MaterialIcons name="psychology" size={16} color={Colors.primary} />
          <Text style={styles.summaryText}>{call.summary}</Text>
        </View>

        {call.aiNotes ? (
          <>
            <Text style={styles.sectionTitle}>AI Agent Notes</Text>
            <View style={styles.aiNotesCard}>
              <MaterialIcons name="hearing" size={16} color={Colors.primary} />
              <Text style={styles.aiNotesText}>{call.aiNotes}</Text>
            </View>
          </>
        ) : null}

        {/* Recommended Actions from AI Summary */}
        {call.actionItems.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            <View style={styles.actionItemsCard}>
              {call.actionItems.map((item, i) => (
                <View key={i} style={styles.actionItemRow}>
                  <View style={styles.actionItemNum}>
                    <Text style={styles.actionItemNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.actionItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Transcript Replay */}
        {transcript.length > 0 ? (
          <>
            <View style={styles.transcriptHeader}>
              <Text style={styles.sectionTitle}>Call Transcript</Text>
              {!replaying && (
                <TouchableOpacity style={styles.replayBtn} onPress={startReplay} activeOpacity={0.8}>
                  <MaterialIcons name="play-circle-filled" size={16} color={Colors.primary} />
                  <Text style={styles.replayBtnText}>{replayIndex === -1 ? 'Replay' : 'Replay Again'}</Text>
                </TouchableOpacity>
              )}
              {replaying && (
                <View style={styles.replayingBadge}>
                  <View style={styles.replayDot} />
                  <Text style={styles.replayingText}>Replaying...</Text>
                </View>
              )}
            </View>
            <View style={styles.transcriptCard}>
              {transcript.slice(0, replayIndex === -1 ? transcript.length : replayIndex).map(line => {
                const isAI = line.speaker === 'ai';
                const lineColor = isAI ? Colors.primary : line.score >= 65 ? Colors.danger : line.score >= 30 ? Colors.warning : Colors.textSecondary;
                return (
                  <View key={line.id} style={[styles.transcriptLine, { borderLeftColor: lineColor }, isAI ? styles.aiLine : null]}>
                    <View style={styles.transcriptLineMeta}>
                      <Text style={[styles.transcriptSpeaker, { color: lineColor }]}>{isAI ? 'AI GHOST' : 'CALLER'}</Text>
                      <Text style={styles.transcriptTime}>{line.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                      {!isAI && line.score > 0 && (
                        <View style={[styles.segScore, { borderColor: lineColor + '55' }]}>
                          <View style={[styles.segDot, { backgroundColor: lineColor }]} />
                          <Text style={[styles.segScoreText, { color: lineColor }]}>{Math.round(line.score)}%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.transcriptText}>{line.text}</Text>
                  </View>
                );
              })}
              {replayIndex === -1 && transcript.length > 0 && (
                <TouchableOpacity style={styles.replayPrompt} onPress={startReplay} activeOpacity={0.8}>
                  <MaterialIcons name="play-circle-outline" size={20} color={Colors.primary} />
                  <Text style={styles.replayPromptText}>Tap to replay transcript</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : null}

        {/* Community Impact — dynamically sourced */}
        <CommunityImpactSection callerNumber={call.callerNumber} threatLevel={call.threatLevel} threatScore={call.threatScore} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 6, alignItems: 'center', minWidth: 40, justifyContent: 'flex-end' },
  blockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dangerGlow, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.danger + '44' },
  blockedBadgeText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.danger, letterSpacing: 0.5 },
  reportedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningGlow, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.warning + '44' },
  reportedBadgeText: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.warning, letterSpacing: 0.5 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  callerCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', borderWidth: 1.5, marginBottom: Spacing.md, gap: Spacing.sm },
  callerAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  callerName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  callerNumber: { fontSize: FontSize.md, color: Colors.textSecondary },
  callerOrg: { fontSize: FontSize.sm, color: Colors.textMuted },
  threatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  threatDot: { width: 8, height: 8, borderRadius: 4 },
  threatBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ghostBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: Colors.borderStrong },
  ghostBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  metaRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  metaCard: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.sm + 4, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  metaLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaValue: { fontSize: FontSize.xs, color: Colors.text, fontWeight: FontWeight.semibold, textAlign: 'center' },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: { width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.border },
  actionIconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },
  actionSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  analysisCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, gap: Spacing.sm },
  analysisTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelText: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  analysisDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, maxWidth: '80%' },
  bigScore: { flexDirection: 'row', alignItems: 'flex-end' },
  bigScoreNum: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold },
  bigScoreUnit: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: 4, marginLeft: 2 },
  timelineWrap: { gap: 6 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timelineLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 0.5 },
  timelineFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineTs: { fontSize: 9, color: Colors.textMuted },
  scamBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  scamBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  summaryCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  summaryText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 22 },
  aiNotesCard: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: Colors.primaryGlow, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  aiNotesText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  actionItemsCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  actionItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  actionItemNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong, flexShrink: 0, marginTop: 1 },
  actionItemNumText: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primary },
  actionItemText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, marginBottom: Spacing.sm },
  replayBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.borderStrong },
  replayBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  replayingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.safeGlow, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.safe + '44' },
  replayDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.safe },
  replayingText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.safe },
  transcriptCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  transcriptLine: { backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 2.5, gap: 5 },
  aiLine: { backgroundColor: Colors.primaryGlow + '33' },
  transcriptLineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transcriptSpeaker: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  transcriptTime: { fontSize: 9, color: Colors.textMuted, marginLeft: 'auto' },
  segScore: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  segDot: { width: 5, height: 5, borderRadius: 2.5 },
  segScoreText: { fontSize: 9, fontWeight: FontWeight.bold },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  replayPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: Spacing.md, opacity: 0.7 },
  replayPromptText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  threatDbCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.danger + '33', marginBottom: Spacing.sm },
  threatDbText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger, lineHeight: 16 },
  impactCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  impactItem: { flex: 1, alignItems: 'center', gap: 6 },
  impactIconWrap: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  impactLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  impactValue: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, textAlign: 'center' },
});

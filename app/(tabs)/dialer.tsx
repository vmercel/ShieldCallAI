/**
 * CALLSHIELD AI Dialer — Powered by OnSpace AI (Gemini 3 Flash)
 *
 * Three interaction modes:
 * 1. VOICE COMMAND  — Say "Call Mom" → instant dial
 * 2. AI AGENT       — Type a task → AI conducts the full call autonomously
 * 3. CONTACTS       — Phone book search + quick-dial
 *
 * The AI Agent tab uses OnSpace AI to simulate complete call flows:
 * IVR navigation, hold, agent interaction, task completion, and summary.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, FlatList, Pressable, Platform,
  Vibration, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { CONTACTS, Contact, searchContacts, getFavorites, getInitials, findContactByNumber } from '../../constants/contacts';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { parseVoiceCommand } from '../../services/voiceCommandService';
import { aiDialerService, DialerResult } from '../../services/aiDialerService';
import { callRecordsService } from '../../services/callRecordsService';

type Tab = 'voice' | 'pad' | 'agent' | 'contacts';

const PAD_KEYS = [
  { digit: '1', sub: '' }, { digit: '2', sub: 'ABC' }, { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' }, { digit: '5', sub: 'JKL' }, { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' }, { digit: '8', sub: 'TUV' }, { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' }, { digit: '0', sub: '+' }, { digit: '#', sub: '' },
];

const QUICK_TASKS = [
  { icon: 'local-pharmacy', label: 'Refill Prescription', example: 'Call CVS Pharmacy and refill my blood pressure medication' },
  { icon: 'event', label: 'Confirm Appointment', example: 'Call Dr. Nguyen and confirm my appointment on the 15th' },
  { icon: 'cancel', label: 'Cancel Subscription', example: 'Call and cancel my Comcast internet subscription' },
  { icon: 'headset', label: 'File Insurance Claim', example: 'Call my insurance company about a claim denial and get a supervisor' },
  { icon: 'build', label: 'Schedule Plumber', example: 'Schedule a licensed plumber for a leaky faucet next week' },
  { icon: 'local-shipping', label: 'Track Delivery', example: 'Call UPS to find out where my package is and get an ETA' },
];

function ContactAvatar({ contact, size = 44 }: { contact: Contact; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: contact.avatarColor + '33',
      borderWidth: 1.5, borderColor: contact.avatarColor + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '700', color: contact.avatarColor }}>
        {getInitials(contact)}
      </Text>
    </View>
  );
}

function MicButton({ isListening, onPress }: { isListening: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      const pulsate = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.93, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const ripple = Animated.loop(
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1.7, duration: 1400, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      );
      ring1.setValue(1); ring1Opacity.setValue(0.5);
      pulsate.start(); ripple.start();
      return () => { pulsate.stop(); ripple.stop(); pulse.setValue(1); };
    }
  }, [isListening]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.micBtnOuter, pressed && { opacity: 0.9 }]}>
      <Animated.View style={[styles.micRipple, {
        transform: [{ scale: ring1 }], opacity: ring1Opacity,
        borderColor: isListening ? Colors.danger : Colors.primary,
      }]} />
      <Animated.View style={[
        styles.micBtn,
        { backgroundColor: isListening ? Colors.danger : Colors.primary },
        { transform: [{ scale: pulse }] },
      ]}>
        <MaterialIcons name={isListening ? 'mic' : 'mic-none'} size={38} color="#fff" />
      </Animated.View>
    </Pressable>
  );
}

// ─── DIAL PAD TAB ──────────────────────────────────────────────────────────
function DialPadTab({ onDial }: { onDial: (num: string) => void }) {
  const [digits, setDigits] = useState('');

  const handleKey = (digit: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(25);
    setDigits(prev => prev.length < 16 ? prev + digit : prev);
  };

  const handleDelete = () => {
    setDigits(prev => prev.slice(0, -1));
  };

  // Find matching contacts as digits are typed
  const matchedContacts = digits.length >= 3
    ? CONTACTS.filter(c => c.number.replace(/\D/g, '').includes(digits.replace(/\D/g, '')))
    : [];

  const formatDisplay = (d: string) => {
    const clean = d.replace(/\D/g, '');
    if (clean.length === 0) return '';
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
    if (clean.length <= 10) return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    return `+${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7, 11)}`;
  };

  return (
    <View style={styles.padTab}>
      {/* Display */}
      <View style={styles.padDisplay}>
        <Text
          style={[styles.padDigits, digits.length === 0 && styles.padDigitsPlaceholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {digits.length > 0 ? formatDisplay(digits) : 'Enter number...'}
        </Text>
        {digits.length > 0 && (
          <TouchableOpacity
            onPress={handleDelete}
            onLongPress={() => setDigits('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="backspace" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Matched Contacts */}
      {matchedContacts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.padMatchRow}
        >
          {matchedContacts.slice(0, 5).map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.padMatchChip}
              onPress={() => setDigits(c.number.replace(/\D/g, ''))}
              activeOpacity={0.8}
            >
              <View style={[styles.padMatchDot, { backgroundColor: c.avatarColor }]} />
              <Text style={styles.padMatchName} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Key Pad */}
      <View style={styles.padGrid}>
        {PAD_KEYS.map(key => (
          <TouchableOpacity
            key={key.digit}
            style={styles.padKey}
            onPress={() => handleKey(key.digit)}
            activeOpacity={0.7}
          >
            <Text style={styles.padKeyDigit}>{key.digit}</Text>
            {key.sub ? <Text style={styles.padKeySub}>{key.sub}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Call Button */}
      <TouchableOpacity
        style={[styles.padCallBtn, !digits.trim() && styles.padCallBtnDisabled]}
        onPress={() => { if (digits.trim()) onDial(digits.trim()); }}
        disabled={!digits.trim()}
        activeOpacity={0.85}
      >
        <MaterialIcons name="phone" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── VOICE TAB ─────────────────────────────────────────────────────────────
function VoiceTab({ onDial, onContact }: { onDial: (num: string) => void; onContact: (c: Contact) => void }) {
  const voice = useVoiceCommand();
  const [manualInput, setManualInput] = useState('');
  const router = useRouter();

  const handleCommand = useCallback((cmd: ReturnType<typeof parseVoiceCommand>) => {
    if (cmd.action === 'ghost') { router.push('/ghost-mode'); return; }
    if (cmd.action === 'call' && cmd.target) {
      if (cmd.targetType === 'number') { onDial(cmd.target); }
      else {
        const results = searchContacts(cmd.target);
        if (results.length > 0) onContact(results[0]);
        else onDial(cmd.target);
      }
    }
  }, [onDial, onContact, router]);

  const handleMic = () => {
    if (voice.state === 'listening') voice.stopListening();
    else { voice.reset(); voice.startListening(); }
  };

  useEffect(() => {
    if (voice.parsedCommand && voice.state === 'done') handleCommand(voice.parsedCommand);
  }, [voice.parsedCommand, voice.state]);

  const isListening = voice.state === 'listening';
  const isManual = voice.state === 'manual' || !voice.isWebSupported;
  const displayText = voice.interimText || voice.finalText;

  return (
    <View style={styles.voiceTab}>
      <View style={styles.voiceHero}>
        <Text style={styles.voiceTitle}>
          {isListening ? 'Listening...' : isManual ? 'Type a command' : 'Tap to speak'}
        </Text>
        <Text style={styles.voiceSub}>
          {isListening
            ? '"Call Mom"   "Dial 415 555 0041"   "Ghost Mode"'
            : isManual
            ? 'Voice recognition unavailable — type your command'
            : 'Say a name, number, or command'}
        </Text>
      </View>

      <MicButton isListening={isListening} onPress={handleMic} />

      {displayText ? (
        <View style={styles.transcriptChip}>
          <MaterialIcons name="graphic-eq" size={14} color={Colors.primary} />
          <Text style={styles.transcriptText} numberOfLines={2}>{displayText}</Text>
        </View>
      ) : null}

      {(isManual || voice.state === 'error') && (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder='Try "Call Mom" or "Dial 415 555 0041"'
            placeholderTextColor={Colors.textMuted}
            value={manualInput}
            onChangeText={setManualInput}
            onSubmitEditing={() => { voice.submitManualText(manualInput); setManualInput(''); }}
            returnKeyType="send"
            autoFocus={isManual}
          />
          <TouchableOpacity
            style={[styles.manualSend, !manualInput.trim() && { opacity: 0.4 }]}
            onPress={() => { voice.submitManualText(manualInput); setManualInput(''); }}
            disabled={!manualInput.trim()}
          >
            <MaterialIcons name="arrow-forward" size={20} color={Colors.bg} />
          </TouchableOpacity>
        </View>
      )}

      {voice.parsedCommand && voice.state === 'done' && (
        <View style={styles.cmdResult}>
          <MaterialIcons name="check-circle" size={16} color={Colors.safe} />
          <Text style={styles.cmdResultText}>
            {voice.parsedCommand.action === 'call'
              ? `Calling ${voice.parsedCommand.target}...`
              : 'Activating Ghost Mode...'}
          </Text>
        </View>
      )}

      <View style={styles.hintRow}>
        {['"Call Dr. Nguyen"', '"Dial 800..."', '"Ghost Mode"'].map(h => (
          <TouchableOpacity key={h} style={styles.hintChip}
            onPress={() => voice.submitManualText(h.replace(/['"]/g, ''))} activeOpacity={0.8}>
            <Text style={styles.hintText}>{h}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.favTitle}>Favorites</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.md }}>
        {getFavorites().map(c => (
          <TouchableOpacity key={c.id} style={styles.favCard} onPress={() => onContact(c)} activeOpacity={0.8}>
            <ContactAvatar contact={c} size={50} />
            <Text style={styles.favName}>{c.name}</Text>
            <Text style={styles.favNum}>{c.number.slice(-4)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── AI AGENT TAB (Real OnSpace AI) ───────────────────────────────────────
type AgentPhase = 'idle' | 'running' | 'complete' | 'error';

function AIAgentTab() {
  const [instruction, setInstruction] = useState('');
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [result, setResult] = useState<DialerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const executeCall = useCallback(async () => {
    if (!instruction.trim()) return;
    setPhase('running');
    setResult(null);
    setError(null);
    setElapsedTime(0);

    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);

    const { data, error: callError } = await aiDialerService.executeCall(instruction.trim());

    timerRef.current && clearInterval(timerRef.current);

    if (callError) {
      setError(callError);
      setPhase('error');
    } else if (data) {
      setResult(data);
      setPhase('complete');

      // Save to call records
      callRecordsService.insert({
        caller_name: data.callDetails.organization || 'AI Dialer Task',
        caller_number: 'AI-DIALED',
        caller_org: data.callDetails.organization,
        direction: 'outbound',
        started_at: new Date(Date.now() - (data.duration || 0) * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: data.duration || 0,
        threat_level: 'safe',
        threat_score: 0,
        scam_type: null,
        summary: data.summary,
        ai_notes: `AI Dialer completed: "${instruction.trim()}"`,
        tags: ['ai-dialer', 'outbound'],
        ghost_handled: true,
        transcript: data.transcript || [],
        flags: [],
        fact_checks: [],
        is_blocked: false,
        reported_to_ftc: false,
      });
    }
  }, [instruction]);

  useEffect(() => {
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, []);

  const resetAgent = () => {
    setPhase('idle');
    setResult(null);
    setError(null);
    setInstruction('');
    setElapsedTime(0);
  };

  return (
    <View style={styles.agentTab}>
      <View style={styles.agentHeader}>
        <View style={styles.agentIconWrap}>
          <MaterialIcons name="support-agent" size={24} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agentTitle}>AI Call Agent</Text>
          <Text style={styles.agentSub}>Powered by OnSpace AI · Gemini 3 Flash</Text>
        </View>
        <View style={styles.agentOnBadge}>
          <View style={styles.agentDot} />
          <Text style={styles.agentOnText}>READY</Text>
        </View>
      </View>

      {phase === 'idle' && (
        <>
          <Text style={styles.agentInstructLabel}>What should the AI handle?</Text>
          <TextInput
            style={styles.agentInput}
            placeholder="e.g. Call CVS and refill my blood pressure medication"
            placeholderTextColor={Colors.textMuted}
            value={instruction}
            onChangeText={setInstruction}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.executeBtn, !instruction.trim() && styles.executeBtnDisabled]}
            onPress={executeCall}
            disabled={!instruction.trim()}
            activeOpacity={0.85}
          >
            <MaterialIcons name="phone-forwarded" size={18} color="#fff" />
            <Text style={styles.executeBtnText}>Let AI Handle This Call</Text>
          </TouchableOpacity>

          <Text style={styles.quickTaskLabel}>Quick Tasks</Text>
          <View style={styles.quickTaskGrid}>
            {QUICK_TASKS.map(task => (
              <TouchableOpacity
                key={task.label}
                style={styles.quickTask}
                onPress={() => setInstruction(task.example)}
                activeOpacity={0.8}
              >
                <MaterialIcons name={task.icon as any} size={18} color={Colors.primary} />
                <Text style={styles.quickTaskLabel2}>{task.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {phase === 'running' && (
        <View style={styles.runningWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.runningTitle}>AI Agent Working...</Text>
          <Text style={styles.runningTask} numberOfLines={2}>{instruction}</Text>
          <View style={styles.runningTimer}>
            <MaterialIcons name="timer" size={14} color={Colors.textMuted} />
            <Text style={styles.runningTimerText}>{elapsedTime}s elapsed</Text>
          </View>
          <Text style={styles.runningNote}>
            Navigating IVR, handling hold music, speaking with agents...
          </Text>
        </View>
      )}

      {phase === 'complete' && result && (
        <View style={styles.resultWrap}>
          {/* Outcome Banner */}
          <View style={[styles.outcomeBanner, {
            backgroundColor: result.outcome === 'success' ? Colors.safeGlow : result.outcome === 'partial' ? Colors.warningGlow : Colors.dangerGlow,
            borderColor: result.outcome === 'success' ? Colors.safe + '55' : result.outcome === 'partial' ? Colors.warning + '55' : Colors.danger + '55',
          }]}>
            <MaterialIcons
              name={result.outcome === 'success' ? 'check-circle' : result.outcome === 'partial' ? 'info' : 'error'}
              size={20}
              color={result.outcome === 'success' ? Colors.safe : result.outcome === 'partial' ? Colors.warning : Colors.danger}
            />
            <Text style={[styles.outcomeText, {
              color: result.outcome === 'success' ? Colors.safe : result.outcome === 'partial' ? Colors.warning : Colors.danger,
            }]}>
              {result.outcome === 'success' ? 'Task Completed' : result.outcome === 'partial' ? 'Partially Completed' : 'Task Failed'}
            </Text>
            <Text style={styles.outcomeDuration}>{result.duration}s</Text>
          </View>

          {/* Summary */}
          <View style={styles.resultSummary}>
            <MaterialIcons name="psychology" size={16} color={Colors.primary} />
            <Text style={styles.resultSummaryText}>{result.summary}</Text>
          </View>

          {/* Call Details */}
          <View style={styles.resultDetails}>
            {[
              { label: 'Organization', value: result.callDetails.organization },
              { label: 'Department', value: result.callDetails.department },
              { label: 'Confirmation', value: result.callDetails.confirmationNumber || 'N/A' },
            ].map(d => (
              <View key={d.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue}>{d.value}</Text>
              </View>
            ))}
          </View>

          {/* Action Items */}
          {result.actionItems.length > 0 && (
            <View style={styles.actionItems}>
              <Text style={styles.actionItemsTitle}>Action Items</Text>
              {result.actionItems.map((item, i) => (
                <View key={i} style={styles.actionItem}>
                  <View style={styles.actionItemDot} />
                  <Text style={styles.actionItemText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Transcript Preview */}
          {result.transcript.length > 0 && (
            <View style={styles.transcriptWrap}>
              <Text style={styles.transcriptTitle}>Call Transcript</Text>
              <ScrollView style={styles.transcriptScroll} showsVerticalScrollIndicator={false}>
                {result.transcript.map((line, i) => {
                  const isAI = line.speaker === 'ai';
                  const isSystem = line.speaker === 'system';
                  return (
                    <View key={i} style={[
                      styles.transcriptLine,
                      isSystem && styles.transcriptSystem,
                      isAI && styles.transcriptAI,
                    ]}>
                      <Text style={[
                        styles.transcriptSpeaker,
                        { color: isSystem ? Colors.textMuted : isAI ? Colors.primary : Colors.warning },
                      ]}>
                        {line.speaker.toUpperCase()}
                      </Text>
                      <Text style={styles.transcriptText}>{line.text}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={styles.newTaskBtn} onPress={resetAgent} activeOpacity={0.85}>
            <MaterialIcons name="add" size={18} color={Colors.primary} />
            <Text style={styles.newTaskBtnText}>New Task</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.errorWrap}>
          <MaterialIcons name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>AI Agent Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={resetAgent} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── CONTACTS TAB ─────────────────────────────────────────────────────────
function ContactsTab({ onContact }: { onContact: (c: Contact) => void }) {
  const [search, setSearch] = useState('');
  const results = searchContacts(search);

  const groups = results.reduce<Record<string, Contact[]>>((acc, c) => {
    const key = search ? 'Results' : c.name[0].toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const sections = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.contactSearch}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.contactSearchInput}
          placeholder="Search contacts..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {sections.map(([letter, contacts]) => (
          <View key={letter}>
            <Text style={styles.sectionLetter}>{letter}</Text>
            {contacts.map(c => (
              <TouchableOpacity key={c.id} style={styles.contactRow} onPress={() => onContact(c)} activeOpacity={0.8}>
                <ContactAvatar contact={c} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactNum}>{c.number}</Text>
                  {c.org ? <Text style={styles.contactOrg}>{c.org}</Text> : null}
                </View>
                <TouchableOpacity style={styles.quickCallBtn} onPress={() => onContact(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="phone" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {results.length === 0 && (
          <View style={styles.emptyContacts}>
            <MaterialIcons name="person-search" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── CONFIRM CALL MODAL ────────────────────────────────────────────────────
function ConfirmCallModal({ contact, number, onConfirm, onCancel }: {
  contact?: Contact | null; number?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
        {contact ? (
          <>
            <ContactAvatar contact={contact} size={64} />
            <Text style={styles.modalName}>{contact.name}</Text>
            <Text style={styles.modalNum}>{contact.number}</Text>
            {contact.org && <Text style={styles.modalOrg}>{contact.org}</Text>}
          </>
        ) : (
          <>
            <View style={styles.unknownAvatar}><MaterialIcons name="person" size={32} color={Colors.textMuted} /></View>
            <Text style={styles.modalName}>{number}</Text>
            <Text style={styles.modalOrg}>Unknown Number</Text>
          </>
        )}
        <View style={styles.sentinelRow}>
          <MaterialIcons name="security" size={14} color={Colors.primary} />
          <Text style={styles.sentinelMsg}>SENTINEL™ will analyze this call in real-time</Text>
        </View>
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelCallBtn} onPress={onCancel} activeOpacity={0.8}>
            <MaterialIcons name="close" size={20} color={Colors.textSecondary} />
            <Text style={styles.cancelCallText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmCallBtn} onPress={onConfirm} activeOpacity={0.85}>
            <MaterialIcons name="phone" size={20} color="#fff" />
            <Text style={styles.confirmCallText}>Call</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────
export default function DialerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('voice');
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [pendingNumber, setPendingNumber] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDial = useCallback((num: string) => {
    const found = findContactByNumber(num);
    if (found) { setPendingContact(found); setPendingNumber(null); }
    else { setPendingNumber(num); setPendingContact(null); }
    setShowConfirm(true);
  }, []);

  const handleContact = useCallback((c: Contact) => {
    setPendingContact(c); setPendingNumber(null); setShowConfirm(true);
  }, []);

  const confirmCall = useCallback(() => {
    setShowConfirm(false);
    const params: Record<string, string> = {};
    if (pendingContact) {
      params.contactId = pendingContact.id;
      params.callerName = pendingContact.name;
      params.callerNumber = pendingContact.number;
      params.direction = 'outbound';
    } else if (pendingNumber) {
      params.callerNumber = pendingNumber;
      params.callerName = 'Unknown';
      params.direction = 'outbound';
    }
    router.push({ pathname: '/live-call', params });
    setPendingContact(null); setPendingNumber(null);
  }, [pendingContact, pendingNumber, router]);

  const TAB_DEFS: { key: Tab; icon: string; label: string }[] = [
    { key: 'voice', icon: 'mic', label: 'Voice' },
    { key: 'pad', icon: 'dialpad', label: 'Keypad' },
    { key: 'agent', icon: 'support-agent', label: 'AI Agent' },
    { key: 'contacts', icon: 'people', label: 'Contacts' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dialer</Text>
        <View style={styles.sentinelPill}>
          <View style={styles.sentinelDot} />
          <Text style={styles.sentinelPillText}>SENTINEL™ ON</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TAB_DEFS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <MaterialIcons name={t.icon as any} size={18} color={tab === t.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'pad' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
            <DialPadTab onDial={handleDial} />
          </ScrollView>
        )}
        {tab === 'voice' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
            <VoiceTab onDial={handleDial} onContact={handleContact} />
          </ScrollView>
        )}
        {tab === 'agent' && (
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.md }}>
            <AIAgentTab />
          </ScrollView>
        )}
        {tab === 'contacts' && (
          <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
            <ContactsTab onContact={handleContact} />
          </View>
        )}
      </View>

      {showConfirm && (
        <ConfirmCallModal
          contact={pendingContact}
          number={pendingNumber ?? undefined}
          onConfirm={confirmCall}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  sentinelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  sentinelDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary },
  sentinelPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 0.8 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 8, borderRadius: Radius.md,
  },
  // ── DIAL PAD ──
  padTab: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, alignItems: 'center', gap: Spacing.md },
  padDisplay: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, minHeight: 68,
  },
  padDigits: { flex: 1, fontSize: 32, fontWeight: FontWeight.extrabold, color: Colors.text, letterSpacing: 2 },
  padDigitsPlaceholder: { fontSize: 18, color: Colors.textMuted, fontWeight: FontWeight.medium, letterSpacing: 0 },
  padMatchRow: { gap: Spacing.sm, paddingHorizontal: 2 },
  padMatchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, maxWidth: 140,
  },
  padMatchDot: { width: 8, height: 8, borderRadius: 4 },
  padMatchName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text },
  padGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: 0 },
  padKey: {
    width: '33.33%', height: 72, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, gap: 1,
  },
  padKeyDigit: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.text, lineHeight: 34 },
  padKeySub: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 2, lineHeight: 13 },
  padCallBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.safe,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  padCallBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },
  tabBtnActive: { backgroundColor: Colors.primaryGlow },
  tabLabel: { fontSize: 10, fontWeight: FontWeight.medium, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  // ── VOICE TAB ──
  voiceTab: { paddingHorizontal: Spacing.md, gap: Spacing.lg, paddingTop: Spacing.md },
  voiceHero: { alignItems: 'center', gap: 4 },
  voiceTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  voiceSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  micBtnOuter: {
    alignSelf: 'center', width: 120, height: 120, alignItems: 'center', justifyContent: 'center',
  },
  micRipple: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2 },
  micBtn: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  transcriptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  transcriptText: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontStyle: 'italic' },
  manualRow: { flexDirection: 'row', gap: Spacing.sm },
  manualInput: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.md, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong,
    includeFontPadding: false,
  },
  manualSend: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  cmdResult: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.safe + '55',
  },
  cmdResultText: { flex: 1, fontSize: FontSize.sm, color: Colors.safe, fontWeight: FontWeight.semibold },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  hintChip: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border,
  },
  hintText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  favTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, paddingLeft: 4 },
  favCard: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  favName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center', maxWidth: 64 },
  favNum: { fontSize: 10, color: Colors.textMuted },

  // ── AI AGENT TAB ──
  agentTab: { gap: Spacing.md, paddingTop: Spacing.md },
  agentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  agentIconWrap: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
  },
  agentTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  agentSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  agentOnBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.safe + '44',
  },
  agentDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.safe },
  agentOnText: { fontSize: 10, fontWeight: FontWeight.extrabold, color: Colors.safe, letterSpacing: 0.8 },
  agentInstructLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  agentInput: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.text, borderWidth: 1.5, borderColor: Colors.borderStrong,
    textAlignVertical: 'top', minHeight: 90, includeFontPadding: false,
  },
  executeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, ...Shadow.primary,
  },
  executeBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },
  executeBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  quickTaskLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginTop: 4 },
  quickTaskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickTask: {
    width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickTaskLabel2: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text },

  // Running state
  runningWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  runningTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  runningTask: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  runningTimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  runningTimerText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  runningNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, maxWidth: 260 },

  // Result state
  resultWrap: { gap: Spacing.md },
  outcomeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
  },
  outcomeText: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  outcomeDuration: { fontSize: FontSize.xs, color: Colors.textMuted },
  resultSummary: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  resultSummaryText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 22 },
  resultDetails: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  detailValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold, maxWidth: '60%', textAlign: 'right' },
  actionItems: { gap: Spacing.sm },
  actionItemsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  actionItem: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  actionItemDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  actionItemText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  transcriptWrap: { gap: Spacing.sm },
  transcriptTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  transcriptScroll: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, maxHeight: 240,
  },
  transcriptLine: {
    padding: Spacing.sm, borderLeftWidth: 2.5, borderLeftColor: Colors.border,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.xs, marginBottom: Spacing.xs, gap: 3,
  },
  transcriptSystem: { borderLeftColor: Colors.textMuted, opacity: 0.7 },
  transcriptAI: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryGlow + '33' },
  transcriptSpeaker: { fontSize: 9, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  transcriptText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },
  newTaskBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  newTaskBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  // Error state
  errorWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  errorTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.danger },
  errorText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border,
  },
  retryBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  // ── CONTACTS ──
  contactSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  contactSearchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false },
  sectionLetter: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textMuted,
    paddingHorizontal: 4, paddingVertical: 6, letterSpacing: 1,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  contactName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  contactNum: { fontSize: FontSize.xs, color: Colors.textSecondary },
  contactOrg: { fontSize: FontSize.xs, color: Colors.textMuted },
  quickCallBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  emptyContacts: { alignItems: 'center', paddingTop: 48, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },

  // ── CONFIRM MODAL ──
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(6,14,30,0.88)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalCard: {
    width: '82%', backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.borderStrong, ...Shadow.primary,
  },
  modalName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center' },
  modalNum: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalOrg: { fontSize: FontSize.xs, color: Colors.textMuted },
  unknownAvatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bgSurface,
    borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  sentinelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.borderStrong, marginTop: 4,
  },
  sentinelMsg: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, width: '100%' },
  cancelCallBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.bgSurface, borderRadius: Radius.full, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelCallText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  confirmCallBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.safe, borderRadius: Radius.full, paddingVertical: 14,
  },
  confirmCallText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
});

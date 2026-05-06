/**
 * CALLSHIELD Dialer — Voice-First Call Interface
 *
 * Three interaction modes:
 * 1. VOICE COMMAND  — Tap mic, say "Call Mom" → instant dial
 * 2. DIALPAD        — Traditional number pad with SENTINEL pre-screen
 * 3. CONTACTS       — Phone book search + quick-dial favorites
 *
 * All calls routed through live-call screen with SENTINEL™ active.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, FlatList, Pressable, Platform,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { CONTACTS, Contact, searchContacts, getFavorites, getInitials, findContactByNumber } from '../../constants/contacts';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { parseVoiceCommand } from '../../services/voiceCommandService';

type Tab = 'voice' | 'pad' | 'contacts';

// ─── Dial Pad Keys ────────────────────────────────────────────────────────────
const PAD_KEYS = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

// ─── Contact Avatar ───────────────────────────────────────────────────────────
function ContactAvatar({ contact, size = 44 }: { contact: Contact; size?: number }) {
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: contact.avatarColor + '33',
      borderWidth: 1.5, borderColor: contact.avatarColor + '55',
      alignItems: 'center', justifyContent: 'center',
    }]}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '700', color: contact.avatarColor }}>
        {getInitials(contact)}
      </Text>
    </View>
  );
}

// ─── Animated Mic Button ─────────────────────────────────────────────────────
function MicButton({ isListening, onPress }: { isListening: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      const pulsate = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.93, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const ripple1 = Animated.loop(
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1.7, duration: 1400, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      );
      const ripple2 = Animated.loop(
        Animated.sequence([
          Animated.delay(700),
          Animated.parallel([
            Animated.timing(ring2, { toValue: 2.1, duration: 1400, useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
          ]),
        ])
      );
      ring1.setValue(1); ring1Opacity.setValue(0.5);
      ring2.setValue(1); ring2Opacity.setValue(0.35);
      pulsate.start(); ripple1.start(); ripple2.start();
      return () => { pulsate.stop(); ripple1.stop(); ripple2.stop(); pulse.setValue(1); };
    }
  }, [isListening]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.micBtnOuter, pressed && { opacity: 0.9 }]}
    >
      <Animated.View style={[styles.micRipple, {
        transform: [{ scale: ring1 }], opacity: ring1Opacity,
        borderColor: isListening ? Colors.danger : Colors.primary,
      }]} />
      <Animated.View style={[styles.micRipple, {
        transform: [{ scale: ring2 }], opacity: ring2Opacity,
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

// ─── VOICE TAB ────────────────────────────────────────────────────────────────
function VoiceTab({ onDial, onContact }: { onDial: (num: string) => void; onContact: (c: Contact) => void }) {
  const voice = useVoiceCommand();
  const [manualInput, setManualInput] = useState('');
  const router = useRouter();

  const handleCommand = useCallback((cmd: ReturnType<typeof parseVoiceCommand>) => {
    if (cmd.action === 'ghost') {
      router.push('/ghost-mode');
      return;
    }
    if (cmd.action === 'call' && cmd.target) {
      if (cmd.targetType === 'number') {
        onDial(cmd.target);
      } else {
        // Search contacts
        const results = searchContacts(cmd.target);
        if (results.length === 1) onContact(results[0]);
        else if (results.length > 1) onContact(results[0]); // best match
        else onDial(cmd.target); // treat as number
      }
    }
  }, [onDial, onContact, router]);

  const handleMic = () => {
    if (voice.state === 'listening') {
      voice.stopListening();
    } else {
      voice.reset();
      voice.startListening();
    }
  };

  const isListening = voice.state === 'listening';
  const isManual = voice.state === 'manual' || !voice.isWebSupported;

  // Auto-handle final command
  useEffect(() => {
    if (voice.parsedCommand && voice.state === 'done') {
      handleCommand(voice.parsedCommand);
    }
  }, [voice.parsedCommand, voice.state]);

  const displayText = voice.interimText || voice.finalText;

  return (
    <View style={styles.voiceTab}>
      {/* Instructions */}
      <View style={styles.voiceHero}>
        <Text style={styles.voiceTitle}>
          {isListening ? 'Listening...' : isManual ? 'Type a command' : 'Tap to speak'}
        </Text>
        <Text style={styles.voiceSub}>
          {isListening
            ? '"Call Mom"   "Dial 415 555 0041"   "Ghost Mode"'
            : isManual
            ? 'Voice recognition not available on this platform'
            : 'Say a name, number, or command'}
        </Text>
      </View>

      {/* Mic */}
      <MicButton isListening={isListening} onPress={handleMic} />

      {/* Interim transcript */}
      {displayText ? (
        <View style={styles.transcriptChip}>
          <MaterialIcons name="graphic-eq" size={14} color={Colors.primary} />
          <Text style={styles.transcriptText} numberOfLines={2}>{displayText}</Text>
        </View>
      ) : null}

      {/* Manual input (fallback for native / no-speech) */}
      {(isManual || voice.state === 'error') && (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder='Try "Call Mom" or "Dial 415 555 0041"'
            placeholderTextColor={Colors.textMuted}
            value={manualInput}
            onChangeText={setManualInput}
            onSubmitEditing={() => {
              voice.submitManualText(manualInput);
              setManualInput('');
            }}
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

      {/* Parsed command result */}
      {voice.parsedCommand && voice.state === 'done' && (
        <View style={styles.cmdResult}>
          <MaterialIcons name="check-circle" size={16} color={Colors.safe} />
          <Text style={styles.cmdResultText}>
            {voice.parsedCommand.action === 'call'
              ? `Calling ${voice.parsedCommand.target}...`
              : voice.parsedCommand.action === 'ghost'
              ? 'Activating Ghost Mode...'
              : voice.parsedCommand.rawText}
          </Text>
        </View>
      )}

      {/* Hint examples */}
      <View style={styles.hintRow}>
        {['"Call Dr. Nguyen"', '"Dial 800..."', '"Ghost Mode"'].map(h => (
          <TouchableOpacity
            key={h}
            style={styles.hintChip}
            onPress={() => { voice.submitManualText(h.replace(/['"]/g, '')); }}
            activeOpacity={0.8}
          >
            <Text style={styles.hintText}>{h}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Favorites */}
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

// ─── DIAL PAD TAB ─────────────────────────────────────────────────────────────
function DialPadTab({ onDial }: { onDial: (num: string) => void }) {
  const [digits, setDigits] = useState('');
  const pressAnim = useRef<Record<string, Animated.Value>>({});
  PAD_KEYS.forEach(k => {
    if (!pressAnim.current[k.digit]) pressAnim.current[k.digit] = new Animated.Value(1);
  });

  const handleKey = useCallback((digit: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(10);
    const anim = pressAnim.current[digit];
    if (anim) {
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.88, duration: 60, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    setDigits(prev => prev.length < 15 ? prev + digit : prev);
  }, []);

  const handleDelete = useCallback(() => {
    setDigits(prev => prev.slice(0, -1));
  }, []);

  const formatDisplay = (d: string) => {
    // Format as phone number as user types
    const clean = d.replace(/\D/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
    if (clean.length <= 10) return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    return `+${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7, 11)}`;
  };

  const matchedContact = digits.length >= 7 ? findContactByNumber(digits) : null;

  return (
    <View style={styles.padTab}>
      {/* Display */}
      <View style={styles.padDisplay}>
        {matchedContact && (
          <View style={styles.padContactRow}>
            <ContactAvatar contact={matchedContact} size={28} />
            <Text style={styles.padContactName}>{matchedContact.name}</Text>
          </View>
        )}
        <View style={styles.padNumberRow}>
          <Text style={[styles.padNumber, digits.length === 0 && { color: Colors.textMuted }]}>
            {digits.length > 0 ? formatDisplay(digits) : 'Enter number'}
          </Text>
          {digits.length > 0 && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
              <MaterialIcons name="backspace" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Key Grid */}
      <View style={styles.keyGrid}>
        {PAD_KEYS.map(k => (
          <Animated.View key={k.digit} style={{ transform: [{ scale: pressAnim.current[k.digit] ?? new Animated.Value(1) }] }}>
            <TouchableOpacity
              style={styles.key}
              onPress={() => handleKey(k.digit)}
              activeOpacity={0.7}
            >
              <Text style={styles.keyDigit}>{k.digit}</Text>
              {k.sub ? <Text style={styles.keySub}>{k.sub}</Text> : null}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Dial Button */}
      <View style={styles.dialRow}>
        <View style={{ width: 64 }} />
        <TouchableOpacity
          style={[styles.dialCallBtn, !digits && styles.dialCallBtnDisabled]}
          onPress={() => digits && onDial(digits)}
          disabled={!digits}
          activeOpacity={0.85}
        >
          <MaterialIcons name="phone" size={28} color="#fff" />
        </TouchableOpacity>
        {digits.length > 0 ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setDigits('')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="clear" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : <View style={{ width: 64 }} />}
      </View>
    </View>
  );
}

// ─── CONTACTS TAB ─────────────────────────────────────────────────────────────
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
      {/* Search */}
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
              <TouchableOpacity
                key={c.id}
                style={styles.contactRow}
                onPress={() => onContact(c)}
                activeOpacity={0.8}
              >
                <ContactAvatar contact={c} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactNum}>{c.number}</Text>
                  {c.org ? <Text style={styles.contactOrg}>{c.org}</Text> : null}
                </View>
                {(c.shieldScore ?? 0) >= 90 && (
                  <View style={styles.shieldBadge}>
                    <MaterialIcons name="verified-user" size={12} color={Colors.safe} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.quickCallBtn}
                  onPress={() => onContact(c)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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

// ─── CONFIRM CALL MODAL ───────────────────────────────────────────────────────
function ConfirmCallModal({
  contact, number, onConfirm, onCancel,
}: {
  contact?: Contact | null;
  number?: string;
  onConfirm: () => void;
  onCancel: () => void;
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
            <View style={styles.unknownAvatar}>
              <MaterialIcons name="person" size={32} color={Colors.textMuted} />
            </View>
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

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function DialerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('voice');
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [pendingNumber, setPendingNumber] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDial = useCallback((num: string) => {
    const found = findContactByNumber(num);
    if (found) {
      setPendingContact(found);
      setPendingNumber(null);
    } else {
      setPendingNumber(num);
      setPendingContact(null);
    }
    setShowConfirm(true);
  }, []);

  const handleContact = useCallback((c: Contact) => {
    setPendingContact(c);
    setPendingNumber(null);
    setShowConfirm(true);
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
    setPendingContact(null);
    setPendingNumber(null);
  }, [pendingContact, pendingNumber, router]);

  const TAB_DEFS: { key: Tab; icon: string; label: string }[] = [
    { key: 'voice', icon: 'mic', label: 'Voice' },
    { key: 'pad', icon: 'dialpad', label: 'Pad' },
    { key: 'contacts', icon: 'people', label: 'Contacts' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dialer</Text>
        <View style={styles.sentinelPill}>
          <View style={styles.sentinelDot} />
          <Text style={styles.sentinelPillText}>SENTINEL™ ON</Text>
        </View>
      </View>

      {/* Tab Switch */}
      <View style={styles.tabBar}>
        {TAB_DEFS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={t.icon as any}
              size={18}
              color={tab === t.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'voice' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <VoiceTab onDial={handleDial} onContact={handleContact} />
          </ScrollView>
        )}
        {tab === 'pad' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <DialPadTab onDial={handleDial} />
          </ScrollView>
        )}
        {tab === 'contacts' && (
          <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
            <ContactsTab onContact={handleContact} />
          </View>
        )}
      </View>

      {/* Confirm Call Overlay */}
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
    padding: 4, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Radius.md,
  },
  tabBtnActive: { backgroundColor: Colors.primaryGlow },
  tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  // ── VOICE TAB ──
  voiceTab: { paddingHorizontal: Spacing.md, gap: Spacing.lg, paddingTop: Spacing.md },
  voiceHero: { alignItems: 'center', gap: 4 },
  voiceTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  voiceSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  micBtnOuter: {
    alignSelf: 'center', width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  micRipple: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2,
  },
  micBtn: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.primary,
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
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.primary,
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

  // ── DIAL PAD ──
  padTab: { paddingHorizontal: Spacing.md, gap: Spacing.md, paddingTop: Spacing.sm },
  padDisplay: { alignItems: 'center', gap: 6, minHeight: 72, justifyContent: 'flex-end' },
  padContactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  padContactName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  padNumberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  padNumber: { fontSize: 30, fontWeight: FontWeight.bold, color: Colors.text, letterSpacing: 2, textAlign: 'center' },
  deleteBtn: { padding: 8 },
  keyGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 0,
  },
  key: {
    width: '33.33%', aspectRatio: 1.4,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  keyDigit: { fontSize: 26, fontWeight: FontWeight.semibold, color: Colors.text },
  keySub: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 1.5, marginTop: -2 },
  dialRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: 0,
  },
  dialCallBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.safe, alignItems: 'center', justifyContent: 'center',
    ...Shadow.primary,
  },
  dialCallBtnDisabled: { backgroundColor: Colors.bgSurface, shadowOpacity: 0 },
  clearBtn: { width: 64, alignItems: 'flex-end', justifyContent: 'center' },

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
  shieldBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.safeGlow,
    alignItems: 'center', justifyContent: 'center',
  },
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
    borderWidth: 1.5, borderColor: Colors.borderStrong,
    ...Shadow.primary,
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

/**
 * Incoming Call Screen
 * Shows when an inbound call arrives — with instant caller dossier,
 * Ghost Mode toggle, and accept/reject actions.
 * SENTINEL™ pre-screens the number before user picks up.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Vibration, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { findContactByNumber, getInitials, Contact } from '../constants/contacts';
import { SentinelEngine } from '../services/sentinelEngine';
import { ThreatService } from '../services/threatService';
import { MOCK_SCAM_ALERTS } from '../constants/mockData';

function formatLastCall(d?: Date): string {
  if (!d) return 'Never called';
  const diff = Date.now() - d.getTime();
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return 'Called recently';
  if (hrs < 24) return `Called ${hrs}h ago`;
  return `Called ${Math.round(hrs / 24)}d ago`;
}

function ContactAvatar({ contact, size = 88 }: { contact?: Contact | null; size?: number }) {
  if (contact) {
    return (
      <View style={[styles.avatarBase, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: contact.avatarColor + '33',
        borderColor: contact.avatarColor + '77',
      }]}>
        <Text style={{ fontSize: size * 0.32, fontWeight: '800', color: contact.avatarColor }}>
          {getInitials(contact)}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.avatarBase, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: Colors.bgSurface,
      borderColor: Colors.border,
    }]}>
      <MaterialIcons name="person" size={size * 0.45} color={Colors.textMuted} />
    </View>
  );
}

export default function IncomingCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    callerNumber?: string;
    callerName?: string;
  }>();

  const callerNumber = params.callerNumber ?? '+1 (800) 555-0982';
  const contact = findContactByNumber(callerNumber);
  const callerName = contact?.name ?? params.callerName ?? 'Unknown Caller';

  // Pre-screen the number against community threat feed
  const communityAlert = MOCK_SCAM_ALERTS.find(a =>
    a.number.replace(/\D/g, '') === callerNumber.replace(/\D/g, '')
  );

  const [ringCount, setRingCount] = useState(1);

  // Threat level from community or contact history
  const preThreatLevel = communityAlert ? 'danger' : contact ? 'safe' : 'warning';
  const threatColor = ThreatService.getThreatColor(preThreatLevel);

  // Pulse animation for avatar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    // Ring counter
    const ringTimer = setInterval(() => setRingCount(n => n + 1), 4000);

    // Pulse
    const pulsate = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    const ripple1 = Animated.loop(
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1.6, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    const ripple2 = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.parallel([
          Animated.timing(ring2, { toValue: 1.9, duration: 1800, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
      ])
    );
    pulsate.start(); ripple1.start(); ripple2.start();

    // Vibrate on ring (native only)
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 1000, 2000, 1000], true);
    }

    return () => {
      clearInterval(ringTimer);
      pulsate.stop(); ripple1.stop(); ripple2.stop();
      if (Platform.OS !== 'web') Vibration.cancel();
    };
  }, []);

  const handleAccept = () => {
    if (Platform.OS !== 'web') Vibration.cancel();
    router.replace({
      pathname: '/live-call',
      params: {
        callerName,
        callerNumber,
        direction: 'inbound',
        contactId: contact?.id ?? '',
      },
    });
  };

  const handleGhost = () => {
    if (Platform.OS !== 'web') Vibration.cancel();
    router.replace({ pathname: '/ghost-mode' });
  };

  const handleDecline = () => {
    if (Platform.OS !== 'web') Vibration.cancel();
    router.back();
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

        {/* Pre-screen Alert */}
        {communityAlert && (
          <Animated.View style={[styles.alertBanner, { transform: [{ translateY: slideAnim }] }]}>
            <MaterialIcons name="warning" size={16} color={Colors.danger} />
            <Text style={styles.alertText}>
              Community Alert: {communityAlert.reportCount.toLocaleString()} reports · {communityAlert.scamType}
            </Text>
          </Animated.View>
        )}

        {/* Incoming label */}
        <Text style={styles.incomingLabel}>
          {ringCount === 1 ? 'Incoming Call' : `Incoming Call · Ring ${ringCount}`}
        </Text>

        {/* Avatar with pulse rings */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.ring, {
            borderColor: threatColor, transform: [{ scale: ring1 }], opacity: ring1Opacity,
          }]} />
          <Animated.View style={[styles.ring, {
            borderColor: threatColor, transform: [{ scale: ring2 }], opacity: ring2Opacity,
          }]} />
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <ContactAvatar contact={contact} size={100} />
          </Animated.View>
        </View>

        {/* Caller Identity */}
        <View style={styles.callerInfo}>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callerNumber}>{callerNumber}</Text>
          {contact?.org && <Text style={styles.callerOrg}>{contact.org}</Text>}
        </View>

        {/* SENTINEL Pre-Screen Dossier */}
        <View style={[styles.dossier, { borderColor: threatColor + '44' }]}>
          <View style={styles.dossierHeader}>
            <MaterialIcons name="security" size={14} color={Colors.primary} />
            <Text style={styles.dossierTitle}>SENTINEL™ Pre-Screen</Text>
            <View style={[styles.dossierLevel, {
              backgroundColor: threatColor + '22', borderColor: threatColor + '44',
            }]}>
              <View style={[styles.dossierDot, { backgroundColor: threatColor }]} />
              <Text style={[styles.dossierLevelText, { color: threatColor }]}>
                {SentinelEngine.getThreatLabel(preThreatLevel)}
              </Text>
            </View>
          </View>

          <View style={styles.dossierRows}>
            <View style={styles.dossierRow}>
              <MaterialIcons name="badge" size={13} color={Colors.textMuted} />
              <Text style={styles.dossierLabel}>Identity</Text>
              <Text style={[styles.dossierValue, { color: contact ? Colors.safe : Colors.textSecondary }]}>
                {contact ? 'Verified Contact' : 'Unknown Number'}
              </Text>
            </View>
            <View style={styles.dossierRow}>
              <MaterialIcons name="history" size={13} color={Colors.textMuted} />
              <Text style={styles.dossierLabel}>Last Call</Text>
              <Text style={styles.dossierValue}>{formatLastCall(contact?.lastCallTime)}</Text>
            </View>
            <View style={styles.dossierRow}>
              <MaterialIcons name="groups" size={13} color={Colors.textMuted} />
              <Text style={styles.dossierLabel}>Community</Text>
              <Text style={[styles.dossierValue, { color: communityAlert ? Colors.danger : Colors.safe }]}>
                {communityAlert
                  ? `${communityAlert.reportCount.toLocaleString()} reports`
                  : 'No reports'}
              </Text>
            </View>
            {contact?.shieldScore !== undefined && (
              <View style={styles.dossierRow}>
                <MaterialIcons name="shield" size={13} color={Colors.textMuted} />
                <Text style={styles.dossierLabel}>Trust Score</Text>
                <Text style={[styles.dossierValue, { color: Colors.safe }]}>{contact.shieldScore}/100</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Decline */}
          <View style={styles.actionGroup}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.85}>
              <MaterialIcons name="call-end" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Ghost Mode */}
          <View style={styles.actionGroup}>
            <TouchableOpacity style={styles.ghostBtn} onPress={handleGhost} activeOpacity={0.85}>
              <MaterialIcons name="hearing" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: Colors.primary }]}>Ghost</Text>
          </View>

          {/* Accept */}
          <View style={styles.actionGroup}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
              <MaterialIcons name="phone" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: Colors.safe }]}>Accept</Text>
          </View>
        </View>

        {/* Ghost Mode hint */}
        <Text style={styles.ghostHint}>
          Tap Ghost to have AI answer while you listen
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.lg },

  alertBanner: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.md, padding: Spacing.sm + 4,
    borderWidth: 1.5, borderColor: Colors.danger + '55',
  },
  alertText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.semibold, lineHeight: 16 },

  incomingLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, color: Colors.textSecondary,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },

  avatarSection: {
    width: 140, height: 140, alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2,
  },
  avatarBase: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },

  callerInfo: { alignItems: 'center', gap: 4 },
  callerName: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.text },
  callerNumber: { fontSize: FontSize.md, color: Colors.textSecondary },
  callerOrg: { fontSize: FontSize.sm, color: Colors.textMuted },

  dossier: {
    width: '100%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1.5, gap: Spacing.sm,
  },
  dossierHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dossierTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  dossierLevel: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1,
  },
  dossierDot: { width: 7, height: 7, borderRadius: 3.5 },
  dossierLevelText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 0.5 },
  dossierRows: { gap: 8 },
  dossierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dossierLabel: { fontSize: FontSize.xs, color: Colors.textMuted, width: 64 },
  dossierValue: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },

  actions: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
    gap: Spacing.xxl,
  },
  actionGroup: { alignItems: 'center', gap: 8 },
  declineBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', ...Shadow.danger,
  },
  ghostBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryGlow, borderWidth: 2, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', ...Shadow.primary,
  },
  acceptBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.safe,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.safe, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },

  ghostHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: -8 },
});

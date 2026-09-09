/**
 * In-app Terms of Use (EULA). Recommend-only. User must have legal right to analyze the call.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

type Block = { heading: string; paragraphs?: string[]; bullets?: string[] };

const BLOCKS: Block[] = [
  {
    heading: '1. Agreement',
    paragraphs: [
      'By downloading, installing, or using ShieldCall (the "App"), you agree to these Terms of Use. If you do not agree, do not use the App.',
      'These terms are an agreement between you and ShieldCall ("we", "us"). The Privacy Policy is part of this agreement.',
    ],
  },
  {
    heading: '2. What the App is',
    paragraphs: [
      'ShieldCall is a free app. There are no in-app purchases in v1. Live Protect listens on this phone\'s microphone while a call is on speaker, scores scam language, and warns on screen.',
      'The App never hangs up a call and never joins the carrier call. It is not a carrier intercept.',
    ],
  },
  {
    heading: '3. Recommend-only',
    paragraphs: [
      'Scores and on-screen warnings are suggestions. They can be wrong in both directions: false alarms and missed scams. You decide what to do. Do not treat a "monitor" or "warn" label as a guarantee that a caller is safe or fraudulent.',
    ],
  },
  {
    heading: '4. Not a certified fraud product',
    paragraphs: [
      'ShieldCall is not certified, licensed, audited, or guaranteed as a fraud-detection, deepfake-detection, identity-verification, or law-enforcement tool. Linguistic scoring uses pattern matching and heuristics. Acoustic cues are a weak volume proxy, not a vocoder or deepfake detector.',
      'The App is not legal advice, not a recording compliance product, and not a substitute for hanging up, verifying a caller through a known number, or contacting an institution yourself.',
    ],
  },
  {
    heading: '5. You must have the legal right to analyze the call',
    paragraphs: [
      'You represent that you have the legal right to listen to and analyze the call, including consent from every party where the law requires it.',
      'In many places, including a number of U.S. states (for example California, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Oregon, Pennsylvania, and Washington), all parties must consent before a call is recorded or monitored. Similar rules exist in Canada, the EU, the UK, Australia, and elsewhere.',
      'You are solely responsible for complying with wiretap, recording, and privacy laws that apply to you. If you are not sure, do not use Live Protect, or consult a lawyer. ShieldCall is not liable for your failure to obtain required consent.',
    ],
  },
  {
    heading: '6. Acceptable use',
    bullets: [
      'Do not use the App to intercept communications you have no right to hear.',
      'Do not use the App to harass, threaten, or defraud anyone.',
      'Do not attempt to bypass permissions, consent gates, or security controls.',
      'Do not reverse engineer the App except where local law allows.',
    ],
  },
  {
    heading: '7. Permissions',
    paragraphs: [
      'Microphone and speech recognition are requested so the App can analyze this phone\'s conversation while a call is ongoing and, optionally, transcribe via the OS. Local network access is only for an optional detector sidecar on your LAN. The App works if that sidecar is not running.',
    ],
  },
  {
    heading: '8. Free app',
    paragraphs: [
      'The App is free. v1 has no subscriptions and no in-app purchases. If you see leftover upgrade copy in an older screen, it is not an offer to buy and has no effect.',
    ],
  },
  {
    heading: '9. Disclaimer of warranties',
    paragraphs: [
      'THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL DETECT EVERY SCAM, AVOID FALSE WARNINGS, BE UNINTERRUPTED, OR BE ERROR-FREE.',
    ],
  },
  {
    heading: '10. Limitation of liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHIELDCALL IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING FINANCIAL LOSS FROM A SCAM (WHETHER OR NOT THE APP WARNED YOU), LEGAL CONSEQUENCES OF ANALYZING A CALL, LOST DATA, OR SERVICE INTERRUPTION.',
      'BECAUSE THE APP IS FREE, OUR TOTAL LIABILITY FOR ALL CLAIMS WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US FOR THE APP (ZERO) OR THE MINIMUM AMOUNT REQUIRED BY APPLICABLE LAW.',
    ],
  },
  {
    heading: '11. Intellectual property',
    paragraphs: [
      'The App, including the ShieldCall name, SENTINEL scoring, and UI, is owned by ShieldCall. You receive a limited, non-exclusive, non-transferable license to use the App for personal, lawful purposes.',
    ],
  },
  {
    heading: '12. Termination',
    paragraphs: [
      'Stop using the App and delete it at any time. We may stop offering the App. Local data can be deleted from Settings.',
    ],
  },
  {
    heading: '13. Governing law',
    paragraphs: [
      'These terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law rules, except where your local consumer law requires otherwise.',
    ],
  },
  {
    heading: '14. Changes',
    paragraphs: [
      'We may update these terms. The effective date at the top will change. Continued use after an update means you accept the new terms.',
    ],
  },
  {
    heading: '15. Contact',
    paragraphs: [
      'Questions: legal@shieldcallai.com.',
    ],
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Use</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.effective}>Effective 7 September 2026</Text>
        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            Recommend-only. You must have the legal right to analyze the call. Not a certified fraud product. Free. No in-app purchases.
          </Text>
        </View>

        {BLOCKS.map(block => (
          <View key={block.heading} style={styles.block}>
            <Text style={styles.heading}>{block.heading}</Text>
            {block.paragraphs?.map(p => (
              <Text key={p.slice(0, 48)} style={styles.body}>{p}</Text>
            ))}
            {block.bullets?.map(item => (
              <View key={item} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>{'\u2022'}</Text>
                <Text style={styles.body}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.linkRow} activeOpacity={0.8}>
          <Text style={styles.link}>Read the Privacy Policy</Text>
          <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  effective: {
    color: Colors.textMuted, fontSize: FontSize.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  callout: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  calloutText: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  block: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  heading: {
    color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 8,
  },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21, marginBottom: 8, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletMark: { color: Colors.primary, fontSize: FontSize.sm, lineHeight: 21 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginTop: Spacing.sm,
  },
  link: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

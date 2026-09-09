/**
 * In-app Privacy Policy. Honest about microphone, OS speech, optional LAN sidecar.
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
    heading: 'The short version',
    paragraphs: [
      'ShieldCall listens through this phone\'s microphone while a call is on speaker, scores scam language, and warns on screen. It does not join the carrier call, does not hang up, and does not sell your data.',
      'Optional speech-to-text uses the operating system. Apple or Google may receive audio if the OS sends it. We do not claim that audio stays on the device.',
    ],
  },
  {
    heading: '1. Who we are',
    paragraphs: [
      'ShieldCall ("we", "us") is a free mobile application. The bundle identifier is com.shieldcallai.app. Privacy questions: privacy@shieldcallai.com.',
    ],
  },
  {
    heading: '2. What the app does',
    paragraphs: [
      'Live Protect analyzes the conversation on this phone while a call is ongoing. Place or answer through ShieldCall (AI Dialer or incoming). Summary tiles show whether the voice is AI or human, whether the content looks like a scam or genuine, and likelihood scores.',
      'The app is recommend-only. It never hangs up for you. It is not a carrier intercept, a wiretap, or a certified fraud product.',
    ],
  },
  {
    heading: '3. Microphone',
    paragraphs: [
      'The microphone is used to hear this phone\'s live conversation during a consented session. We request permission first. You must confirm in the app that you are allowed to analyze the call before listening starts. If you deny microphone access, Live Protect cannot listen.',
    ],
  },
  {
    heading: '4. Optional speech-to-text via the OS',
    paragraphs: [
      'When you start listening, ShieldCall may use the operating system\'s speech recognition: Apple Speech on iOS, the Android speech recognizer on Android, and the Web Speech API on web.',
      'We do not control whether that recognizer runs fully on this device or sends audio to Apple or Google. That is dictated by the OS, language packs, device settings, and network. We do not claim on-device-only processing.',
      'If speech recognition is unavailable, you can type a sentence you heard. Scoring still runs.',
    ],
  },
  {
    heading: '5. Optional LAN sidecar',
    paragraphs: [
      'If you run a detector sidecar on your local network (by default at http://127.0.0.1:8765), the app may send transcript text to that sidecar to help score the call. The sidecar is optional and stays on the network you control. If it is down, the app continues to work (fail-open). You do not have to run a sidecar.',
    ],
  },
  {
    heading: '6. What we do not do',
    bullets: [
      'We do not intercept carrier audio or join the telephony path.',
      'We do not hang up calls for you.',
      'We do not sell your data.',
      'We do not use your audio or transcripts for advertising or tracking.',
      'We do not claim that audio never leaves the device.',
    ],
  },
  {
    heading: '7. Data we process',
    bullets: [
      'Microphone audio, while you are listening, to power OS speech recognition and a local volume proxy.',
      'Transcript text and scam-language scores kept on this device for the session.',
      'Optional transcript text to a LAN sidecar you run.',
      'If you create an account: name, email, and similar account fields stored by our auth provider.',
      'If you grant contacts permission: contacts stay on the device for caller labeling. Contacts are not required for Live Protect.',
      'Settings and consent flags stored locally.',
    ],
  },
  {
    heading: '8. Cloud and third parties',
    paragraphs: [
      'Apple and/or Google may process audio if you use OS speech recognition, under their own policies. We cannot override that.',
      'If you sign in, account data is stored with our backend provider (Supabase).',
      'Some experimental screens that remain in the binary may call additional transcription or AI services if those services are configured. Live Protect does not require them. Guest use of Protect works without a paid plan and without a working Deepgram or Claude key.',
    ],
  },
  {
    heading: '9. Retention',
    paragraphs: [
      'ShieldCall does not keep a raw recording of the call. Transcripts and scores live on the device unless you save history. Account data lasts until you delete it. Operating-system vendors may retain speech data under their own policies.',
    ],
  },
  {
    heading: '10. Your choices',
    bullets: [
      'Refuse microphone or speech permission.',
      'Do not start listening.',
      'Type text instead of using speech recognition.',
      'Do not run a LAN sidecar.',
      'Delete local data from Settings. If you have an account, use Delete My Data or email privacy@shieldcallai.com.',
    ],
  },
  {
    heading: '11. Legal right to analyze the call',
    paragraphs: [
      'You must have the legal right to analyze the call, including all-party consent where the law requires it. See the Terms of Use.',
    ],
  },
  {
    heading: '12. Children',
    paragraphs: [
      'ShieldCall is not directed at children under 13 (or 16 in the European Union). We do not knowingly collect personal information from children.',
    ],
  },
  {
    heading: '13. Changes',
    paragraphs: [
      'We will update the effective date when this policy changes. Continued use after an update means you accept the new policy.',
    ],
  },
  {
    heading: '14. Contact',
    paragraphs: [
      'ShieldCall Privacy. Email: privacy@shieldcallai.com.',
    ],
  },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.effective}>Effective 7 September 2026</Text>
        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            Microphone for same-phone live analysis. Optional OS speech-to-text (Apple or Google may receive audio). Optional LAN sidecar. No carrier intercept. No sale of data.
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

        <TouchableOpacity onPress={() => router.push('/terms')} style={styles.linkRow} activeOpacity={0.8}>
          <Text style={styles.link}>Read the Terms of Use</Text>
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
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderLeftWidth: 3, borderLeftColor: Colors.primary,
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

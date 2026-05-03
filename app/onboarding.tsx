import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  ScrollView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const PERSONAS = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley'];

const SLIDES = [
  {
    image: require('../assets/images/onboard_1.png'),
    title: 'Your AI\nBodyguard',
    subtitle: 'Real-time scam detection and threat analysis on every call — before you even answer.',
    icon: 'shield',
  },
  {
    image: require('../assets/images/onboard_2.png'),
    title: 'Ghost Mode\nActivated',
    subtitle: 'Your AI persona answers suspicious calls while you listen silently, fully protected.',
    icon: 'hearing',
  },
  {
    image: require('../assets/images/onboard_3.png'),
    title: 'AI Dials\nFor You',
    subtitle: 'Prescriptions, appointments, complaints — your AI agent handles it. You review the results.',
    icon: 'support-agent',
  },
];

export default function OnboardingScreen() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedPersona, setSelectedPersona] = useState('Alex');
  const [showPersonaSelect, setShowPersonaSelect] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setOnboarded, setPersonaName } = useApp();

  const goNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      const next = slideIndex + 1;
      setSlideIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      setShowPersonaSelect(true);
    }
  };

  const handleActivate = async () => {
    await setPersonaName(selectedPersona);
    await setOnboarded();
    router.replace('/(tabs)');
  };

  if (showPersonaSelect) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.personaContainer}>
          <View style={styles.shieldIconWrap}>
            <MaterialIcons name="shield" size={56} color={Colors.primary} />
          </View>
          <Text style={styles.personaTitle}>Choose Your AI{'\n'}Voice Persona</Text>
          <Text style={styles.personaSubtitle}>
            This is the name your AI agent will use when answering calls on your behalf.
          </Text>
          <View style={styles.personaGrid}>
            {PERSONAS.map(name => (
              <TouchableOpacity
                key={name}
                style={[styles.personaChip, selectedPersona === name && styles.personaChipSelected]}
                onPress={() => setSelectedPersona(name)}
                activeOpacity={0.8}
              >
                <Text style={[styles.personaChipText, selectedPersona === name && styles.personaChipTextSelected]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.privacyBox}>
            <MaterialIcons name="lock" size={16} color={Colors.primary} />
            <Text style={styles.privacyText}>
              All audio processing happens on-device. No audio is ever transmitted, stored on servers, or shared with third parties. This is an architectural guarantee, not just a policy.
            </Text>
          </View>

          <TouchableOpacity style={styles.activateBtn} onPress={handleActivate} activeOpacity={0.85}>
            <MaterialIcons name="shield" size={20} color={Colors.bgCard} />
            <Text style={styles.activateBtnText}>Activate CALLSHIELD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={[styles.slide, { width }]}>
            <Image
              source={slide.image}
              style={styles.slideImage}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.slideOverlay} />
            <View style={styles.slideContent}>
              <View style={styles.slideIconWrap}>
                <MaterialIcons name={slide.icon as any} size={28} color={Colors.primary} />
              </View>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomArea}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {slideIndex < SLIDES.length - 1 ? 'Continue' : 'Get Started'}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  slide: {
    height: height,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  slideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,14,30,0.72)',
  },
  slideContent: {
    position: 'absolute',
    bottom: 180,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  slideIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  slideTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    lineHeight: 44,
    marginBottom: Spacing.md,
  },
  slideSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(6,14,30,0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
  },
  nextBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  // Persona select
  personaContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIconWrap: {
    width: 96,
    height: 96,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  personaTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  personaSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  personaChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  personaChipSelected: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  personaChipText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  personaChipTextSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  privacyBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  privacyText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  activateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    alignSelf: 'stretch',
  },
  activateBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});

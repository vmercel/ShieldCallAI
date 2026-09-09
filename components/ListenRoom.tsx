/**
 * Voice-first listen room. One control. Captions, not a composer.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useProtectSession } from '../hooks/useProtectSession';

const Ink = {
  bg: '#070707',
  fg: '#F4F1EA',
  dim: 'rgba(244,241,234,0.45)',
  faint: 'rgba(244,241,234,0.22)',
  line: 'rgba(244,241,234,0.12)',
  caution: '#E8A23A',
  clear: '#F4F1EA',
  stop: '#C4544A',
};

const BAR_COUNT = 36;
let sessionConsent = false;

function Waveform({ active, level }: { active: boolean; level: number }) {
  const history = useRef<number[]>(Array(BAR_COUNT).fill(0.06));
  const [, tick] = useState(0);

  useEffect(() => {
    if (!active) {
      history.current = Array(BAR_COUNT).fill(0.06);
      tick(n => n + 1);
      return;
    }
    const next = history.current.slice(1);
    const jitter = 0.04 * Math.random();
    next.push(Math.min(1, Math.max(0.05, level * 0.92 + jitter)));
    history.current = next;
    tick(n => n + 1);
  }, [active, level]);

  return (
    <View style={styles.wave} accessibilityElementsHidden>
      {history.current.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: 8 + v * 72, opacity: 0.25 + v * 0.75 },
          ]}
        />
      ))}
    </View>
  );
}

function Pulse({ active, caution }: { active: boolean; caution: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const reduce = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => { reduce.current = v; });
  }, []);

  useEffect(() => {
    if (!active || reduce.current) {
      a.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(a, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, a]);

  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });
  const color = caution ? Ink.caution : Ink.fg;

  if (!active) return <View style={styles.pulseSlot} />;

  return (
    <View style={styles.pulseSlot} pointerEvents="none">
      <Animated.View style={[styles.ring, { borderColor: color, transform: [{ scale }], opacity }]} />
      <View style={[styles.ring, styles.ringInner, { borderColor: color }]} />
    </View>
  );
}

export default function ListenRoom() {
  const insets = useSafeAreaInsets();
  const { status, setConsented, start, stop } = useProtectSession();
  const [gate, setGate] = useState(!sessionConsent);
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (sessionConsent) setConsented(true);
  }, [setConsented]);

  const caution = status.action === 'warn';
  const word = !status.listening ? 'READY' : caution ? 'CAUTION' : 'CLEAR';
  const wordColor = !status.listening ? Ink.fg : caution ? Ink.caution : Ink.clear;
  const caption = useMemo(() => {
    if (!status.listening) return 'Speaker on. This phone listens.';
    if (caution) return (status.flags[0] || status.reason || 'Something sounds off').replace(/\.$/, '');
    if (status.transcript) {
      const parts = status.transcript.trim().split(/\s+/);
      return parts.slice(-8).join(' ');
    }
    return 'Listening';
  }, [status.listening, caution, status.flags, status.reason, status.transcript]);

  const onPressIn = () => {
    Animated.timing(press, { toValue: 0.94, duration: 120, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.timing(press, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  const begin = async () => {
    sessionConsent = true;
    setConsented(true);
    setGate(false);
    await start();
  };

  const toggle = () => {
    if (status.listening) stop();
    else {
      if (!status.consented) setConsented(true);
      start();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <Text style={styles.brand}>ShieldCall</Text>

      <View style={styles.stage}>
        <Pulse active={status.listening} caution={caution} />
        <Waveform active={status.listening} level={status.level} />
        <Text
          style={[styles.word, { color: wordColor }]}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {word}
        </Text>
        <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
      </View>

      <View style={styles.bottom}>
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <Pressable
            onPress={toggle}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={gate}
            accessibilityRole="button"
            accessibilityLabel={status.listening ? 'Stop listening' : 'Start listening'}
            style={({ pressed }) => [
              styles.orb,
              status.listening && styles.orbLive,
              caution && status.listening && styles.orbCaution,
              gate && styles.orbDisabled,
              pressed && { opacity: 0.9 },
            ]}
          >
            <MaterialIcons
              name={status.listening ? 'stop' : 'graphic-eq'}
              size={32}
              color={gate ? Ink.faint : Ink.bg}
            />
          </Pressable>
        </Animated.View>
        <Text style={styles.hint}>
          {status.listening ? 'Tap to stop' : 'Tap to listen'}
        </Text>
      </View>

      {gate && (
        <View style={[styles.gate, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.gateKicker}>Before we listen</Text>
          <Text style={styles.gateTitle}>This phone hears the room.</Text>
          <Text style={styles.gateBody}>
            Put the other phone on speaker. ShieldCall does not join the call and never hangs up.
            You confirm you are allowed to analyze this conversation.
          </Text>
          <Pressable
            onPress={begin}
            accessibilityRole="button"
            accessibilityLabel="Begin listening"
            style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.gateBtnText}>Begin</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.bg,
    paddingHorizontal: 28,
  },
  brand: {
    color: Ink.faint,
    fontSize: 13,
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseSlot: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
  },
  ringInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.35,
  },
  wave: {
    height: 88,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 28,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Ink.fg,
  },
  word: {
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    marginTop: 16,
    color: Ink.dim,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 280,
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  orb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Ink.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLive: {
    backgroundColor: Ink.fg,
  },
  orbCaution: {
    backgroundColor: Ink.caution,
  },
  orbDisabled: {
    backgroundColor: '#1A1A1A',
  },
  hint: {
    marginTop: 14,
    color: Ink.faint,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  gate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Ink.bg,
    paddingHorizontal: 28,
    justifyContent: 'flex-end',
  },
  gateKicker: {
    color: Ink.faint,
    fontSize: 13,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  gateTitle: {
    color: Ink.fg,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '500',
    letterSpacing: -0.6,
    marginBottom: 16,
  },
  gateBody: {
    color: Ink.dim,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 36,
    maxWidth: 340,
  },
  gateBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Ink.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateBtnText: {
    color: Ink.bg,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});

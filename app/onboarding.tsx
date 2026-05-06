/**
 * CALLSHIELD Onboarding + Auth Screen
 *
 * Flow:
 * 1. Three feature slides (swipeable)
 * 2. Sign Up screen (name, email, phone, password)
 * 3. OTP Verification screen (6-digit code sent to email)
 * 4. Sign In screen (for returning users)
 * 5. AI Persona selection
 * → Authenticated users land on /(tabs)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
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
    subtitle: 'Prescriptions, appointments, complaints — your AI agent handles it. You review results.',
    icon: 'support-agent',
  },
];

// ─── Input Field ──────────────────────────────────────────────────────────────
function AuthInput({
  icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize,
}: {
  icon: string; placeholder: string; value: string;
  onChangeText: (t: string) => void; secureTextEntry?: boolean;
  keyboardType?: any; autoCapitalize?: any;
}) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  return (
    <View style={[inputStyles.wrap, focused && inputStyles.wrapFocused]}>
      <MaterialIcons name={icon as any} size={18} color={focused ? Colors.primary : Colors.textMuted} />
      <TextInput
        style={inputStyles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPwd}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPwd(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name={showPwd ? 'visibility-off' : 'visibility'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  wrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  input: {
    flex: 1, fontSize: FontSize.md, color: Colors.text,
    includeFontPadding: false,
  },
});

// ─── Web Alert Hook ───────────────────────────────────────────────────────────
function useWebAlert() {
  const [alertState, setAlertState] = useState({ visible: false, title: '', message: '' });
  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      setAlertState({ visible: true, title, message });
    } else {
      Alert.alert(title, message);
    }
  }, []);
  const AlertModal = (
    <Modal visible={alertState.visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: Colors.bgCard, padding: 24, borderRadius: Radius.lg, minWidth: 280, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 8 }}>{alertState.title}</Text>
          <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 }}>{alertState.message}</Text>
          <TouchableOpacity
            style={{ backgroundColor: Colors.primary, padding: 12, borderRadius: Radius.full, alignItems: 'center' }}
            onPress={() => setAlertState(p => ({ ...p, visible: false }))}
          >
            <Text style={{ color: Colors.textInverse, fontWeight: FontWeight.bold }}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
  return { showAlert, AlertModal };
}

// ─── OTP Verification Screen ──────────────────────────────────────────────────
function OtpScreen({
  email,
  onSuccess,
  onBack,
}: {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const { verifyOtp, resendOtp } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { showAlert, AlertModal } = useWebAlert();

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (val: string, idx: number) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    setError('');
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp];
      next[idx - 1] = '';
      setOtp(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    const { error: err } = await verifyOtp(email, code);
    setLoading(false);
    if (err) {
      setError(err);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else {
      onSuccess();
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    const { error: err } = await resendOtp(email);
    setResending(false);
    if (err) {
      showAlert('Resend Failed', err);
    } else {
      setCanResend(false);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const maskedEmail = email.replace(/(.{2}).+?(@.+)/, '$1***$2');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {AlertModal}
      <ScrollView
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.authLogoWrap}>
          <MaterialIcons name="mark-email-unread" size={40} color={Colors.primary} />
        </View>

        <Text style={styles.authTitle}>Verify Your Email</Text>
        <Text style={styles.authSubtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>{maskedEmail}</Text>
        </Text>

        {/* 6-digit boxes */}
        <View style={otpStyles.row}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={ref => { inputRefs.current[idx] = ref; }}
              style={[
                otpStyles.box,
                digit ? otpStyles.boxFilled : null,
                error ? otpStyles.boxError : null,
              ]}
              value={digit}
              onChangeText={val => handleChange(val, idx)}
              onKeyPress={e => handleKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={idx === 0}
              accessibilityLabel={`Digit ${idx + 1} of 6`}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <>
              <MaterialIcons name="verified-user" size={18} color={Colors.textInverse} />
              <Text style={styles.primaryBtnText}>Verify & Continue</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={!canResend || resending}
          style={[styles.switchBtn, (!canResend || resending) && { opacity: 0.5 }]}
          activeOpacity={0.8}
        >
          {resending ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={styles.switchText}>
              {canResend
                ? <Text style={styles.switchLink}>Resend code</Text>
                : `Resend code in ${countdown}s`}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.privacyBox}>
          <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
          <Text style={styles.privacyText}>
            Check your spam folder if you don't see the email. The code expires in 10 minutes.
          </Text>
        </View>

        {/* Wrong email? */}
        <TouchableOpacity onPress={onBack} style={styles.switchBtn} activeOpacity={0.8}>
          <Text style={styles.switchText}>
            Wrong email? <Text style={styles.switchLink}>Go back</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const otpStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 46,
    height: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.border,
    fontSize: 26,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  boxError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerGlow,
  },
});

// ─── Sign Up Screen ───────────────────────────────────────────────────────────
function SignUpScreen({
  onSignIn,
  onSuccess,
}: {
  onSignIn: () => void;
  onSuccess: (email: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const { signUp } = useAuth();
  const { AlertModal } = useWebAlert();

  const handleSignUp = async () => {
    setFieldError('');
    if (!fullName.trim()) return setFieldError('Please enter your full name.');
    if (!email.trim() || !email.includes('@')) return setFieldError('Please enter a valid email address.');
    if (!phone.trim()) return setFieldError('Please enter your phone number.');
    if (password.length < 6) return setFieldError('Password must be at least 6 characters.');
    if (password !== confirmPwd) return setFieldError('Passwords do not match.');

    setLoading(true);
    const { error } = await signUp(email, password, fullName, phone);
    setLoading(false);

    if (error) {
      setFieldError(error);
    } else {
      onSuccess(email.trim().toLowerCase());
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {AlertModal}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authLogoWrap}>
          <MaterialIcons name="shield" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.authTitle}>Create Account</Text>
        <Text style={styles.authSubtitle}>
          Join CALLSHIELD and activate your AI protection layer.
        </Text>

        <View style={styles.form}>
          <AuthInput
            icon="person"
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <AuthInput
            icon="email"
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AuthInput
            icon="phone"
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <AuthInput
            icon="lock"
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <AuthInput
            icon="lock-outline"
            placeholder="Confirm Password"
            value={confirmPwd}
            onChangeText={setConfirmPwd}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {fieldError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{fieldError}</Text>
          </View>
        ) : null}

        <View style={styles.privacyBox}>
          <MaterialIcons name="lock" size={14} color={Colors.primary} />
          <Text style={styles.privacyText}>
            All audio processing is on-device. Your call audio never leaves your phone.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <>
              <MaterialIcons name="shield" size={18} color={Colors.textInverse} />
              <Text style={styles.primaryBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignIn} style={styles.switchBtn} activeOpacity={0.8}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sign In Screen ───────────────────────────────────────────────────────────
function SignInScreen({ onSignUp, onSuccess }: { onSignUp: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    setFieldError('');
    if (!email.trim()) return setFieldError('Please enter your email.');
    if (!password) return setFieldError('Please enter your password.');

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      setFieldError(error);
    } else {
      onSuccess();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.authContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authLogoWrap}>
          <MaterialIcons name="shield" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.authSubtitle}>
          Sign in to reactivate your CALLSHIELD protection.
        </Text>

        <View style={styles.form}>
          <AuthInput
            icon="email"
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AuthInput
            icon="lock"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {fieldError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{fieldError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <>
              <MaterialIcons name="security" size={18} color={Colors.textInverse} />
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignUp} style={styles.switchBtn} activeOpacity={0.8}>
          <Text style={styles.switchText}>
            New to CALLSHIELD? <Text style={styles.switchLink}>Create Account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Persona Screen ───────────────────────────────────────────────────────────
function PersonaScreen({ onActivate }: { onActivate: (name: string) => void }) {
  const [selected, setSelected] = useState('Alex');
  const { profile } = useAuth();

  return (
    <View style={styles.personaContainer}>
      <View style={styles.personaLogoWrap}>
        <MaterialIcons name="shield" size={56} color={Colors.primary} />
      </View>
      <Text style={styles.personaGreeting}>
        Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
      </Text>
      <Text style={styles.personaTitle}>Choose Your AI{'\n'}Voice Persona</Text>
      <Text style={styles.personaSubtitle}>
        This is the name your AI agent uses when answering calls on your behalf.
      </Text>
      <View style={styles.personaGrid}>
        {PERSONAS.map(name => (
          <TouchableOpacity
            key={name}
            style={[styles.personaChip, selected === name && styles.personaChipSelected]}
            onPress={() => setSelected(name)}
            activeOpacity={0.8}
          >
            <Text style={[styles.personaChipText, selected === name && styles.personaChipTextSelected]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.privacyBox}>
        <MaterialIcons name="lock" size={14} color={Colors.primary} />
        <Text style={styles.privacyText}>
          All audio processing happens on-device. No audio is ever transmitted or shared.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => onActivate(selected)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="shield" size={18} color={Colors.textInverse} />
        <Text style={styles.primaryBtnText}>Activate CALLSHIELD</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
type Screen = 'slides' | 'signup' | 'otp' | 'signin' | 'persona';

export default function OnboardingScreen() {
  const [screen, setScreen] = useState<Screen>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [pendingEmail, setPendingEmail] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setOnboarded, setPersonaName, setGhostMode } = useApp();
  const { updateProfile } = useAuth();

  const goNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      const next = slideIndex + 1;
      setSlideIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      setScreen('signup');
    }
  };

  // After signup → show OTP screen
  const handleSignUpSuccess = (email: string) => {
    setPendingEmail(email);
    setScreen('otp');
  };

  // After OTP verified → persona
  const handleOtpSuccess = () => {
    setScreen('persona');
  };

  // After sign-in → persona
  const handleSignInSuccess = () => {
    setScreen('persona');
  };

  const handleActivate = async (personaName: string) => {
    await Promise.all([
      setPersonaName(personaName),
      setGhostMode(true),
      setOnboarded(),
      updateProfile({ persona_name: personaName, ghost_mode_enabled: true }),
    ]);
    router.replace('/(tabs)');
  };

  if (screen === 'signup') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('slides')}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <SignUpScreen
          onSignIn={() => setScreen('signin')}
          onSuccess={handleSignUpSuccess}
        />
      </View>
    );
  }

  if (screen === 'otp') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('signup')}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <OtpScreen
          email={pendingEmail}
          onSuccess={handleOtpSuccess}
          onBack={() => setScreen('signup')}
        />
      </View>
    );
  }

  if (screen === 'signin') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('signup')}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <SignInScreen
          onSignUp={() => setScreen('signup')}
          onSuccess={handleSignInSuccess}
        />
      </View>
    );
  }

  if (screen === 'persona') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <PersonaScreen onActivate={handleActivate} />
      </View>
    );
  }

  // Slides
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
            {slideIndex < SLIDES.length - 1 ? 'Continue' : 'Get Protected'}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setScreen('signin')}
          style={styles.alreadyBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.alreadyText}>
            Already have an account? <Text style={styles.alreadyLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  backBtn: { padding: Spacing.md, paddingBottom: 4 },

  // Slides
  slide: { height, position: 'relative' },
  slideImage: { width: '100%', height: '100%', position: 'absolute' },
  slideOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,14,30,0.72)' },
  slideContent: { position: 'absolute', bottom: 180, left: Spacing.lg, right: Spacing.lg },
  slideIconWrap: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow, borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  slideTitle: {
    fontSize: 38, fontWeight: FontWeight.extrabold, color: Colors.text,
    lineHeight: 44, marginBottom: Spacing.md,
  },
  slideSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingBottom: 48, paddingTop: Spacing.md,
    backgroundColor: 'rgba(6,14,30,0.95)', borderTopWidth: 1, borderTopColor: Colors.border,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  nextBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 16, marginBottom: Spacing.sm,
  },
  nextBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  alreadyBtn: { alignItems: 'center', paddingVertical: 6 },
  alreadyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  alreadyLink: { color: Colors.primary, fontWeight: FontWeight.bold },

  // Auth screens
  authContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  authLogoWrap: {
    width: 76, height: 76, borderRadius: Radius.xl,
    backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4,
  },
  authTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center',
  },
  authSubtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  form: { gap: Spacing.sm },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.dangerGlow, borderRadius: Radius.md,
    padding: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.danger + '44',
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.danger, lineHeight: 20 },
  privacyBox: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  privacyText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 16,
  },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  switchBtn: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  switchLink: { color: Colors.primary, fontWeight: FontWeight.bold },

  // Persona
  personaContainer: {
    flex: 1, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  personaLogoWrap: {
    width: 96, height: 96, borderRadius: Radius.xl,
    backgroundColor: Colors.primaryGlow, borderWidth: 1.5, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  personaGreeting: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  personaTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.text, textAlign: 'center',
  },
  personaSubtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  personaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center',
  },
  personaChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 4, borderRadius: Radius.full,
    backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border,
  },
  personaChipSelected: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  personaChipText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  personaChipTextSelected: { color: Colors.primary, fontWeight: FontWeight.bold },
});

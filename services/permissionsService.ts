/**
 * ShieldCall AI Permissions Service
 *
 * Centralized permission management for all capabilities the app needs.
 * Handles: Microphone, Contacts, Notifications, Speech Recognition.
 * iOS is the primary platform — all permission strings match infoPlist.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const PERMISSIONS_REQUESTED_KEY = 'callshield_permissions_v1';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'limited';

export interface PermissionsState {
  microphone: PermissionStatus;
  contacts: PermissionStatus;
  notifications: PermissionStatus;
  phone: PermissionStatus;
}

// ── Configure notification behavior ─────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Check all current permission statuses ────────────────────────────────────
export async function checkAllPermissions(): Promise<PermissionsState> {
  const [contactsResult, notifResult] = await Promise.all([
    Contacts.getPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  let microphone: PermissionStatus = 'undetermined';
  try {
    const micResult = await Audio.getPermissionsAsync();
    microphone = mapStatus(micResult.status);
  } catch {
    microphone = 'undetermined';
  }

  return {
    microphone,
    contacts: mapStatus(contactsResult.status),
    notifications: mapStatus(notifResult.status),
    phone: Platform.OS === 'android' ? await checkAndroidPhonePermission() : 'undetermined',
  };
}

// ── Request all permissions in sequence ─────────────────────────────────────
export async function requestAndroidPhonePermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'undetermined';
  try {
    const wanted = [
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
    ].filter(Boolean);
    const granted = await PermissionsAndroid.requestMultiple(wanted);
    const values = Object.values(granted);
    if (values.every(v => v === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
    if (values.some(v => v === PermissionsAndroid.RESULTS.GRANTED)) return 'limited';
    return 'denied';
  } catch (e) {
    console.warn('Android phone permission error:', e);
    return 'denied';
  }
}

async function checkAndroidPhonePermission(): Promise<PermissionStatus> {
  try {
    const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    return ok ? 'granted' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function requestCallingPermissions(): Promise<PermissionsState> {
  const results: PermissionsState = {
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
    phone: 'undetermined',
  };
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    results.contacts = mapStatus(status);
  } catch {
    results.contacts = 'denied';
  }
  try {
    const { status } = await Audio.requestPermissionsAsync();
    results.microphone = mapStatus(status);
  } catch {
    results.microphone = 'denied';
  }
  results.phone = await requestAndroidPhonePermissions();
  return results;
}

export async function requestAllPermissions(): Promise<PermissionsState> {
  const results: PermissionsState = {
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
    phone: 'undetermined',
  };

  try {
    const { status } = await Contacts.requestPermissionsAsync();
    results.contacts = mapStatus(status);
  } catch (e) {
    console.warn('Contacts permission error:', e);
    results.contacts = 'denied';
  }

  try {
    const { status } = await Audio.requestPermissionsAsync();
    results.microphone = mapStatus(status);
  } catch (e) {
    console.warn('Microphone permission error:', e);
    results.microphone = 'denied';
  }

  results.phone = await requestAndroidPhonePermissions();

  // Notifications
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true, // For incoming call alerts
        provideAppNotificationSettings: true,
      },
    });
    results.notifications = mapStatus(status);
  } catch (e) {
    console.warn('Notifications permission error:', e);
    results.notifications = 'denied';
  }

  // Mark as requested
  try {
    await AsyncStorage.setItem(PERMISSIONS_REQUESTED_KEY, JSON.stringify({ requested: true, timestamp: Date.now() }));
  } catch {}

  return results;
}

// ── Request just contacts ────────────────────────────────────────────────────
export async function requestContactsPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

// ── Request just notifications ────────────────────────────────────────────────
export async function requestNotificationsPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true,
        provideAppNotificationSettings: true,
      },
    });
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

// ── Check if permissions were already requested before ────────────────────────
export async function werePermissionsRequested(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PERMISSIONS_REQUESTED_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.requested === true;
    }
  } catch {}
  return false;
}

// ── Send a local notification (for scam alerts, call summaries) ───────────────
export async function sendScamAlertNotification(opts: {
  callerName: string;
  callerNumber: string;
  threatLevel: 'danger' | 'warning' | 'safe';
  scamType?: string;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const title = opts.threatLevel === 'danger'
      ? '🚨 High-Risk Call Blocked'
      : opts.threatLevel === 'warning'
      ? '⚠️ Suspicious Call Detected'
      : '✅ Call Analysis Complete';

    const body = opts.scamType
      ? `${opts.callerName} (${opts.callerNumber}) — ${opts.scamType}`
      : `${opts.callerName} (${opts.callerNumber})`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { callerNumber: opts.callerNumber, threatLevel: opts.threatLevel },
        sound: opts.threatLevel === 'danger' ? 'alert.wav' : undefined,
        badge: opts.threatLevel !== 'safe' ? 1 : 0,
      },
      trigger: null, // Immediate
    });
  } catch (e) {
    console.warn('Notification send error:', e);
  }
}

// ── Register device push token ────────────────────────────────────────────────
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    // Set Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('shieldcallai-alerts', {
        name: 'ShieldCall AI Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00B4D8',
        sound: 'alert.wav',
      });
      await Notifications.setNotificationChannelAsync('shieldcallai-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF4B4B',
      });
    }

    // getExpoPushTokenAsync with no projectId uses the slug from app.json automatically.
    // For EAS builds, set projectId to your EAS project UUID from eas.json or app.json extra.
    const token = await Notifications.getExpoPushTokenAsync();
    const pushToken = token.data;

    // Persist push token to user profile so server can send targeted notifications
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ push_token: pushToken })
          .eq('id', user.id);
      }
    } catch (e) {
      console.warn('Push token storage error:', e);
    }

    return pushToken;
  } catch (e) {
    console.warn('Push token registration error:', e);
    return null;
  }
}

// ── Map expo status to our type ───────────────────────────────────────────────
function mapStatus(status: string): PermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'limited') return 'limited';
  return 'undetermined';
}

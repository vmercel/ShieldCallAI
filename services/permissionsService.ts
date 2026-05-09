/**
 * CALLSHIELD Permissions Service
 *
 * Centralized permission management for all capabilities the app needs.
 * Handles: Microphone, Contacts, Notifications, Speech Recognition.
 * iOS is the primary platform — all permission strings match infoPlist.
 */

import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const PERMISSIONS_REQUESTED_KEY = 'callshield_permissions_v1';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'limited';

export interface PermissionsState {
  microphone: PermissionStatus;
  contacts: PermissionStatus;
  notifications: PermissionStatus;
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

  return {
    microphone: 'undetermined', // Checked by expo-av when first recording starts
    contacts: mapStatus(contactsResult.status),
    notifications: mapStatus(notifResult.status),
  };
}

// ── Request all permissions in sequence ─────────────────────────────────────
export async function requestAllPermissions(): Promise<PermissionsState> {
  const results: PermissionsState = {
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
  };

  // Contacts
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    results.contacts = mapStatus(status);
  } catch (e) {
    console.warn('Contacts permission error:', e);
    results.contacts = 'denied';
  }

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
      await Notifications.setNotificationChannelAsync('callshield-alerts', {
        name: 'CallShield Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00B4D8',
        sound: 'alert.wav',
      });
      await Notifications.setNotificationChannelAsync('callshield-calls', {
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

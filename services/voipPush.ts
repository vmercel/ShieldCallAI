/**
 * ShieldCall AI VoIP push client (P1-4) — PushKit registration and
 * background incoming-call delivery.
 *
 * Flow:
 *   1. After sign-in, registerVoipPushToken() asks PushKit for the VoIP
 *      device token and upserts it into the `voip_tokens` table.
 *   2. startVoipPushListener() handles incoming VoIP pushes. On iOS 13+ the
 *      app MUST report the call to CallKit immediately — failing to do so
 *      gets the app terminated and eventually stops push delivery. So the
 *      CallKit report happens FIRST, before any JS-side routing.
 *   3. unregisterVoipPushToken() deletes the token row on sign-out.
 *
 * Graceful no-ops: web, Expo Go, or builds without the native module
 * (RNVoipPushNotificationManager) simply skip registration; nothing throws.
 */

import { NativeModules, Platform } from 'react-native';
import { supabase } from './supabaseClient';
import { displayIncomingCall } from './callKitService';

// The voip-push edge function and this module agree on these payload keys.
export const VOIP_PAYLOAD_KEYS = {
  callId: 'sc-call-id',
  callerName: 'sc-caller-name',
  callerNumber: 'sc-caller-number',
} as const;

export interface IncomingVoipCall {
  callId: string;
  callerName: string;
  callerNumber: string;
  callUUID: string;
}

// react-native-voip-push-notification constructs a NativeEventEmitter on
// import. Only load it when the native module is in this binary.
let VoipPush: any = null;
if (
  Platform.OS !== 'web' &&
  (NativeModules as any).RNVoipPushNotificationManager
) {
  try {
    VoipPush = require('react-native-voip-push-notification').default;
  } catch {
    VoipPush = null;
  }
}

export function isVoipPushAvailable(): boolean {
  return (
    VoipPush !== null && (Platform.OS === 'ios' || Platform.OS === 'android')
  );
}

function appId(): string {
  // Matches ios.bundleIdentifier / android.package in app.json.
  return 'com.shieldcallai.app';
}

let listenersStarted = false;
let tokenRegistered: string | null = null;
const voipCallSubscribers = new Set<(call: IncomingVoipCall) => void>();

/** Subscribe to incoming VoIP calls (after the CallKit report is made). */
export function onIncomingVoipCall(
  cb: (call: IncomingVoipCall) => void,
): () => void {
  voipCallSubscribers.add(cb);
  return () => {
    voipCallSubscribers.delete(cb);
  };
}

async function upsertToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('voip_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      app_id: appId(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
  if (error) {
    console.warn('[voipPush] token upsert failed:', error.message);
    return;
  }
  tokenRegistered = token;
}

/**
 * Register this device for VoIP pushes. Idempotent: safe to call on every
 * app start after sign-in; re-registers only when the token changed.
 */
export async function registerVoipPushToken(): Promise<string | null> {
  if (!isVoipPushAvailable()) return null;
  try {
    VoipPush.addEventListener('register', (deviceToken: string) => {
      if (!deviceToken || deviceToken === tokenRegistered) return;
      upsertToken(deviceToken).catch(() => {});
    });
    // didLoadWithEvents replays pushes that arrived while the app was dead.
    VoipPush.addEventListener('didLoadWithEvents', (events: any[]) => {
      for (const e of events || []) {
        if (e?.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
          handleVoipNotification(e.data);
        }
      }
    });
    VoipPush.registerVoipToken();
    return null;
  } catch (e) {
    console.warn('[voipPush] registration failed:', e);
    return null;
  }
}

/** Remove this device's token from the registry (call on sign-out). */
export async function unregisterVoipPushToken(): Promise<void> {
  try {
    if (tokenRegistered) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('voip_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('token', tokenRegistered);
      }
    }
  } catch {
    // Best effort — a stale row is cleaned by the server on APNs 410.
  } finally {
    tokenRegistered = null;
    if (VoipPush) {
      try {
        VoipPush.removeEventListener('register');
        VoipPush.removeEventListener('notification');
        VoipPush.removeEventListener('didLoadWithEvents');
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Handle an incoming VoIP push payload. Reports to CallKit FIRST (Apple
 * requirement), then notifies JS subscribers for routing.
 */
export function handleVoipNotification(payload: any): void {
  const callerName =
    typeof payload?.[VOIP_PAYLOAD_KEYS.callerName] === 'string' &&
    payload[VOIP_PAYLOAD_KEYS.callerName].trim()
      ? payload[VOIP_PAYLOAD_KEYS.callerName].trim()
      : 'Unknown caller';
  const callerNumber =
    typeof payload?.[VOIP_PAYLOAD_KEYS.callerNumber] === 'string'
      ? payload[VOIP_PAYLOAD_KEYS.callerNumber]
      : '';
  const callId =
    typeof payload?.[VOIP_PAYLOAD_KEYS.callId] === 'string' &&
    payload[VOIP_PAYLOAD_KEYS.callId]
      ? payload[VOIP_PAYLOAD_KEYS.callId]
      : undefined;

  // Apple rule: every VoIP push must surface a CallKit call, immediately.
  const callUUID = displayIncomingCall({ callerName, callerNumber });

  const call: IncomingVoipCall = {
    callId: callId || callUUID,
    callerName,
    callerNumber,
    callUUID,
  };
  for (const cb of voipCallSubscribers) {
    try {
      cb(call);
    } catch (e) {
      console.warn('[voipPush] subscriber error:', e);
    }
  }
}

/**
 * Start listening for incoming VoIP pushes. Attach once at app start;
 * the 'notification' event fires in foreground, background, and (via the
 * native relaunch) after the app was terminated.
 */
export function startVoipPushListener(): () => void {
  if (!isVoipPushAvailable() || listenersStarted) {
    return () => {};
  }
  listenersStarted = true;
  VoipPush.addEventListener('notification', (payload: any) => {
    handleVoipNotification(payload);
  });
  return () => {
    listenersStarted = false;
    try {
      VoipPush.removeEventListener('notification');
    } catch {
      // ignore
    }
  };
}

/**
 * CALLSHIELD CallKit Service — iOS Native Call Integration
 *
 * Uses react-native-callkeep to integrate with iOS CallKit, enabling:
 * - Native incoming call UI (shows on lock screen)
 * - Mute, Hold, Speaker through native iOS call controls
 * - DTMF (dial-tone) support
 * - Integration with iOS Recents call history
 * - Background call handling
 *
 * Android uses ConnectionService via the same library.
 *
 * NOTE: CallKit is iOS-only. Android support is via Telecom API.
 * Web platform gets no-op stubs to prevent crashes.
 */

import { NativeModules, Platform } from 'react-native';

// Simple UUID v4 — avoids react-native-uuid ESM compatibility issues
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// CallKeep JS constructs NativeEventEmitter on import. Only load if the native
// module is actually in this binary (not Expo Go / simulator without prebuild).
let RNCallKeep: any = null;
if (Platform.OS !== 'web' && NativeModules.RNCallKeep) {
  try {
    RNCallKeep = require('react-native-callkeep').default;
  } catch {
    RNCallKeep = null;
  }
}

// ── CallKit Configuration ─────────────────────────────────────────────────────
const CALLKEEP_OPTIONS = {
  ios: {
    appName: 'ShieldCall AI',
    supportsVideo: false,
    maximumCallsPerCallGroup: '1',
    maximumCallGroups: '1',
    includesCallsInRecents: true, // Show in iOS Recents
  },
  android: {
    alertTitle: 'Permissions Required',
    alertDescription: 'ShieldCall AI needs phone management permissions to screen and analyze calls.',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'callshield-calls',
      channelName: 'Incoming Calls',
      notificationTitle: 'ShieldCall AI is running',
      notificationIcon: 'ic_launcher_round',
    },
  },
};

export type CallDirection = 'inbound' | 'outbound';

export interface ActiveCall {
  callUUID: string;
  callerName: string;
  callerNumber: string;
  direction: CallDirection;
  startedAt: Date;
}

// ── Setup ──────────────────────────────────────────────────────────────────────
export async function setupCallKit(): Promise<boolean> {
  if (!RNCallKeep || Platform.OS === 'web') return false;
  try {
    await RNCallKeep.setup(CALLKEEP_OPTIONS);
    RNCallKeep.setAvailable(true);
    return true;
  } catch (e) {
    console.warn('CallKit setup error:', e);
    return false;
  }
}

// ── Display an incoming call via native CallKit UI ────────────────────────────
export function displayIncomingCall(opts: {
  callerName: string;
  callerNumber: string;
  hasVideo?: boolean;
}): string {
  const callUUID = generateUUID();
  if (!RNCallKeep || Platform.OS === 'web') return callUUID;

  rememberCall(callUUID, opts.callerName, opts.callerNumber, 'inbound');
  try {
    RNCallKeep.displayIncomingCall(
      callUUID,
      opts.callerNumber,
      opts.callerName,
      'number',
      opts.hasVideo ?? false,
    );
  } catch (e) {
    console.warn('displayIncomingCall error:', e);
  }

  return callUUID;
}

// ── Start an outbound call ─────────────────────────────────────────────────────
export function startOutgoingCall(opts: {
  callerName: string;
  callerNumber: string;
  hasVideo?: boolean;
}): string {
  const callUUID = generateUUID();
  rememberCall(callUUID, opts.callerName, opts.callerNumber, 'outbound');
  if (!RNCallKeep || Platform.OS === 'web') return callUUID;

  try {
    RNCallKeep.startCall(
      callUUID,
      opts.callerNumber,
      opts.callerName,
      'number',
      opts.hasVideo ?? false,
    );
  } catch (e) {
    console.warn('startOutgoingCall error:', e);
  }

  return callUUID;
}

// ── Answer a call (programmatically) ─────────────────────────────────────────
export function answerCall(callUUID: string): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.answerIncomingCall(callUUID);
    RNCallKeep.setCurrentCallActive(callUUID, true);
  } catch (e) {
    console.warn('answerCall error:', e);
  }
}

// ── End a call ─────────────────────────────────────────────────────────────────
export function endCall(callUUID: string): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.endCall(callUUID);
  } catch (e) {
    console.warn('endCall error:', e);
  }
}

// ── End all calls ─────────────────────────────────────────────────────────────
export function endAllCalls(): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.endAllCalls();
  } catch (e) {
    console.warn('endAllCalls error:', e);
  }
}

// ── Mute / Unmute ─────────────────────────────────────────────────────────────
export function setMuted(callUUID: string, muted: boolean): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.setMutedCall(callUUID, muted);
  } catch (e) {
    console.warn('setMuted error:', e);
  }
}

// ── Hold / Unhold ─────────────────────────────────────────────────────────────
export function setOnHold(callUUID: string, onHold: boolean): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.setOnHold(callUUID, onHold);
  } catch (e) {
    console.warn('setOnHold error:', e);
  }
}

// ── Report call connected (call was answered) ──────────────────────────────────
export function reportCallConnected(callUUID: string): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.reportConnectedOutgoingCallWithUUID(callUUID);
    RNCallKeep.setCurrentCallActive(callUUID, true);
  } catch (e) {
    console.warn('reportCallConnected error:', e);
  }
}

// ── Report that a call ended ──────────────────────────────────────────────────
export function reportCallEnded(callUUID: string, reason: 'failed' | 'remoteEnded' | 'unanswered' = 'remoteEnded'): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  const reasonMap = {
    failed: 1,
    remoteEnded: 2,
    unanswered: 3,
  };
  try {
    RNCallKeep.reportEndCallWithUUID(callUUID, reasonMap[reason]);
  } catch (e) {
    console.warn('reportCallEnded error:', e);
  }
}

// ── Update call display name ───────────────────────────────────────────────────
export function updateCallHandle(callUUID: string, callerName: string): void {
  if (!RNCallKeep || Platform.OS === 'web') return;
  try {
    RNCallKeep.updateDisplay(callUUID, callerName, callerName);
  } catch (e) {
    console.warn('updateCallHandle error:', e);
  }
}

// ── Register CallKit event listeners ─────────────────────────────────────────
const callDirectory = new Map<string, { name: string; number: string; direction: CallDirection }>();

export function rememberCall(callUUID: string, name: string, number: string, direction: CallDirection) {
  callDirectory.set(callUUID, { name, number, direction });
}

export function lookupCall(callUUID: string) {
  return callDirectory.get(callUUID) ?? null;
}

export interface CallKitEventHandlers {
  onIncomingCall?: (callUUID: string, callerNumber: string, callerName: string) => void;
  onAnswerCall?: (callUUID: string, callerNumber: string, callerName: string) => void;
  onEndCall?: (callUUID: string) => void;
  onMuteCall?: (callUUID: string, muted: boolean) => void;
  onHoldCall?: (callUUID: string, onHold: boolean) => void;
  onStartCall?: (callUUID: string, handle: string, contactIdentifier: string) => void;
  onDTMF?: (callUUID: string, digits: string) => void;
}

export function registerCallKitEvents(handlers: CallKitEventHandlers): () => void {
  if (!RNCallKeep || Platform.OS === 'web') return () => {};

  const listeners: any[] = [];

  listeners.push(
    RNCallKeep.addEventListener('didDisplayIncomingCall', (data: any) => {
      const uuid = data.callUUID;
      const number = data.handle || lookupCall(uuid)?.number || '';
      const name = data.localizedCallerName || lookupCall(uuid)?.name || number;
      rememberCall(uuid, name, number, 'inbound');
      handlers.onIncomingCall?.(uuid, number, name);
    })
  );

  if (handlers.onAnswerCall) {
    listeners.push(
      RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
        const known = lookupCall(callUUID);
        handlers.onAnswerCall!(callUUID, known?.number || '', known?.name || '');
      })
    );
  }

  if (handlers.onEndCall) {
    listeners.push(
      RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
        handlers.onEndCall!(callUUID);
      })
    );
  }

  if (handlers.onMuteCall) {
    listeners.push(
      RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }: { callUUID: string; muted: boolean }) => {
        handlers.onMuteCall!(callUUID, muted);
      })
    );
  }

  if (handlers.onHoldCall) {
    listeners.push(
      RNCallKeep.addEventListener('didToggleHoldCallAction', ({ callUUID, hold }: { callUUID: string; hold: boolean }) => {
        handlers.onHoldCall!(callUUID, hold);
      })
    );
  }

  if (handlers.onStartCall) {
    listeners.push(
      RNCallKeep.addEventListener('didReceiveStartCallAction', ({ callUUID, handle, contactIdentifier }: any) => {
        handlers.onStartCall!(callUUID, handle, contactIdentifier ?? handle);
      })
    );
  }

  if (handlers.onDTMF) {
    listeners.push(
      RNCallKeep.addEventListener('didPerformDTMFAction', ({ callUUID, digits }: { callUUID: string; digits: string }) => {
        handlers.onDTMF!(callUUID, digits);
      })
    );
  }

  return () => {
    listeners.forEach(l => {
      try { l?.remove?.(); } catch {}
    });
  };
}

// ── Check if CallKit is available ─────────────────────────────────────────────
export function isCallKitAvailable(): boolean {
  return Platform.OS === 'ios' && RNCallKeep !== null;
}

// ── Check if running on a real device (CallKit requires real device) ──────────
export function isRealDevice(): boolean {
  // On simulator, CallKit still works for testing but PushKit doesn't
  return Platform.OS === 'ios';
}

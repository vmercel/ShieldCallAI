/**
 * callKitService.web.ts — Web stub for react-native-callkeep.
 * react-native-callkeep is a native-only module and cannot be bundled on web.
 * All exports are no-ops / safe defaults so web builds succeed.
 */

export type CallDirection = 'inbound' | 'outbound';

export interface ActiveCall {
  callUUID: string;
  callerName: string;
  callerNumber: string;
  direction: CallDirection;
  startedAt: Date;
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

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function setupCallKit(): Promise<boolean> { return false; }
export function displayIncomingCall(_opts: { callerName: string; callerNumber: string; hasVideo?: boolean }): string { return uuid(); }
export function startOutgoingCall(_opts: { callerName: string; callerNumber: string; hasVideo?: boolean }): string { return uuid(); }
export function answerCall(_callUUID: string): void {}
export function endCall(_callUUID: string): void {}
export function endAllCalls(): void {}
export function setMuted(_callUUID: string, _muted: boolean): void {}
export function setOnHold(_callUUID: string, _onHold: boolean): void {}
export function reportCallConnected(_callUUID: string): void {}
export function reportCallEnded(_callUUID: string, _reason?: 'failed' | 'remoteEnded' | 'unanswered'): void {}
export function updateCallHandle(_callUUID: string, _callerName: string): void {}
export function rememberCall(_callUUID: string, _name: string, _number: string, _direction: CallDirection): void {}
export function lookupCall(_callUUID: string): { name: string; number: string; direction: CallDirection } | null { return null; }
export function registerCallKitEvents(_handlers: CallKitEventHandlers): () => void { return () => {}; }
export function isCallKitAvailable(): boolean { return false; }
export function isRealDevice(): boolean { return false; }

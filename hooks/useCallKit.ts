/**
 * CALLSHIELD useCallKit Hook
 *
 * Integrates with iOS CallKit via react-native-callkeep.
 * Provides:
 * - Setup on mount
 * - Active call state tracking
 * - Answer/End/Mute/Hold actions synced with native call UI
 * - Event listener management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  setupCallKit,
  displayIncomingCall,
  startOutgoingCall,
  answerCall,
  endCall,
  endAllCalls,
  setMuted,
  setOnHold,
  reportCallConnected,
  reportCallEnded,
  registerCallKitEvents,
  isCallKitAvailable,
  ActiveCall,
} from '../services/callKitService';

interface UseCallKitReturn {
  isReady: boolean;
  activeCall: ActiveCall | null;
  isMuted: boolean;
  isOnHold: boolean;
  showIncomingCall: (callerName: string, callerNumber: string) => string;
  initiateOutgoingCall: (callerName: string, callerNumber: string) => string;
  acceptCall: (callUUID: string) => void;
  hangUp: (callUUID: string) => void;
  toggleMute: (callUUID: string) => void;
  toggleHold: (callUUID: string) => void;
  onCallAnsweredByUser?: (callUUID: string) => void;
  onCallEndedByUser?: (callUUID: string) => void;
}

export function useCallKit(opts?: {
  onAnswerCall?: (callUUID: string, callerName: string, callerNumber: string) => void;
  onEndCall?: (callUUID: string) => void;
}): UseCallKitReturn {
  const [isReady, setIsReady] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const activeCallRef = useRef<ActiveCall | null>(null);

  // Setup CallKit on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsReady(true);
      return;
    }

    setupCallKit().then(success => {
      setIsReady(success || true); // Even if setup fails, mark ready to avoid blocking UI
    });

    // Register event listeners
    const unregister = registerCallKitEvents({
      onAnswerCall: (callUUID, callerNumber, callerName) => {
        const call = activeCallRef.current;
        opts?.onAnswerCall?.(
          callUUID,
          callerName || call?.callerName || '',
          callerNumber || call?.callerNumber || '',
        );
      },
      onEndCall: (callUUID) => {
        setActiveCall(null);
        activeCallRef.current = null;
        setIsMuted(false);
        setIsOnHold(false);
        opts?.onEndCall?.(callUUID);
      },
      onMuteCall: (_callUUID, muted) => {
        setIsMuted(muted);
      },
      onHoldCall: (_callUUID, onHold) => {
        setIsOnHold(onHold);
      },
      onStartCall: (callUUID, handle, contactIdentifier) => {
        // User initiated a call from iOS Recents or Siri
        const call: ActiveCall = {
          callUUID,
          callerName: contactIdentifier || handle,
          callerNumber: handle,
          direction: 'outbound',
          startedAt: new Date(),
        };
        setActiveCall(call);
        activeCallRef.current = call;
        reportCallConnected(callUUID);
        opts?.onAnswerCall?.(callUUID, call.callerName, call.callerNumber);
      },
    });

    return () => {
      unregister();
      endAllCalls();
    };
  }, []);

  const showIncomingCall = useCallback((callerName: string, callerNumber: string): string => {
    const callUUID = displayIncomingCall({ callerName, callerNumber });
    const call: ActiveCall = {
      callUUID,
      callerName,
      callerNumber,
      direction: 'inbound',
      startedAt: new Date(),
    };
    setActiveCall(call);
    activeCallRef.current = call;
    return callUUID;
  }, []);

  const initiateOutgoingCall = useCallback((callerName: string, callerNumber: string): string => {
    const callUUID = startOutgoingCall({ callerName, callerNumber });
    const call: ActiveCall = {
      callUUID,
      callerName,
      callerNumber,
      direction: 'outbound',
      startedAt: new Date(),
    };
    setActiveCall(call);
    activeCallRef.current = call;
    return callUUID;
  }, []);

  const acceptCall = useCallback((callUUID: string) => {
    answerCall(callUUID);
  }, []);

  const hangUp = useCallback((callUUID: string) => {
    endCall(callUUID);
    reportCallEnded(callUUID, 'remoteEnded');
    setActiveCall(null);
    activeCallRef.current = null;
    setIsMuted(false);
    setIsOnHold(false);
  }, []);

  const toggleMute = useCallback((callUUID: string) => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMuted(callUUID, newMuted);
  }, [isMuted]);

  const toggleHold = useCallback((callUUID: string) => {
    const newHold = !isOnHold;
    setIsOnHold(newHold);
    setOnHold(callUUID, newHold);
  }, [isOnHold]);

  return {
    isReady,
    activeCall,
    isMuted,
    isOnHold,
    showIncomingCall,
    initiateOutgoingCall,
    acceptCall,
    hangUp,
    toggleMute,
    toggleHold,
  };
}

/**
 * useVoiceCommand Hook
 * Manages voice recognition lifecycle, interim transcripts,
 * parsed commands, and cross-platform fallback state.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { VoiceCommandService, ParsedCommand, parseVoiceCommand, VoiceListenResult, captureSpokenUtterance } from '../services/voiceCommandService';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error' | 'manual';

export interface UseVoiceCommandReturn {
  state: VoiceState;
  interimText: string;
  finalText: string;
  parsedCommand: ParsedCommand | null;
  errorMessage: string;
  isWebSupported: boolean;
  isVoiceSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  submitManualText: (text: string) => void;
  reset: () => void;
}

export function useVoiceCommand(
  onCommand?: (cmd: ParsedCommand) => void,
): UseVoiceCommandReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const serviceRef = useRef(new VoiceCommandService());
  const nativeBusyRef = useRef(false);
  const isWebSupported = VoiceCommandService.isSupported();
  const isVoiceSupported = Platform.OS !== 'web' || isWebSupported;

  const reset = useCallback(() => {
    serviceRef.current.stopListening();
    setState('idle');
    setInterimText('');
    setFinalText('');
    setParsedCommand(null);
    setErrorMessage('');
  }, []);

  const handleFinalTranscript = useCallback((text: string, confidence: number) => {
    setFinalText(text);
    setInterimText('');
    setState('processing');

    const cmd = parseVoiceCommand(text);
    cmd.confidence = Math.min(cmd.confidence, confidence || cmd.confidence);
    setParsedCommand(cmd);
    setState('done');
    onCommand?.(cmd);
  }, [onCommand]);

  const startListening = useCallback(() => {
    reset();
    setState('listening');

    if (Platform.OS !== 'web') {
      if (nativeBusyRef.current) return;
      nativeBusyRef.current = true;
      captureSpokenUtterance().then(({ transcript, error }) => {
        nativeBusyRef.current = false;
        if (error || !transcript) {
          setErrorMessage(error || "I didn't catch that");
          setState('error');
          return;
        }
        setInterimText(transcript);
        handleFinalTranscript(transcript, 0.9);
      }).catch(() => {
        nativeBusyRef.current = false;
        setErrorMessage('Could not hear you. Tap the mic and try again.');
        setState('error');
      });
      return;
    }

    if (!isWebSupported) {
      setState('error');
      setErrorMessage('Voice is not available in this browser.');
      return;
    }

    const started = serviceRef.current.startListening(
      (result: VoiceListenResult) => {
        if (result.isFinal) {
          handleFinalTranscript(result.transcript, result.confidence);
        } else {
          setInterimText(result.transcript);
        }
      },
      (error: string) => {
        if (error === 'no-speech' || error === 'aborted') {
          setErrorMessage("I didn't catch that. Tap the mic and say Call, then a name.");
          setState('error');
          return;
        }
        setErrorMessage(error);
        setState('error');
      },
      'en-US',
      false,
    );

    if (!started) {
      setErrorMessage('Could not start the microphone.');
      setState('error');
    }
  }, [isWebSupported, reset, handleFinalTranscript]);

  const stopListening = useCallback(() => {
    serviceRef.current.stopListening();
    if (state === 'listening') setState('manual');
  }, [state]);

  const submitManualText = useCallback((text: string) => {
    if (!text.trim()) return;
    handleFinalTranscript(text.trim(), 0.9);
  }, [handleFinalTranscript]);

  useEffect(() => {
    return () => { serviceRef.current.stopListening(); };
  }, []);

  return {
    state,
    interimText,
    finalText,
    parsedCommand,
    errorMessage,
    isWebSupported,
    isVoiceSupported,
    startListening,
    stopListening,
    submitManualText,
    reset,
  };
}

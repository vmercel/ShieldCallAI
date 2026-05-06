/**
 * useVoiceCommand Hook
 * Manages voice recognition lifecycle, interim transcripts,
 * parsed commands, and cross-platform fallback state.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { VoiceCommandService, ParsedCommand, parseVoiceCommand, VoiceListenResult } from '../services/voiceCommandService';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error' | 'manual';

export interface UseVoiceCommandReturn {
  state: VoiceState;
  interimText: string;
  finalText: string;
  parsedCommand: ParsedCommand | null;
  errorMessage: string;
  isWebSupported: boolean;
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
  const isWebSupported = VoiceCommandService.isSupported();

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
    if (Platform.OS !== 'web' || !isWebSupported) {
      // Native fallback: show manual input mode
      setState('manual');
      return;
    }

    reset();
    setState('listening');

    const started = serviceRef.current.startListening(
      (result: VoiceListenResult) => {
        if (result.isFinal) {
          handleFinalTranscript(result.transcript, result.confidence);
        } else {
          setInterimText(result.transcript);
        }
      },
      (error: string) => {
        // "no-speech" is common — switch to manual rather than showing error
        if (error === 'no-speech' || error === 'aborted') {
          setState('manual');
          return;
        }
        setErrorMessage(error);
        setState('error');
      },
      'en-US',
      false,
    );

    if (!started) {
      setState('manual');
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
    startListening,
    stopListening,
    submitManualText,
    reset,
  };
}

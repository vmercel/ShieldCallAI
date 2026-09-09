/**
 * VoiceCommandService
 * Cross-platform voice recognition for CALLSHIELD
 *
 * Web (Chrome/Safari): Uses native Web Speech API (SpeechRecognition) — real STT
 * Native (iOS/Android): Uses expo-av recording + amplitude detection, 
 *   then surfaces a text-input confirm UI (native STT requires Expo plugin not in template)
 *
 * Command parser handles:
 *   "Call Mom"              → { action: 'call', target: 'Mom', targetType: 'name' }
 *   "Call 415 555 0041"     → { action: 'call', target: '4155550041', targetType: 'number' }
 *   "Dial Dr Nguyen"        → { action: 'call', target: 'Dr Nguyen', targetType: 'name' }
 *   "Text Sarah Chen"       → { action: 'text', target: 'Sarah Chen', targetType: 'name' }
 *   "Redial"                → { action: 'redial' }
 *   "Call back"             → { action: 'callback' }
 *   "Ghost mode"            → { action: 'ghost' }
 *   "Cancel"/"Stop"         → { action: 'cancel' }
 */

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabaseClient';
import { startExclusiveRecording, stopExclusiveRecording } from './micRecorder';

export type VoiceCommandAction = 'call' | 'text' | 'redial' | 'callBack' | 'ghost' | 'cancel' | 'unknown';

export interface ParsedCommand {
  action: VoiceCommandAction;
  target?: string;          // Name or number string
  targetType?: 'name' | 'number';
  rawText: string;
  confidence: number;       // 0–1
}

export interface VoiceListenResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

type TranscriptCallback = (result: VoiceListenResult) => void;
type ErrorCallback = (error: string) => void;

// ─── WEB SPEECH API TYPES ────────────────────────────────────────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// ─── COMMAND PARSER ───────────────────────────────────────────────────────────

const CALL_TRIGGERS = /^(call|dial|phone|ring|connect to|get me|reach)\s+/i;
const TEXT_TRIGGERS = /^(text|message|sms)\s+/i;
const REDIAL_TRIGGERS = /^redial|call again|call back last|last call again/i;
const CALLBACK_TRIGGERS = /^(call back|call them back|return the call)/i;
const GHOST_TRIGGERS = /^(ghost mode|activate ghost|answer for me|have ai answer)/i;
const CANCEL_TRIGGERS = /^(cancel|stop|never mind|forget it|dismiss)/i;
const NUMBER_PATTERN = /[\d\s\-\(\)\.]{7,}/;

export function parseVoiceCommand(text: string): ParsedCommand {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (CANCEL_TRIGGERS.test(lower)) {
    return { action: 'cancel', rawText: raw, confidence: 0.99 };
  }
  if (REDIAL_TRIGGERS.test(lower)) {
    return { action: 'redial', rawText: raw, confidence: 0.95 };
  }
  if (CALLBACK_TRIGGERS.test(lower)) {
    return { action: 'callBack', rawText: raw, confidence: 0.95 };
  }
  if (GHOST_TRIGGERS.test(lower)) {
    return { action: 'ghost', rawText: raw, confidence: 0.95 };
  }
  if (CALL_TRIGGERS.test(lower)) {
    const remainder = raw.replace(CALL_TRIGGERS, '').replace(/^(my|the|a)\s+/i, '').trim();
    const isNumber = NUMBER_PATTERN.test(remainder) && !/[a-zA-Z]{3,}/.test(remainder);
    return {
      action: 'call',
      target: isNumber ? remainder.replace(/\D/g, '') : remainder,
      targetType: isNumber ? 'number' : 'name',
      rawText: raw,
      confidence: 0.92,
    };
  }
  if (TEXT_TRIGGERS.test(lower)) {
    const remainder = raw.replace(TEXT_TRIGGERS, '').trim();
    return {
      action: 'text',
      target: remainder,
      targetType: 'name',
      rawText: raw,
      confidence: 0.88,
    };
  }

  // Bare name or number: "Mom", "Dr Nguyen", a phone number
  const isNumber = NUMBER_PATTERN.test(raw) && !/[a-zA-Z]{3,}/.test(raw);
  if (isNumber) {
    return {
      action: 'call',
      target: raw.replace(/\D/g, ''),
      targetType: 'number',
      rawText: raw,
      confidence: 0.8,
    };
  }
  if (/[a-zA-Z]/.test(raw) && raw.split(/\s+/).length <= 6) {
    return {
      action: 'call',
      target: raw.replace(/^(my|the|a)\s+/i, '').trim(),
      targetType: 'name',
      rawText: raw,
      confidence: 0.72,
    };
  }

  return { action: 'unknown', rawText: raw, confidence: 0.3 };
}

function dbToAmp(db: number): number {
  return (Math.max(-160, Math.min(0, db)) + 160) / 160;
}

/**
 * Native one-shot listen: record until a pause after speech (or 4.5s),
 * then transcribe. Used so "Call Mom" works on the same iPhone.
 */
export async function captureSpokenUtterance(): Promise<{ transcript: string; error?: string }> {
  if (Platform.OS === 'web') {
    return { transcript: '', error: 'use-web-speech' };
  }

  let recording: Audio.Recording | null = null;
  try {
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      return { transcript: '', error: 'Microphone permission is required to dial by voice' };
    }

    recording = await startExclusiveRecording();

    const started = Date.now();
    let heardSpeech = false;
    let silentMs = 0;

    await new Promise<void>(resolve => {
      const poll = setInterval(async () => {
        if (!recording) {
          clearInterval(poll);
          resolve();
          return;
        }
        try {
          const status = await recording.getStatusAsync();
          if (!status.isRecording) {
            clearInterval(poll);
            resolve();
            return;
          }
          const amp = dbToAmp((status as any).metering ?? -160);
          if (amp > 0.14) {
            heardSpeech = true;
            silentMs = 0;
          } else if (heardSpeech) {
            silentMs += 140;
          }
          const elapsed = Date.now() - started;
          if ((heardSpeech && silentMs >= 900) || elapsed >= 4500) {
            clearInterval(poll);
            resolve();
          }
        } catch {
          clearInterval(poll);
          resolve();
        }
      }, 140);
    });

    const uri = await stopExclusiveRecording(recording);
    recording = null;

    if (!uri) return { transcript: '', error: "I didn't catch that" };

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

    if (!base64) return { transcript: '', error: "I didn't catch that" };

    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { audioBase64: base64, mimeType: 'audio/m4a', language: 'en' },
    });

    if (error || !data?.transcript) {
      return { transcript: '', error: "I didn't catch a name. Say Call, then the contact." };
    }

    const transcript = String(data.transcript).trim();
    if (!transcript) return { transcript: '', error: "I didn't catch that" };
    return { transcript };
  } catch (e) {
    try { await stopExclusiveRecording(recording); } catch {}
    console.warn('captureSpokenUtterance', e);
    return { transcript: '', error: 'Could not hear you. Tap the mic and try again.' };
  }
}

// ─── VOICE RECOGNITION SERVICE ────────────────────────────────────────────────

export class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private onTranscriptCallback: TranscriptCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  static isSupported(): boolean {
    if (Platform.OS !== 'web') return false;
    try {
      const g = globalThis as any;
      return !!(g.SpeechRecognition || g.webkitSpeechRecognition);
    } catch {
      return false;
    }
  }

  /**
   * Start voice recognition
   * Returns true if started, false if not supported
   */
  startListening(
    onTranscript: TranscriptCallback,
    onError: ErrorCallback,
    language = 'en-US',
    continuous = false,
  ): boolean {
    if (!VoiceCommandService.isSupported()) return false;

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    try {
      const g = globalThis as any;
      const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
      this.recognition = new SR();
      this.recognition.lang = language;
      this.recognition.continuous = continuous;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let bestConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const alt = result[0];
          if (result.isFinal) {
            finalTranscript += alt.transcript;
            bestConfidence = Math.max(bestConfidence, alt.confidence || 0.85);
          } else {
            interimTranscript += alt.transcript;
          }
        }

        const isFinal = finalTranscript.length > 0;
        onTranscript({
          transcript: isFinal ? finalTranscript : interimTranscript,
          confidence: bestConfidence || 0.7,
          isFinal,
        });
      };

      this.recognition.onerror = (e: any) => {
        onError(e.error || 'Recognition error');
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      onError('Failed to start voice recognition');
      return false;
    }
  }

  stopListening() {
    try {
      this.recognition?.stop();
    } catch {}
    this.isListening = false;
  }

  get active() { return this.isListening; }
}

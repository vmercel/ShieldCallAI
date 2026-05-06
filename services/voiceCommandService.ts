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
    const remainder = raw.replace(CALL_TRIGGERS, '').trim();
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

  return { action: 'unknown', rawText: raw, confidence: 0.3 };
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

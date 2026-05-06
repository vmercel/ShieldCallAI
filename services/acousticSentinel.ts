/**
 * AcousticSentinel™ v1.0
 * Real-time Microphone Acoustic Stress & Cadence Analyzer
 *
 * Uses expo-av's Audio.Recording metering API to capture real microphone
 * amplitude data and derive acoustic threat signals:
 *
 * 1. Amplitude Variance Analysis — low variance = monotone = scripted/synthetic
 * 2. Silence Pattern Detection — regular scripted pauses = reading from script
 * 3. Peak Amplitude Tracking — shouting/urgency escalation detection
 * 4. Cadence Regularity Score — overly regular cadence = robocall/TTS indicator
 * 5. Spectral Flatness Proxy — via metering dB variance (no raw FFT needed)
 *
 * Returns normalized acoustic stress signal (0–100) injectable into SENTINEL.
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { ACOUSTIC_CONFIG } from '../constants/scamPatterns';

export interface AcousticSnapshot {
  amplitudeDb: number;          // Raw dB metering value (-160 to 0)
  normalizedAmplitude: number;  // 0–1
  isSilent: boolean;
  silenceCount: number;         // Consecutive silent windows
  amplitudeHistory: number[];   // Last N normalized amplitude readings
  variance: number;             // Amplitude variance (low = monotone)
  acousticStressScore: number;  // 0–100 derived stress signal
  flags: string[];
  timestamp: number;
}

export interface AcousticSession {
  snapshots: AcousticSnapshot[];
  avgVariance: number;
  totalSilencePauses: number;
  peakAmplitude: number;
  cadenceRegularity: number;    // 0–1 (1 = perfectly regular = suspicious)
  acousticThreatScore: number;  // 0–100 composite
  deepfakeConfidence: number;   // 0–100
  flags: string[];
}

const MAX_HISTORY = 60; // Keep last 60 samples (6 seconds at 100ms intervals)

export class AcousticSentinel {
  private recording: Audio.Recording | null = null;
  private isMonitoring = false;
  private snapshots: AcousticSnapshot[] = [];
  private amplitudeHistory: number[] = [];
  private silenceCount = 0;
  private onSnapshotCallback: ((snapshot: AcousticSnapshot) => void) | null = null;
  private meteringInterval: ReturnType<typeof setInterval> | null = null;
  private permissionGranted = false;

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch {
      return false;
    }
  }

  async startMonitoring(onSnapshot: (snapshot: AcousticSnapshot) => void): Promise<boolean> {
    if (!this.permissionGranted) {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });

      await this.recording.startAsync();
      this.isMonitoring = true;
      this.onSnapshotCallback = onSnapshot;

      // Poll metering at configured interval
      this.meteringInterval = setInterval(() => {
        this.processMeteringTick();
      }, ACOUSTIC_CONFIG.sampleWindowMs);

      return true;
    } catch (err) {
      console.warn('AcousticSentinel: Could not start recording', err);
      return false;
    }
  }

  async stopMonitoring(): Promise<AcousticSession> {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }

    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}

    this.isMonitoring = false;
    return this.buildSession();
  }

  getSession(): AcousticSession {
    return this.buildSession();
  }

  reset() {
    this.snapshots = [];
    this.amplitudeHistory = [];
    this.silenceCount = 0;
  }

  // ─── INTERNAL ──────────────────────────────────────────────────────────────

  private async processMeteringTick() {
    if (!this.recording || !this.isMonitoring) return;

    try {
      const status = await this.recording.getStatusAsync();
      if (!status.isRecording) return;

      const dbValue: number = (status as any).metering ?? -160;
      const normalizedAmp = this.dbToNormalized(dbValue);
      const isSilent = normalizedAmp < 0.05;

      if (isSilent) {
        this.silenceCount++;
      } else {
        this.silenceCount = 0;
      }

      // Maintain rolling history
      this.amplitudeHistory.push(normalizedAmp);
      if (this.amplitudeHistory.length > MAX_HISTORY) {
        this.amplitudeHistory.shift();
      }

      const variance = this.computeVariance(this.amplitudeHistory);
      const acousticStressScore = this.computeAcousticStress(
        normalizedAmp,
        variance,
        this.silenceCount
      );

      const flags: string[] = [];
      if (variance < ACOUSTIC_CONFIG.flatVarianceThreshold && this.amplitudeHistory.length > 10) {
        flags.push('Monotone cadence detected');
      }
      if (this.silenceCount >= ACOUSTIC_CONFIG.abnormalSilenceCount) {
        flags.push('Scripted pause pattern');
      }
      if (normalizedAmp > ACOUSTIC_CONFIG.highAmplitudeThreshold) {
        flags.push('Elevated vocal stress');
      }

      const snapshot: AcousticSnapshot = {
        amplitudeDb: dbValue,
        normalizedAmplitude: normalizedAmp,
        isSilent,
        silenceCount: this.silenceCount,
        amplitudeHistory: [...this.amplitudeHistory],
        variance,
        acousticStressScore,
        flags,
        timestamp: Date.now(),
      };

      this.snapshots.push(snapshot);
      this.onSnapshotCallback?.(snapshot);
    } catch {}
  }

  private dbToNormalized(db: number): number {
    // Map -160..0 dB to 0..1
    const clamped = Math.max(-160, Math.min(0, db));
    return (clamped + 160) / 160;
  }

  private computeVariance(values: number[]): number {
    if (values.length < 2) return 1;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sq = values.map(v => Math.pow(v - mean, 2));
    return sq.reduce((a, b) => a + b, 0) / sq.length;
  }

  private computeAcousticStress(
    amp: number,
    variance: number,
    silenceCount: number
  ): number {
    let score = 0;

    // Low variance = monotone = synthetic/scripted (up to 40 points)
    if (variance < ACOUSTIC_CONFIG.flatVarianceThreshold) {
      score += (1 - variance / ACOUSTIC_CONFIG.flatVarianceThreshold) * 40;
    }

    // High amplitude = urgency/shouting (up to 25 points)
    if (amp > ACOUSTIC_CONFIG.highAmplitudeThreshold) {
      score += ((amp - ACOUSTIC_CONFIG.highAmplitudeThreshold) / 0.22) * 25;
    }

    // Scripted silence pattern (up to 25 points)
    if (silenceCount >= ACOUSTIC_CONFIG.abnormalSilenceCount) {
      score += Math.min(25, silenceCount * 4);
    }

    return Math.min(100, Math.round(score));
  }

  private computeCadenceRegularity(): number {
    if (this.snapshots.length < 10) return 0;
    // Measure regularity of silence transitions (regular = scripted)
    const silenceEvents: number[] = [];
    let lastSilent = false;
    this.snapshots.forEach((s, i) => {
      if (s.isSilent && !lastSilent) silenceEvents.push(i);
      lastSilent = s.isSilent;
    });
    if (silenceEvents.length < 2) return 0;

    const gaps = silenceEvents.slice(1).map((v, i) => v - silenceEvents[i]);
    const gapVariance = this.computeVariance(gaps.map(g => g / 100));
    return Math.max(0, 1 - gapVariance * 5); // High regularity = low variance
  }

  private buildSession(): AcousticSession {
    if (this.snapshots.length === 0) {
      return {
        snapshots: [],
        avgVariance: 1,
        totalSilencePauses: 0,
        peakAmplitude: 0,
        cadenceRegularity: 0,
        acousticThreatScore: 0,
        deepfakeConfidence: 0,
        flags: [],
      };
    }

    const avgVariance = this.snapshots.reduce((a, s) => a + s.variance, 0) / this.snapshots.length;
    const totalSilencePauses = this.snapshots.filter(
      (s, i) => s.isSilent && (i === 0 || !this.snapshots[i - 1].isSilent)
    ).length;
    const peakAmplitude = Math.max(...this.snapshots.map(s => s.normalizedAmplitude));
    const cadenceRegularity = this.computeCadenceRegularity();
    const avgAcousticScore = this.snapshots.reduce((a, s) => a + s.acousticStressScore, 0) / this.snapshots.length;

    // Deepfake confidence from low variance + high cadence regularity
    const deepfakeConfidence = Math.min(
      100,
      Math.round(
        (avgVariance < 0.03 ? 60 : 0) +
        cadenceRegularity * 40
      )
    );

    const allFlags = [...new Set(this.snapshots.flatMap(s => s.flags))];

    return {
      snapshots: this.snapshots,
      avgVariance,
      totalSilencePauses,
      peakAmplitude,
      cadenceRegularity,
      acousticThreatScore: Math.round(avgAcousticScore),
      deepfakeConfidence,
      flags: allFlags,
    };
  }
}

export const acousticSentinel = new AcousticSentinel();

/**
 * ThreatService — Proxy to SentinelEngine™
 * Maintains backward-compatibility with legacy screens
 * while delegating all analysis to the real SENTINEL engine.
 */
import { ThreatLevel } from '../constants/mockData';
import { SentinelEngine } from './sentinelEngine';

const _engine = new SentinelEngine();

export const ThreatService = {
  analyzeText(text: string) {
    return _engine.analyzeText(text);
  },

  getThreatColor(level: ThreatLevel): string {
    return SentinelEngine.getThreatColor(level);
  },

  getThreatLabel(level: ThreatLevel): string {
    return SentinelEngine.getThreatLabel(level);
  },

  getThreatDescription(level: ThreatLevel, score: number): string {
    return SentinelEngine.getThreatDescription(level, score, 'stable');
  },

  simulateCallProgression(): number[] {
    return [5, 8, 12, 10, 18, 25, 35, 52, 68, 75, 82, 88, 94];
  },
};

import { ThreatLevel } from '../constants/mockData';

export interface ThreatWindow {
  score: number;
  level: ThreatLevel;
  flags: string[];
  timestamp: number;
}

const SCAM_PATTERNS = [
  { pattern: /gift card|apple pay|wire transfer|bitcoin|cryptocurrency/i, weight: 30, flag: 'Unusual payment method' },
  { pattern: /arrest|warrant|legal action|deportation|suspended/i, weight: 25, flag: 'Threat of legal action' },
  { pattern: /immediately|urgent|right now|today only|last chance/i, weight: 20, flag: 'Urgency escalation' },
  { pattern: /IRS|social security|ssa|medicare|federal|government/i, weight: 15, flag: 'Government impersonation' },
  { pattern: /verify your account|confirm your identity|security breach/i, weight: 15, flag: 'Identity verification request' },
  { pattern: /don.t tell|keep this confidential|secret|private matter/i, weight: 20, flag: 'Secrecy demand' },
  { pattern: /prize|won|lottery|inheritance|unclaimed funds/i, weight: 25, flag: 'Prize/lottery scam' },
];

export const ThreatService = {
  analyzeText(text: string): ThreatWindow {
    let score = 0;
    const flags: string[] = [];

    for (const { pattern, weight, flag } of SCAM_PATTERNS) {
      if (pattern.test(text)) {
        score += weight;
        flags.push(flag);
      }
    }

    score = Math.min(100, score);
    const level: ThreatLevel = score >= 70 ? 'danger' : score >= 35 ? 'warning' : 'safe';

    return {
      score,
      level,
      flags,
      timestamp: Date.now(),
    };
  },

  getThreatColor(level: ThreatLevel): string {
    switch (level) {
      case 'danger': return '#FF4757';
      case 'warning': return '#FFB700';
      case 'safe': return '#00C896';
    }
  },

  getThreatLabel(level: ThreatLevel): string {
    switch (level) {
      case 'danger': return 'HIGH RISK';
      case 'warning': return 'SUSPICIOUS';
      case 'safe': return 'SAFE';
    }
  },

  getThreatDescription(level: ThreatLevel, score: number): string {
    if (level === 'danger') return `Scam indicators detected (${score}% threat score). AI protection active.`;
    if (level === 'warning') return `Suspicious patterns detected (${score}% threat score). Monitoring closely.`;
    return 'No threats detected. Call appears legitimate.';
  },

  simulateCallProgression(): number[] {
    // Returns an array of threat scores over time for simulation
    return [5, 8, 12, 10, 18, 25, 35, 52, 68, 75, 82, 88, 94];
  },
};

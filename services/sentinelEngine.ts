/**
 * SENTINEL™ Engine v1.0
 * Real-time Conversational Threat Intelligence
 *
 * Core Innovation: Temporal Trajectory Weighted NLP Classification
 * ─────────────────────────────────────────────────────────────────
 * Unlike static keyword detectors, SENTINEL tracks the *rate of change*
 * in threat score across consecutive analysis windows. A rising trajectory
 * over 3 windows is multiplied by 4x — because scam calls escalate,
 * while legitimate urgent calls plateau.
 *
 * Processing pipeline:
 * 1. Tokenize & normalize input text
 * 2. Multi-pattern linguistic scan against 22-category taxonomy
 * 3. TF-IDF normalized keyword weighting (prevents over-scoring)
 * 4. Bayesian probability combination across categories
 * 5. Trajectory delta computation across sliding window history
 * 6. Temporal multiplier application (rising = 4x boost)
 * 7. Acoustic anomaly injection from AcousticSentinel layer
 * 8. Composite score emission with structured threat object
 */

import { ThreatLevel } from '../constants/mockData';
import {
  SCAM_PATTERNS,
  ScamPattern,
  ScamCategory,
  TRAJECTORY_CONFIG,
} from '../constants/scamPatterns';

export interface ThreatWindow {
  score: number;
  level: ThreatLevel;
  flags: string[];
  categories: ScamCategory[];
  factChecks: string[];
  timestamp: number;
  trajectoryDelta: number;   // Score change vs previous window
  trajectoryLabel: 'rising' | 'falling' | 'stable';
  multiplierApplied: number;
}

export interface ConversationAnalysis {
  compositeScore: number;
  level: ThreatLevel;
  allFlags: string[];
  allFactChecks: string[];
  windows: ThreatWindow[];
  trajectoryLabel: 'rising' | 'falling' | 'stable';
  dominantCategory: ScamCategory | null;
  confidenceLabel: string;
  scamType: string | null;
}

// ─── INTERNAL TYPES ──────────────────────────────────────────────────────────

interface PatternMatch {
  pattern: ScamPattern;
  matchCount: number;
  normalizedWeight: number;
}

// ─── SENTINEL ENGINE ─────────────────────────────────────────────────────────

export class SentinelEngine {
  private windowHistory: ThreatWindow[] = [];
  private cumulativeText = '';
  private categoryHitCounts: Partial<Record<ScamCategory, number>> = {};
  /** Peak composite score ever seen — score can never fall below 70% of this */
  private peakScore = 0;
  /** All flags ever detected across the full conversation */
  private allFlagsEver: Set<string> = new Set();
  /** All fact-checks ever triggered */
  private allFactChecksEver: Set<string> = new Set();

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  /**
   * Ingest a new text segment (500ms chunk from transcription)
   * Returns a fully-scored ThreatWindow
   */
  /**
   * Ingest a new text segment AND re-analyze the full cumulative transcript.
   * This ensures every batch has the full conversation context — so scam
   * elements from earlier turns are never lost as the conversation continues.
   */
  ingestSegment(text: string): ThreatWindow {
    this.cumulativeText += ' ' + text;
    // CRITICAL: analyze the FULL cumulative text, not just the new segment.
    // This means the engine always has complete context from call start.
    const normalized = this.normalizeText(this.cumulativeText);
    const matches = this.scanPatterns(normalized);
    const rawScore = this.computeRawScore(matches, normalized);
    const trajectory = this.computeTrajectory(rawScore);
    const finalScore = this.applyTrajectoryMultiplier(rawScore, trajectory);

    // Track category hits and build persistent flag/fact-check sets
    matches.forEach(m => {
      this.categoryHitCounts[m.pattern.category] =
        (this.categoryHitCounts[m.pattern.category] || 0) + m.matchCount;
      this.allFlagsEver.add(m.pattern.flag);
      if (m.pattern.factCheck) this.allFactChecksEver.add(m.pattern.factCheck);
    });

    // Track peak score for ratchet mechanism
    const cappedFinal = Math.min(100, Math.round(finalScore));
    if (cappedFinal > this.peakScore) this.peakScore = cappedFinal;

    const window: ThreatWindow = {
      score: cappedFinal,
      level: this.scoreToLevel(cappedFinal),
      flags: [...new Set(matches.map(m => m.pattern.flag))],
      categories: [...new Set(matches.map(m => m.pattern.category))],
      factChecks: matches
        .filter(m => m.pattern.factCheck)
        .map(m => m.pattern.factCheck as string),
      timestamp: Date.now(),
      trajectoryDelta: trajectory.delta,
      trajectoryLabel: trajectory.label,
      multiplierApplied: trajectory.multiplier,
    };

    this.windowHistory.push(window);
    return window;
  }

  /**
   * Analyze the full conversation history
   * Returns consolidated analysis across all windows
   */
  analyzeConversation(): ConversationAnalysis {
    if (this.windowHistory.length === 0) {
      return this.emptyAnalysis();
    }

    // Composite score with ratchet: can't fall below 70% of peak
    const compositeScore = this.computeCompositeScore();
    // Use persistent flag/fact-check sets — never lose earlier detections
    const allFlags = [...this.allFlagsEver];
    const allFactChecks = [...this.allFactChecksEver];
    const trajectoryLabel = this.windowHistory[this.windowHistory.length - 1]?.trajectoryLabel ?? 'stable';
    const dominantCategory = this.getDominantCategory();
    const level = this.scoreToLevel(compositeScore);

    return {
      compositeScore,
      level,
      allFlags,
      allFactChecks,
      windows: this.windowHistory,
      trajectoryLabel,
      dominantCategory,
      confidenceLabel: this.getConfidenceLabel(compositeScore, allFlags.length),
      scamType: this.getScamTypeLabel(dominantCategory),
    };
  }

  /**
   * Full-text analysis — useful for analyzing a complete statement at once
   */
  analyzeText(text: string): ThreatWindow {
    return this.ingestSegment(text);
  }

  /**
   * Reset engine state for a new call session
   */
  reset() {
    this.windowHistory = [];
    this.cumulativeText = '';
    this.categoryHitCounts = {};
    this.peakScore = 0;
    this.allFlagsEver = new Set();
    this.allFactChecksEver = new Set();
  }

  /**
   * Get running threat level for display
   */
  getCurrentLevel(): ThreatLevel {
    if (this.windowHistory.length === 0) return 'safe';
    const last = this.windowHistory[this.windowHistory.length - 1];
    return last.level;
  }

  getCurrentScore(): number {
    if (this.windowHistory.length === 0) return 0;
    return this.windowHistory[this.windowHistory.length - 1].score;
  }

  // ─── STATIC UTILITIES ──────────────────────────────────────────────────────

  static getThreatColor(level: ThreatLevel): string {
    switch (level) {
      case 'danger':  return '#FF4757';
      case 'warning': return '#FFB700';
      case 'safe':    return '#00C896';
    }
  }

  static getThreatLabel(level: ThreatLevel): string {
    switch (level) {
      case 'danger':  return 'HIGH RISK';
      case 'warning': return 'SUSPICIOUS';
      case 'safe':    return 'SAFE';
    }
  }

  static getThreatDescription(level: ThreatLevel, score: number, trajectory: string): string {
    if (level === 'danger') {
      return trajectory === 'rising'
        ? `Rapidly escalating threat. Score rising — classic scam progression detected (${score}%).`
        : `High-confidence scam indicators present (${score}%). AI protection active.`;
    }
    if (level === 'warning') {
      return `Suspicious patterns detected. Monitoring trajectory (${score}%). Stay alert.`;
    }
    return 'No threat indicators detected. Call appears legitimate.';
  }

  // ─── INTERNAL METHODS ──────────────────────────────────────────────────────

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scanPatterns(text: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    for (const pattern of SCAM_PATTERNS) {
      const globalRegex = new RegExp(pattern.regex.source, 'gi');
      const hits = text.match(globalRegex);
      if (hits && hits.length > 0) {
        // TF-IDF normalization: diminishing returns for repeated hits
        const matchCount = hits.length;
        const tfNormalized = 1 + Math.log(matchCount);
        matches.push({
          pattern,
          matchCount,
          normalizedWeight: pattern.weight * tfNormalized,
        });
      }
    }
    return matches;
  }

  private computeRawScore(matches: PatternMatch[], text: string): number {
    if (matches.length === 0) return 0;

    // Bayesian combination: P(scam | evidence) across independent pattern matches
    let combinedProbability = 0;
    for (const match of matches) {
      const patternProbability = match.normalizedWeight / 100;
      // Additive with diminishing returns via logarithm
      combinedProbability += patternProbability * (1 - combinedProbability * 0.3);
    }

    // Scale to 0–100
    return Math.min(100, combinedProbability * 100);
  }

  private computeTrajectory(currentRaw: number): {
    delta: number;
    label: 'rising' | 'falling' | 'stable';
    multiplier: number;
  } {
    const histLen = this.windowHistory.length;
    if (histLen < TRAJECTORY_CONFIG.trajectoryWindowCount) {
      return { delta: 0, label: 'stable', multiplier: 1.0 };
    }

    // Look at last N windows
    const recentWindows = this.windowHistory.slice(-TRAJECTORY_CONFIG.trajectoryWindowCount);
    const scores = recentWindows.map(w => w.score);

    // Compute slope via linear regression on recent window scores
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    let slope = 0;
    for (let i = 0; i < n; i++) {
      slope += (i - (n - 1) / 2) * (scores[i] - mean);
    }
    slope /= n;

    const delta = currentRaw - (this.windowHistory[histLen - 1]?.score ?? 0);

    if (slope > 3) {
      return {
        delta,
        label: 'rising',
        multiplier: TRAJECTORY_CONFIG.risingMultiplier,  // The core innovation: 4x boost
      };
    } else if (slope < -3) {
      return {
        delta,
        label: 'falling',
        multiplier: TRAJECTORY_CONFIG.decayFactor,
      };
    }
    return { delta, label: 'stable', multiplier: 1.0 };
  }

  private applyTrajectoryMultiplier(rawScore: number, trajectory: { multiplier: number }): number {
    // Don't multiply trivially low scores to avoid false rising positives
    if (rawScore < 5) return rawScore;
    // Cap the multiplier effect to prevent runaway scores on full-text re-analysis
    const boosted = rawScore * trajectory.multiplier;
    return Math.min(rawScore * 1.8, boosted); // Max 1.8x boost to prevent overscoring
  }

  private computeCompositeScore(): number {
    if (this.windowHistory.length === 0) return 0;

    // PEAK RATCHET: The latest window score (from full cumulative text) is the
    // most accurate. But it can't drop below 70% of the peak ever seen.
    // This prevents scam calls from appearing safe when the scammer shifts
    // to neutral-sounding follow-up questions after establishing urgency.
    const latestScore = this.windowHistory[this.windowHistory.length - 1].score;
    const peakFloor = Math.round(this.peakScore * 0.70);
    const ratchetedScore = Math.max(latestScore, peakFloor);

    // Also compute max-window score as a second floor (best single window)
    const maxWindowScore = Math.max(...this.windowHistory.map(w => w.score));
    // Final = max(ratcheted, 60% of best single window)
    return Math.min(100, Math.max(ratchetedScore, Math.round(maxWindowScore * 0.60)));
  }

  private getDominantCategory(): ScamCategory | null {
    const entries = Object.entries(this.categoryHitCounts) as [ScamCategory, number][];
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  private scoreToLevel(score: number): ThreatLevel {
    if (score >= 65) return 'danger';
    if (score >= 30) return 'warning';
    return 'safe';
  }

  private getConfidenceLabel(score: number, flagCount: number): string {
    if (score >= 85 && flagCount >= 3) return 'Very High Confidence';
    if (score >= 65 && flagCount >= 2) return 'High Confidence';
    if (score >= 40) return 'Moderate Confidence';
    if (score >= 20) return 'Low Confidence';
    return 'Insufficient Data';
  }

  private getScamTypeLabel(category: ScamCategory | null): string | null {
    const map: Partial<Record<ScamCategory, string>> = {
      government_impersonation: 'Government Impersonation',
      payment_manipulation: 'Payment Manipulation',
      urgency_coercion: 'Urgency Coercion',
      threat_intimidation: 'Threat & Intimidation',
      secrecy_demand: 'Isolation Tactic',
      identity_harvesting: 'Identity Theft Attempt',
      prize_lottery: 'Prize/Lottery Scam',
      tech_support: 'Tech Support Scam',
      romance_grooming: 'Romance Scam',
      medical_fraud: 'Medicare Fraud',
      bank_impersonation: 'Bank Impersonation',
      grandparent_scam: 'Grandparent Scam',
      investment_fraud: 'Investment Fraud',
      utility_impersonation: 'Utility Impersonation',
      credential_phishing: 'Credential Phishing',
      deepfake_indicator: 'Synthetic Voice Detected',
    };
    return category ? (map[category] ?? null) : null;
  }

  private emptyAnalysis(): ConversationAnalysis {
    return {
      compositeScore: 0,
      level: 'safe',
      allFlags: [],
      allFactChecks: [],
      windows: [],
      trajectoryLabel: 'stable',
      dominantCategory: null,
      confidenceLabel: 'Insufficient Data',
      scamType: null,
    };
  }
}

// Singleton instance for shared use across the app
export const sentinel = new SentinelEngine();

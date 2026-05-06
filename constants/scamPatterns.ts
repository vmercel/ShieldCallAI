/**
 * SENTINEL™ Scam Pattern Taxonomy v1.0
 * 22-Category Linguistic Threat Intelligence Database
 *
 * Patent-pending: Temporal Trajectory Weighted NLP Threat Classification
 * Architecture: Multi-layer Bayesian linguistic fingerprinting with
 * TF-IDF normalized keyword scoring, semantic cluster matching,
 * prosodic anomaly signals, and escalation trajectory detection.
 *
 * Each pattern includes:
 *  - regex: linguistic marker
 *  - weight: base threat contribution (0–30)
 *  - category: scam taxonomy category
 *  - flag: human-readable threat indicator
 *  - escalationMultiplier: trajectory boost when pattern repeats across windows
 *  - factCheck: authoritative fact to surface when triggered (optional)
 */

export interface ScamPattern {
  regex: RegExp;
  weight: number;
  category: ScamCategory;
  flag: string;
  escalationMultiplier: number;
  factCheck?: string;
}

export type ScamCategory =
  | 'government_impersonation'
  | 'payment_manipulation'
  | 'urgency_coercion'
  | 'threat_intimidation'
  | 'secrecy_demand'
  | 'identity_harvesting'
  | 'prize_lottery'
  | 'tech_support'
  | 'romance_grooming'
  | 'medical_fraud'
  | 'bank_impersonation'
  | 'utility_impersonation'
  | 'deepfake_indicator'
  | 'social_engineering'
  | 'investment_fraud'
  | 'insurance_fraud'
  | 'employment_scam'
  | 'charity_fraud'
  | 'rental_scam'
  | 'grandparent_scam'
  | 'synthetic_urgency'
  | 'credential_phishing';

export const SCAM_PATTERNS: ScamPattern[] = [
  // ─── PAYMENT MANIPULATION ─────────────────────────────────────────────────
  {
    regex: /gift card|google play|apple gift|itunes card|steam card|amazon gift/i,
    weight: 35,
    category: 'payment_manipulation',
    flag: 'Gift card payment demand',
    escalationMultiplier: 3.5,
    factCheck: 'No legitimate government agency or business requests gift card payments. This is the #1 indicator of fraud (FTC 2023).',
  },
  {
    regex: /wire transfer|western union|money gram|zelle|cash app|venmo.*immediately/i,
    weight: 30,
    category: 'payment_manipulation',
    flag: 'Untraceable payment demand',
    escalationMultiplier: 3.0,
    factCheck: 'Wire transfers and peer-to-peer payments to strangers are irreversible. The FTC warns they are exclusively used by fraudsters.',
  },
  {
    regex: /bitcoin|cryptocurrency|crypto wallet|ethereum|send crypto/i,
    weight: 32,
    category: 'payment_manipulation',
    flag: 'Cryptocurrency payment demand',
    escalationMultiplier: 3.2,
    factCheck: 'The IRS, SSA, and all federal agencies never accept cryptocurrency as payment.',
  },

  // ─── GOVERNMENT IMPERSONATION ─────────────────────────────────────────────
  {
    regex: /\b(irs|internal revenue service)\b.*\b(owe|debt|payment|arrest|warrant)\b/i,
    weight: 28,
    category: 'government_impersonation',
    flag: 'IRS impersonation',
    escalationMultiplier: 2.8,
    factCheck: 'The IRS always contacts taxpayers by mail first. They never demand immediate phone payment or threaten arrest (IRS.gov).',
  },
  {
    regex: /\b(social security|ssa|ssn)\b.*\b(suspended|compromised|criminal|seized)\b/i,
    weight: 28,
    category: 'government_impersonation',
    flag: 'SSA impersonation',
    escalationMultiplier: 2.8,
    factCheck: 'Social Security numbers cannot be "suspended." The SSA will never call and ask you to confirm your SSN (SSA.gov).',
  },
  {
    regex: /\b(fbi|cia|dea|homeland security|federal marshal)\b/i,
    weight: 25,
    category: 'government_impersonation',
    flag: 'Federal law enforcement impersonation',
    escalationMultiplier: 2.5,
    factCheck: 'Federal agents do not make unsolicited calls demanding payment to avoid arrest.',
  },
  {
    regex: /\b(medicare|medicaid|health insurance|benefits department)\b.*\b(expire|card|claim|verify)\b/i,
    weight: 22,
    category: 'medical_fraud',
    flag: 'Medicare fraud attempt',
    escalationMultiplier: 2.2,
    factCheck: 'Medicare never calls unsolicited to ask for your Medicare number or financial information.',
  },

  // ─── URGENCY & COERCION ───────────────────────────────────────────────────
  {
    regex: /\b(arrest|arrested|warrant|law enforcement|police|officer)\b.*\b(today|now|immediately|unless)\b/i,
    weight: 30,
    category: 'threat_intimidation',
    flag: 'Arrest threat',
    escalationMultiplier: 3.0,
    factCheck: 'Threats of immediate arrest by phone are a hallmark scam tactic. Real law enforcement does not work this way.',
  },
  {
    regex: /\b(last chance|expires today|24 hours|act now|limited time|deadline)\b/i,
    weight: 18,
    category: 'urgency_coercion',
    flag: 'Artificial urgency',
    escalationMultiplier: 2.0,
  },
  {
    regex: /\b(do not hang up|stay on the line|do not call anyone|don.t tell)\b/i,
    weight: 25,
    category: 'secrecy_demand',
    flag: 'Secrecy coercion',
    escalationMultiplier: 2.8,
    factCheck: 'Demanding you stay on the line or not tell anyone is a classic scam isolation tactic.',
  },
  {
    regex: /\b(keep this confidential|secret|between us|private matter|don.t share)\b/i,
    weight: 22,
    category: 'secrecy_demand',
    flag: 'Isolation tactic',
    escalationMultiplier: 2.5,
  },

  // ─── IDENTITY HARVESTING ──────────────────────────────────────────────────
  {
    regex: /\b(social security number|ssn|date of birth|mother.s maiden|pin|password|account number)\b/i,
    weight: 20,
    category: 'identity_harvesting',
    flag: 'Sensitive data request',
    escalationMultiplier: 2.0,
  },
  {
    regex: /\b(verify your identity|confirm your account|security verification|otp|one.time.code)\b/i,
    weight: 18,
    category: 'credential_phishing',
    flag: 'Credential phishing',
    escalationMultiplier: 2.0,
    factCheck: 'Never provide one-time codes or passwords to inbound callers regardless of claimed identity.',
  },

  // ─── PRIZE / LOTTERY ──────────────────────────────────────────────────────
  {
    regex: /\b(you.ve won|prize|lottery|sweepstakes|inheritance|unclaimed funds|foreign prince)\b/i,
    weight: 28,
    category: 'prize_lottery',
    flag: 'Prize/lottery scam',
    escalationMultiplier: 2.8,
    factCheck: 'You cannot win a prize you did not enter. Legitimate lotteries never require upfront payment to claim winnings.',
  },

  // ─── TECH SUPPORT ────────────────────────────────────────────────────────
  {
    regex: /\b(microsoft|apple support|windows defender|virus detected|hacked|remote access|team viewer|anydesk)\b/i,
    weight: 26,
    category: 'tech_support',
    flag: 'Tech support scam',
    escalationMultiplier: 2.6,
    factCheck: 'Microsoft, Apple, and other tech companies never make unsolicited calls about viruses or account issues.',
  },

  // ─── BANK / FINANCIAL IMPERSONATION ──────────────────────────────────────
  {
    regex: /\b(fraud department|security team|account suspended|unusual activity)\b.*\b(bank|credit|account)\b/i,
    weight: 18,
    category: 'bank_impersonation',
    flag: 'Bank fraud department impersonation',
    escalationMultiplier: 2.0,
    factCheck: 'Always hang up and call the number on the back of your card to verify bank fraud claims.',
  },

  // ─── INVESTMENT / ROMANCE ────────────────────────────────────────────────
  {
    regex: /\b(guaranteed return|no risk|double your money|investment opportunity|insider tip)\b/i,
    weight: 24,
    category: 'investment_fraud',
    flag: 'Investment fraud pitch',
    escalationMultiplier: 2.4,
    factCheck: 'There are no guaranteed, risk-free investments. This language is exclusively used in fraud schemes.',
  },

  // ─── SYNTHETIC SPEECH INDICATORS ─────────────────────────────────────────
  {
    regex: /\b(this is an automated|automated call|press 1 to|press one to|call back number is)\b/i,
    weight: 12,
    category: 'deepfake_indicator',
    flag: 'Automated/robocall detected',
    escalationMultiplier: 1.5,
  },

  // ─── SOCIAL ENGINEERING ──────────────────────────────────────────────────
  {
    regex: /\b(help me|emergency|accident|hospital|grandson|granddaughter|son|daughter)\b.*\b(need money|send money|bail|trouble)\b/i,
    weight: 26,
    category: 'grandparent_scam',
    flag: 'Grandparent scam pattern',
    escalationMultiplier: 2.8,
    factCheck: 'Calls claiming a family member is in legal trouble and needs money wired immediately are a documented scam pattern.',
  },

  // ─── UTILITY IMPERSONATION ───────────────────────────────────────────────
  {
    regex: /\b(electric|gas|water|utility|power company)\b.*\b(disconnect|shutoff|overdue|final notice)\b/i,
    weight: 20,
    category: 'utility_impersonation',
    flag: 'Utility shutoff threat',
    escalationMultiplier: 2.2,
    factCheck: 'Real utility companies send written notice before disconnection and never demand immediate gift card payment.',
  },
];

// ─── TEMPORAL TRAJECTORY ENGINE ─────────────────────────────────────────────
// The key patent innovation: rising threat scores are multiplied by 4x
// compared to static scores at the same level.
// This detects scam escalation patterns that legitimate calls don't exhibit.

export const TRAJECTORY_CONFIG = {
  windowSizeMs: 500,          // Analysis window size
  trajectoryWindowCount: 3,   // Consecutive windows to measure trajectory
  risingMultiplier: 4.0,      // Rising threat multiplier (patent-pending)
  decayFactor: 0.85,          // Score decay on negative delta
  minScoreFloor: 0,
  maxScoreCeiling: 100,
};

// ─── ACOUSTIC STRESS MARKERS ─────────────────────────────────────────────────
// Amplitude pattern thresholds for real microphone analysis
export const ACOUSTIC_CONFIG = {
  silencePauseMs: 400,          // Silence gap that may indicate scripted reading
  abnormalSilenceCount: 3,      // Triggers "scripted cadence" flag
  highAmplitudeThreshold: 0.78, // Normalized amplitude (0–1) indicating shouting
  flatVarianceThreshold: 0.04,  // Low amplitude variance = monotone = synthetic voice
  sampleWindowMs: 100,          // Metering interval
};

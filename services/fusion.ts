/**
 * Disagreement-aware fusion for the phone client.
 * A natural voice delivering a hostile script is still a hit.
 * Recommend-only: this never hangs up.
 */

export type ProtectAction = 'monitor' | 'warn';

export function fuseScores(fraud01: number, synth01: number): {
  risk: number;
  action: ProtectAction;
  reason: string;
} {
  const fraud = clamp01(fraud01);
  const synth = clamp01(synth01);
  const humanVishing = fraud * (1 - synth);
  const risk = Math.max(fraud, synth, humanVishing);
  if (humanVishing >= 0.45 && synth < 0.4) {
    return { risk, action: 'warn', reason: 'Scam language on a natural-sounding voice' };
  }
  if (synth >= 0.5) {
    return { risk, action: 'warn', reason: 'Synthetic or vocoded speech' };
  }
  if (fraud >= 0.45) {
    return { risk, action: 'warn', reason: 'Social-engineering language' };
  }
  return { risk, action: 'monitor', reason: 'Listening' };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

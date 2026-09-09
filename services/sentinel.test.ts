import { SentinelEngine } from './sentinelEngine';
import { fuseScores } from './fusion';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const DENTIST =
  'Hi, this is a reminder from Dr. Chen at the dentist office. ' +
  'You have a cleaning appointment tomorrow at 2pm. ' +
  'Please call us if you need to reschedule. See you then.';

const GRANDPARENT_BOND =
  'Grandma it is your grandson. I am in trouble at jail. ' +
  'I need money for a bond. Please send a wire transfer. Do not tell mom.';

const dentistEngine = new SentinelEngine();
dentistEngine.ingestSegment(DENTIST);
const dentist = dentistEngine.analyzeConversation();
const dentistFused = fuseScores(dentist.compositeScore / 100, 0);

assert(dentist.compositeScore < 30, `dentist score should be LOW, got ${dentist.compositeScore}`);
assert(dentist.level === 'safe', `dentist level should be safe, got ${dentist.level}`);
assert(dentistFused.action === 'monitor', `dentist must monitor, got ${dentistFused.action}`);

const scamEngine = new SentinelEngine();
scamEngine.ingestSegment(GRANDPARENT_BOND);
const scam = scamEngine.analyzeConversation();
const scamFused = fuseScores(scam.compositeScore / 100, 0);

assert(scam.compositeScore >= 45, `grandparent/bond/wire-transfer score should be HIGH, got ${scam.compositeScore}`);
assert(scam.level !== 'safe', `scam level should warn/danger, got ${scam.level}`);
assert(scamFused.action === 'warn', `grandparent/bond/wire-transfer must warn, got ${scamFused.action}`);
assert(
  scam.allFlags.some(f => /wire|grandparent|secrecy|isolation|payment|bond/i.test(f)),
  `scam flags missing SE markers: ${scam.allFlags.join(', ')}`,
);

console.log('sentinel ok', {
  dentist: { score: dentist.compositeScore, level: dentist.level, action: dentistFused.action },
  scam: { score: scam.compositeScore, level: scam.level, action: scamFused.action, flags: scam.allFlags },
});

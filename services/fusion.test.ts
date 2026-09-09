import { fuseScores } from './fusion';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const humanVishing = fuseScores(0.8, 0.05);
assert(humanVishing.action === 'warn', 'human vishing must warn');
assert(humanVishing.risk >= 0.45, 'human vishing risk');
assert(humanVishing.reason.includes('natural'), 'human vishing reason');

const quiet = fuseScores(0.05, 0.05);
assert(quiet.action === 'monitor', 'low scores monitor');

const vocoded = fuseScores(0.1, 0.7);
assert(vocoded.action === 'warn', 'vocoded must warn');

const social = fuseScores(0.5, 0.1);
assert(social.action === 'warn', 'social-engineering language must warn');

const nan = fuseScores(Number.NaN, Number.POSITIVE_INFINITY);
assert(nan.action === 'monitor', 'non-finite scores monitor');
assert(nan.risk === 0, 'non-finite risk is 0');

const clamped = fuseScores(2, -1);
assert(clamped.action === 'warn', 'fraud above 1 still warns after clamp');
assert(clamped.risk <= 1, 'risk is clamped to 1');

console.log('fusion ok');

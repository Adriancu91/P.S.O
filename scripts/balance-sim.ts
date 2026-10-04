// Balance simulator: run many bot-vs-bot battles and print win rates.
// Usage: npm run balance [-- level]
import {
  ARCHETYPES,
  RACE_IDS,
  createRng,
  generateBot,
  simulateBattle,
  toSnapshot,
  type RaceId,
} from '../shared/src/index.js';

const level = Number(process.argv[2] ?? 20);
const N = 400;

function run(label: string, mk: (seed: string, side: 0 | 1) => ReturnType<typeof generateBot>) {
  let w0 = 0,
    w1 = 0,
    draws = 0,
    timeouts = 0,
    dur = 0;
  for (let i = 0; i < N; i++) {
    const a = mk(`${label}-a-${i}`, 0);
    const b = mk(`${label}-b-${i}`, 1);
    const r = simulateBattle(toSnapshot(a.name, a.gender, a.build), toSnapshot(b.name, b.gender, b.build), `${label}-${i}`);
    if (r.winner === 0) w0++;
    else if (r.winner === 1) w1++;
    else draws++;
    if (r.reason === 'timeout') timeouts++;
    dur += r.durationMs;
  }
  return { w0: w0 / N, w1: w1 / N, draws, timeouts, avgS: dur / N / 1000 };
}

console.log(`\n== Race vs race @ level ${level} (random archetypes, ${N} fights) ==`);
for (let i = 0; i < RACE_IDS.length; i++)
  for (let j = i + 1; j < RACE_IDS.length; j++) {
    const ra = RACE_IDS[i] as RaceId,
      rb = RACE_IDS[j] as RaceId;
    const res = run(`${ra}v${rb}`, (seed, side) => generateBot(createRng(seed), level, { raceId: side === 0 ? ra : rb, rarity: 'uncommon' }));
    console.log(`${ra.padEnd(7)} vs ${rb.padEnd(7)} ${(res.w0 * 100).toFixed(0)}% / ${(res.w1 * 100).toFixed(0)}%  timeouts=${res.timeouts} avg=${res.avgS.toFixed(1)}s`);
  }

console.log(`\n== Archetype vs archetype @ level ${level} (random race) ==`);
const arch = Object.keys(ARCHETYPES);
const rows: string[] = [];
const totals: Record<string, number> = {};
for (const a of arch) {
  let line = a.padEnd(9);
  for (const b of arch) {
    if (a === b) {
      line += '   -  ';
      continue;
    }
    const res = run(`${a}v${b}`, (seed, side) => generateBot(createRng(seed), level, { archetype: side === 0 ? a : b, rarity: 'uncommon', raceId: undefined }));
    totals[a] = (totals[a] ?? 0) + res.w0;
    line += ` ${(res.w0 * 100).toFixed(0).padStart(3)}% `;
  }
  rows.push(line);
}
console.log('         ' + arch.map((a) => a.slice(0, 5).padStart(6)).join(''));
rows.forEach((r) => console.log(r));
console.log('\nAverage win rate per archetype:');
for (const a of arch) console.log(`  ${a.padEnd(9)} ${((totals[a] / (arch.length - 1)) * 100).toFixed(0)}%`);

console.log(`\n== Level advantage: L${level} vs L${level + 3} (same random builds) ==`);
const lv = run('lvl', (seed, side) => generateBot(createRng(seed), side === 0 ? level : level + 3, { rarity: 'uncommon' }));
console.log(`lower level wins ${(lv.w0 * 100).toFixed(0)}% (should be clearly >0, <50)`);

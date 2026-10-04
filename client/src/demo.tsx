import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ARCHETYPES, RACES, RACE_IDS, combatPower, createRng, evolutionForLevel, generateBot, simulateBattle,
  battleHighlights, toSnapshot, type Gender, type RaceId,
} from '@pso/shared';
import { GameProvider } from './game';
import { PetArt } from './components/PetArt';
import { BattleReplay } from './components/BattleReplay';
import type { FightResponse } from './api';
import { RACE_BG } from './format';
import './styles.css';

const STYLES: Record<RaceId, string[]> = {
  tuskar: ['tank', 'physical', 'regen', 'crit'],
  vexa: ['crit', 'speed', 'physical', 'hybrid'],
  hoolu: ['magic', 'regen', 'tank', 'hybrid'],
};

function Demo() {
  const [race, setRace] = useState<RaceId>('vexa');
  const [gender, setGender] = useState<Gender>('f');
  const [level, setLevel] = useState(15);
  const [style, setStyle] = useState('crit');
  const [round, setRound] = useState(0);
  const [fight, setFight] = useState<FightResponse | null>(null);
  const [score, setScore] = useState({ w: 0, l: 0 });

  const styles = STYLES[race];
  const arch = styles.includes(style) ? style : styles[0];
  const evolution = evolutionForLevel(level);
  const me = useMemo(() => {
    const b = generateBot(createRng(`me-${race}-${arch}-${level}`), level, { raceId: race, archetype: arch, rarity: 'rare' });
    return toSnapshot(RACES[race].stageNames[evolution - 1], gender, b.build);
  }, [race, arch, level, gender, evolution]);

  const start = () => {
    const seed = `demo-${Date.now()}-${round}`;
    const rng = createRng(seed);
    const opp = generateBot(rng, Math.max(1, level + rng.int(-2, 2)), { rarity: rng.chance(0.5) ? 'rare' : 'uncommon' });
    const oppSnap = toSnapshot(opp.name, opp.gender, opp.build);
    const r = simulateBattle(me, oppSnap, seed);
    setScore((s) => ({ w: s.w + (r.winner === 0 ? 1 : 0), l: s.l + (r.winner === 1 ? 1 : 0) }));
    setRound((n) => n + 1);
    setFight({
      battle: { id: seed, fighters: [me, oppSnap], isBot: true, seed, engineVersion: r.engineVersion, winner: r.winner, reason: r.reason, durationMs: r.durationMs, summary: r.summary, events: r.events, highlights: battleHighlights(r, [me.name, oppSnap.name]) },
      you: 0, rewards: null, levelUp: null,
    });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app" style={{ paddingBottom: 32 }}>
      <header className="topbar">
        <span className="logo">P.S.O.</span>
        <span className="pill">Demo</span>
        <span className="pill">🏆 {score.w}–{score.l}</span>
      </header>

      {fight ? (
        <BattleReplay key={fight.battle.id} data={fight} demo onClose={() => setFight(null)} onAgain={start} />
      ) : (
        <>
          <div className="hero" style={{ background: RACE_BG[race] }}>
            <div className="row between">
              <span className="badge">Lv {level}</span>
              <span className="badge">⚔️ {combatPower(me.stats).toLocaleString()} CP</span>
            </div>
            <PetArt race={race} gender={gender} evolution={evolution} size={190} className="art" />
            <div className="name">{RACES[race].stageNames[evolution - 1]}</div>
            <div className="stage">{RACES[race].name} · {ARCHETYPES[arch].label} build</div>
          </div>

          <div className="card">
            <h3>Rasă</h3>
            <div className="race-pick" style={{ marginBottom: 12 }}>
              {RACE_IDS.map((id) => (
                <button key={id} className={id === race ? 'on' : ''} onClick={() => setRace(id)}>
                  <PetArt race={id} gender={gender} evolution={1} size={72} />
                  <div className="display" style={{ fontSize: 15 }}>{RACES[id].name}</div>
                </button>
              ))}
            </div>
            <div className="seg" style={{ marginBottom: 14 }}>
              <button className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>♀ Feminin</button>
              <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>♂ Masculin</button>
            </div>
            <h3>Nivel {level} · Evoluția {evolution}</h3>
            <input id="lvl" type="range" min={1} max={40} value={level} onChange={(e) => setLevel(+e.target.value)} style={{ width: '100%', accentColor: '#ffc94a' }} />
            <p className="small muted" style={{ margin: '4px 0 14px' }}>Nivelul 15 și 30 schimbă forma.</p>
            <h3>Stil de build</h3>
            <div className="grid2">
              {styles.map((a) => (
                <button key={a} className={`btn sm ${a === arch ? 'primary' : ''}`} style={{ boxShadow: 'none' }} onClick={() => setStyle(a)}>
                  {ARCHETYPES[a].label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn primary block" style={{ minHeight: 62, fontSize: 24, fontFamily: 'var(--display)' }} onClick={start}>FIGHT</button>
          <p className="small muted" style={{ textAlign: 'center' }}>Lupta e 100% automată, contra unui adversar aleator de nivel apropiat. Demo fără cont și fără salvare.</p>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><GameProvider><Demo /></GameProvider></StrictMode>,
);

import { useEffect, useRef, useState } from 'react';
import { RACES, SKILLS, ZONE_BY_ID, type BattleEvent } from '@pso/shared';
import { api, type FightResponse } from '../api';
import { useGame } from '../game';
import { PetArt } from './PetArt';

interface Float {
  id: number;
  side: 0 | 1;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'shield';
  dx: number;
}

/** Replays the server's battle log. The client never decides anything here. */
export function BattleReplay({ data, onClose, onAgain, demo }: { data: FightResponse; onClose: () => void; onAgain?: () => void; demo?: boolean }) {
  const { state } = useGame();
  const b = data.battle;
  const you = data.you;
  // Screen side 0 (left) is always "you".
  const sideOf = (idx: 0 | 1): 0 | 1 => (idx === you ? 0 : 1);
  const F = you === 0 ? b.fighters : ([b.fighters[1], b.fighters[0]] as const);
  const maxHp = you === 0 ? [b.summary[0].maxHp, b.summary[1].maxHp] : [b.summary[1].maxHp, b.summary[0].maxHp];

  const [hp, setHp] = useState<[number, number]>([maxHp[0], maxHp[1]]);
  const [shield, setShield] = useState<[number, number]>([0, 0]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [banner, setBanner] = useState<{ text: string; color: string } | null>(null);
  const [anim, setAnim] = useState<[string, string]>(['', '']);
  const [dead, setDead] = useState<[boolean, boolean]>([false, false]);
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState(false);

  const idx = useRef(0);
  const playT = useRef(0);
  const floatId = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const shieldRef = useRef<[number, number]>([0, 0]);

  const hpSwap = (h: [number, number]): [number, number] => (you === 0 ? h : [h[1], h[0]]);

  const apply = (e: BattleEvent, visual: boolean) => {
    const float = (side: 0 | 1, text: string, kind: Float['kind']) => {
      if (!visual) return;
      const id = ++floatId.current;
      setFloats((f) => [...f.slice(-12), { id, side, text, kind, dx: Math.round(Math.random() * 40 - 20) }]);
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
    };
    switch (e.type) {
      case 'hit': {
        const att = sideOf(e.src);
        const def = (1 - att) as 0 | 1;
        setHp(hpSwap(e.hp));
        if (e.absorbed) {
          shieldRef.current[def] = Math.max(0, shieldRef.current[def] - e.absorbed);
          setShield([...shieldRef.current]);
        }
        float(def, `${e.amount}`, e.crit ? 'crit' : 'dmg');
        if (visual) {
          setAnim((a) => {
            const n = [...a] as [string, string];
            n[att] = 'lunge';
            n[def] = 'hurt';
            return n;
          });
          window.setTimeout(() => setAnim(['', '']), 160);
        }
        break;
      }
      case 'skill': {
        const side = sideOf(e.src);
        if (visual && SKILLS[e.skill]) setBanner({ text: `${F[side].name}: ${SKILLS[e.skill].name}!`, color: side === 0 ? 'var(--mint)' : 'var(--coral)' });
        break;
      }
      case 'heal':
        setHp(hpSwap(e.hp));
        float(sideOf(e.src), `+${e.amount}`, 'heal');
        break;
      case 'shield': {
        const side = sideOf(e.src);
        shieldRef.current[side] += e.amount;
        setShield([...shieldRef.current]);
        float(side, `🛡 ${e.amount}`, 'shield');
        break;
      }
      case 'tick':
        setHp(hpSwap(e.hp));
        break;
      case 'phase':
        if (visual) setBanner({ text: e.phase === 'fatigue' ? 'Fatigue — healing reduced' : 'FRENZY — damage doubled!', color: 'var(--gold)' });
        break;
      case 'death': {
        const side = sideOf(e.who);
        setDead((d) => {
          const n = [...d] as [boolean, boolean];
          n[side] = true;
          return n;
        });
        break;
      }
      case 'end':
        window.setTimeout(() => setDone(true), visual ? 700 : 0);
        break;
    }
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      playT.current += (now - last) * speedRef.current;
      last = now;
      while (idx.current < b.events.length && b.events[idx.current].t <= playT.current) {
        apply(b.events[idx.current], true);
        idx.current += 1;
      }
      setT(Math.min(playT.current, b.durationMs));
      if (idx.current < b.events.length) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 1000);
    return () => window.clearTimeout(id);
  }, [banner]);

  const skip = () => {
    while (idx.current < b.events.length) {
      apply(b.events[idx.current], false);
      idx.current += 1;
    }
    playT.current = b.durationMs;
    setT(b.durationMs);
  };

  const zone = state?.pet?.zone ? ZONE_BY_ID[state.pet.zone.zoneId] : null;
  const bg = zone ? `linear-gradient(180deg, ${zone.theme.sky} 0%, ${zone.theme.ground} 100%)` : 'linear-gradient(180deg, #ffb27a 0%, #6b3a6e 60%, #2a1f4a 100%)';

  return (
    <div>
      <div className="arena" style={{ background: bg }}>
        <div className="floor" />
        <span className="timer">{(t / 1000).toFixed(1)}s</span>
        {banner && (
          <div className="skill-banner" style={{ borderColor: banner.color, color: banner.color }}>
            {banner.text}
          </div>
        )}
        {([0, 1] as const).map((side) => {
          const f = F[side];
          const pct = Math.max(0, (hp[side] / maxHp[side]) * 100);
          const sh = Math.min(100, (shield[side] / maxHp[side]) * 100);
          return (
            <div key={side} className={`fighter ${side === 0 ? 'left' : 'right'}`}>
              <div className="hpwrap">
                <div className="fname">
                  {f.name} <span className="small" style={{ opacity: 0.8 }}>Lv{f.level}</span>
                </div>
                <div className="hp">
                  <i className={pct < 30 ? 'low' : ''} style={{ width: `${pct}%` }} />
                  {sh > 0 && <em style={{ width: `${sh}%` }} />}
                </div>
              </div>
              <div className={`sprite ${dead[side] ? 'dead' : anim[side]}`}>
                <PetArt race={f.raceId} gender={f.gender} evolution={f.evolution} size={side === 0 ? 150 : 150} />
              </div>
              {floats
                .filter((x) => x.side === side)
                .map((x) => (
                  <span key={x.id} className={`float ${x.kind === 'crit' ? 'crit' : x.kind}`} style={{ left: `calc(50% + ${x.dx}px)`, top: 70 }}>
                    {x.text}
                    {x.kind === 'crit' && '!'}
                  </span>
                ))}
            </div>
          );
        })}
      </div>

      {!done ? (
        <div className="row">
          <button className="btn" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}>⏩ {speed}x</button>
          <button className="btn block" onClick={skip}>Skip to result</button>
        </div>
      ) : (
        <Result data={data} onClose={onClose} onAgain={onAgain} demo={demo} />
      )}
    </div>
  );
}

function Result({ data, onClose, onAgain, demo }: { data: FightResponse; onClose: () => void; onAgain?: () => void; demo?: boolean }) {
  const { state } = useGame();
  const b = data.battle;
  const you = data.you;
  const opp = (1 - you) as 0 | 1;
  const outcome = b.winner === null ? 'draw' : b.winner === you ? 'win' : 'lose';
  const [verified, setVerified] = useState<boolean | null | undefined>(undefined);
  const S = b.summary;
  const skills = (i: 0 | 1) =>
    Object.entries(S[i].skillsUsed)
      .map(([id, n]) => `${SKILLS[id]?.name ?? id} ×${n}`)
      .join(', ') || '—';

  return (
    <div className="card result">
      <div className={`verdict ${outcome}`}>{outcome === 'win' ? 'VICTORY' : outcome === 'lose' ? 'DEFEAT' : 'DRAW'}</div>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        vs {b.fighters[opp].name} · {RACES[b.fighters[opp].raceId].stageNames[b.fighters[opp].evolution - 1]} Lv{b.fighters[opp].level}
        {b.isBot && !demo ? ' · training dummy' : ''}
      </p>
      {data.rewards && (
        <div className="loot-list" style={{ justifyContent: 'center', marginBottom: 10 }}>
          <span className="loot">🪙 +{data.rewards.gold}</span>
          <span className="loot">✨ +{data.rewards.xp} XP</span>
          <span className="loot">🏆 {data.rewards.rating >= 0 ? '+' : ''}{data.rewards.rating}</span>
        </div>
      )}
      {data.levelUp && (
        <p style={{ color: 'var(--mint)', margin: '0 0 10px' }}>
          ⬆ Level {data.levelUp.to}! +{data.levelUp.points} stat points to spend.
        </p>
      )}
      <div style={{ textAlign: 'left', marginBottom: 10 }}>
        {b.highlights.map((h) => (
          <div key={h} className="small">• {h}</div>
        ))}
      </div>
      <table className="report">
        <tbody>
          <tr>
            <td className="muted"></td>
            <td><b>You</b></td>
            <td><b>{b.fighters[opp].name}</b></td>
          </tr>
          <Row label="Damage dealt" a={S[you].damageDealt} b={S[opp].damageDealt} />
          <Row label="Damage taken" a={S[you].damageTaken} b={S[opp].damageTaken} />
          <Row label="Critical hits" a={S[you].crits} b={S[opp].crits} />
          <Row label="Healing" a={S[you].healing} b={S[opp].healing} />
          <Row label="Shield blocked" a={S[you].shieldAbsorbed} b={S[opp].shieldAbsorbed} />
          <Row label="HP left" a={S[you].hpLeft} b={S[opp].hpLeft} />
        </tbody>
      </table>
      <p className="small muted" style={{ textAlign: 'left' }}>
        Your skills: {skills(you)}
        <br />
        Their skills: {skills(opp)}
      </p>
      {!demo && <button className="btn sm" style={{ marginBottom: 10 }} onClick={async () => setVerified((await api.verify(b.id)).verified)}>
        {verified === undefined ? '🔍 Verify this fight' : verified ? '✅ Verified: server replay matches' : '⚠️ Could not verify'}
      </button>}
      <div className="row">
        <button className="btn block" onClick={onClose}>Back</button>
        {onAgain && (
          <button className="btn primary block" disabled={!demo && (state?.energy.current ?? 0) < 1} onClick={onAgain}>
            {demo ? 'Fight again' : 'Fight again ⚡1'}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <tr>
      <td className="muted">{label}</td>
      <td style={{ color: a > b ? 'var(--gold)' : undefined }}>{a.toLocaleString()}</td>
      <td style={{ color: b > a ? 'var(--gold)' : undefined }}>{b.toLocaleString()}</td>
    </tr>
  );
}

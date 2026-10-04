import { useState } from 'react';
import { ATTRIBUTES, ATTR_KEYS, RACES, SETS, SKILLS, STAT_KEYS, ZONE_BY_ID, type AttrKey, type Attributes } from '@pso/shared';
import { api } from '../api';
import { useGame } from '../game';
import { PetArt } from '../components/PetArt';
import { MAT_GLYPH, RACE_BG, STAT_LABEL, fmtStat, matName } from '../format';

export function PetScreen() {
  const { state, act, loading } = useGame();
  const s = state!;
  const pet = s.pet!;
  const race = RACES[pet.raceId];
  const [pending, setPending] = useState<Partial<Attributes>>({});
  const pendingTotal = Object.values(pending).reduce((a, b) => a + (b ?? 0), 0);
  const left = pet.freePoints - pendingTotal;

  const bump = (k: AttrKey, d: number) =>
    setPending((p) => {
      const v = Math.max(0, (p[k] ?? 0) + d);
      if (d > 0 && left <= 0) return p;
      return { ...p, [k]: v };
    });

  const confirm = async () => {
    const add = Object.fromEntries(Object.entries(pending).filter(([, v]) => v)) as Partial<Attributes>;
    const r = await act(() => api.allocate(add), 'Stronger already!');
    if (r) setPending({});
  };

  const zone = pet.zone ? ZONE_BY_ID[pet.zone.zoneId] : null;
  const req = pet.nextEvolution;
  const canEvolve =
    !!req && pet.level >= req.level && s.gold >= req.gold && Object.entries(req.essence).every(([m, n]) => (s.materials[m] ?? 0) >= n);

  return (
    <>
      <div className="hero" style={{ background: zone ? `linear-gradient(180deg, ${zone.theme.sky}, ${zone.theme.ground})` : RACE_BG[pet.raceId] }}>
        <div className="row between">
          <span className="badge">Lv {pet.level}</span>
          <span className="badge">⚔️ {pet.combatPower.toLocaleString()} CP</span>
        </div>
        <PetArt race={pet.raceId} gender={pet.gender} evolution={pet.evolution} size={200} className="art" />
        <div className="name">{pet.name}</div>
        <div className="stage">
          {pet.stageName} · {race.name} {pet.gender === 'f' ? '♀' : '♂'}
        </div>
        <div className="bar xp" style={{ marginTop: 10 }}>
          <i style={{ width: `${(pet.xp / pet.xpToNext) * 100}%` }} />
        </div>
        <div className="small" style={{ marginTop: 4, color: '#ffffffcc' }}>
          {pet.xp} / {pet.xpToNext} XP
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Build</h3>
          <span className={left > 0 ? 'pill' : 'muted small'} style={left > 0 ? { borderColor: 'var(--mint)', color: 'var(--mint)' } : {}}>
            {left > 0 ? `${left} points to spend` : 'All points spent'}
          </span>
        </div>
        {ATTR_KEYS.map((k) => (
          <div key={k} className="attr">
            <span className="key">{ATTRIBUTES[k].short}</span>
            <span className="small muted" style={{ fontWeight: 600 }}>{ATTRIBUTES[k].description}</span>
            <span className="val">
              {pet.attributes[k]}
              {pending[k] ? <span className="plus"> +{pending[k]}</span> : null}
            </span>
            <button className="btn icon" disabled={!pending[k]} onClick={() => bump(k, -1)} aria-label={`Remove ${k}`}>−</button>
            <button className="btn icon" disabled={left <= 0} onClick={() => bump(k, 1)} aria-label={`Add ${k}`} style={left > 0 ? { borderColor: 'var(--mint)' } : {}}>+</button>
          </div>
        ))}
        {pendingTotal > 0 && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => setPending({})}>Reset</button>
            <button className="btn mint block" disabled={loading} onClick={confirm}>Confirm {pendingTotal} points</button>
          </div>
        )}
        {pendingTotal === 0 && Object.values(pet.attributes).some((v) => v > 0) && (
          <button className="btn sm danger" style={{ marginTop: 10 }} disabled={loading || s.gold < pet.respecCost} onClick={() => confirmRespec(act, pet.respecCost)}>
            Reset all points · 🪙 {pet.respecCost}
          </button>
        )}
      </div>

      <div className="card">
        <h3>Stats</h3>
        <div className="stats">
          {STAT_KEYS.map((k) => (
            <div key={k} className="stat">
              <b>{fmtStat(k, pet.stats[k])}</b>
              <span>{STAT_LABEL[k]}</span>
            </div>
          ))}
        </div>
        {pet.sets.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {pet.sets.map((st) => (
              <div key={st.setId} className="setline">
                ◆ {SETS[st.setId].name} set: {st.count}/6 pieces
              </div>
            ))}
          </div>
        )}
      </div>

      <SkillsCard />

      <div className="card">
        <h3>Evolution</h3>
        <div className="row" style={{ justifyContent: 'space-around', marginBottom: 8 }}>
          {([1, 2, 3] as const).map((e) => (
            <div key={e} style={{ textAlign: 'center', opacity: e <= pet.evolution ? 1 : 0.35, filter: e <= pet.evolution ? 'none' : 'brightness(0)' }}>
              <PetArt race={pet.raceId} gender={pet.gender} evolution={e} size={80} />
              <div className="small">{race.stageNames[e - 1]}</div>
            </div>
          ))}
        </div>
        {req ? (
          <>
            <p className="small muted" style={{ margin: '4px 0 8px' }}>
              Next form needs: Lv {req.level} · 🪙 {req.gold}
              {Object.entries(req.essence).map(([m, n]) => ` · ${MAT_GLYPH[m]} ${n} ${matName(m)} (${s.materials[m] ?? 0})`)}
            </p>
            <button className="btn primary block" disabled={!canEvolve || loading} onClick={() => act(() => api.evolve(), `${pet.name} evolved!`)}>
              {canEvolve ? '✨ Evolve now' : `Evolve at level ${req.level}`}
            </button>
          </>
        ) : (
          <p className="muted small">Final form reached.</p>
        )}
      </div>
    </>
  );
}

function confirmRespec(act: ReturnType<typeof useGame>['act'], cost: number) {
  if (window.confirm(`Reset all stat points for ${cost} gold?`)) act(() => api.respec(), 'Points returned. Build again!');
}

function SkillsCard() {
  const { state, act, loading } = useGame();
  const pet = state!.pet!;
  const choices = RACES[pet.raceId].skillChoices;
  const slotNames = ['Active', 'Passive', 'Ultimate'];
  const pick = (slot: number, id: string) => {
    if (pet.skills[slot] === id) return;
    const next = [...pet.skills];
    next[slot] = id;
    act(() => api.setSkills(next), `${SKILLS[id].name} equipped`);
  };
  return (
    <div className="card">
      <h3>Skills</h3>
      {choices.map((opts, slot) => {
        const locked = slot >= pet.evolution;
        return (
          <div key={slot} style={{ marginBottom: 12, opacity: locked ? 0.5 : 1 }}>
            <div className="small muted" style={{ marginBottom: 6 }}>
              {slotNames[slot]} {locked && `· unlocks at ${RACES[pet.raceId].stageNames[slot]}`}
            </div>
            <div className="grid2">
              {opts.map((id) => (
                <button key={id} className={`skill ${pet.skills[slot] === id ? 'on' : ''}`} disabled={locked || loading} onClick={() => pick(slot, id)}>
                  <div className="nm">{SKILLS[id].name}</div>
                  <p>{SKILLS[id].description}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {pet.battleSkills
        .filter((id) => SKILLS[id]?.kind === 'set')
        .map((id) => (
          <div key={id} className="setline">◆ Set skill active: {SKILLS[id].name} — {SKILLS[id].description}</div>
        ))}
    </div>
  );
}

import { useState } from 'react';
import { ZONES, ZONE_BY_ID, PASSIVE } from '@pso/shared';
import { api, type ZoneCollect } from '../api';
import { useGame } from '../game';
import { PetArt } from '../components/PetArt';
import { MAT_GLYPH, fmtDuration, itemInfo, matName } from '../format';

export function ZoneScreen() {
  const { state, act, loading } = useGame();
  const s = state!;
  const pet = s.pet!;
  const z = pet.zone;
  const cur = z ? ZONE_BY_ID[z.zoneId] : null;
  const [found, setFound] = useState<ZoneCollect | null>(null);
  // Local ticking clock so the bar moves without hammering the server.
  const elapsed = z ? Math.min(PASSIVE.capMs, z.elapsedMs) : 0;

  const collect = async () => {
    const r = await act(() => api.collect());
    if (r) setFound(r);
  };
  const start = async (id: string) => {
    const r = await act(() => api.startZone(id), `${pet.name} heads to ${ZONE_BY_ID[id].name}`);
    if (r?.collected) setFound(r.collected);
  };

  return (
    <>
      {cur && z ? (
        <div className="hero" style={{ background: `linear-gradient(180deg, ${cur.theme.sky}, ${cur.theme.ground})`, textAlign: 'left' }}>
          <div className="row between">
            <div>
              <div className="name" style={{ fontSize: 24 }}>{cur.name}</div>
              <div className="stage">{z.full ? 'Bag is full — collect!' : `Exploring for ${fmtDuration(elapsed)}`}</div>
            </div>
            <PetArt race={pet.raceId} gender={pet.gender} evolution={pet.evolution} size={90} className="art" />
          </div>
          <div className="bar zone" style={{ marginTop: 8 }}>
            <i style={{ width: `${(elapsed / PASSIVE.capMs) * 100}%` }} />
          </div>
          <div className="small" style={{ color: '#ffffffcc', margin: '4px 0 10px' }}>
            Stops filling after {fmtDuration(PASSIVE.capMs)}. Come back to collect.
          </div>
          <button className="btn primary block" disabled={loading || !z.canCollect} onClick={collect}>
            {z.canCollect ? '🎁 Collect' : 'Just started… check back soon'}
          </button>
        </div>
      ) : (
        <div className="card">
          <h3>Send your pet exploring</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Your pet keeps finding gold, ore, essences and gear while you're away. Pick a place below.
          </p>
        </div>
      )}

      {ZONES.map((zone) => {
        const locked = pet.level < zone.level;
        const here = z?.zoneId === zone.id;
        return (
          <button
            key={zone.id}
            className={`zone-card ${locked ? 'locked' : ''} ${here ? 'current' : ''}`}
            style={{ background: `linear-gradient(120deg, ${zone.theme.sky}, ${zone.theme.accent})` }}
            disabled={locked || here || loading}
            onClick={() => start(zone.id)}
          >
            <div className="row between">
              <span className="zn">{zone.name}</span>
              <span className="badge" style={{ color: '#fff' }}>{locked ? `🔒 Lv ${zone.level}` : here ? 'Here now' : 'Go'}</span>
            </div>
            <div className="small" style={{ fontWeight: 700, margin: '4px 0' }}>{zone.description}</div>
            <div className="small" style={{ fontWeight: 800 }}>
              🪙 ~{zone.goldPerHour}/h · {MAT_GLYPH[zone.essence.id]} {matName(zone.essence.id)} · Gear tier {Object.keys(zone.tiers).join('–')} · Risk {zone.variance <= 0.1 ? 'low' : zone.variance <= 0.25 ? 'medium' : zone.variance <= 0.35 ? 'high' : 'very high'}
            </div>
          </button>
        );
      })}

      {found && (
        <div className="scrim" onClick={() => setFound(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="grab" />
            <PetArt race={pet.raceId} gender={pet.gender} evolution={pet.evolution} size={110} />
            <h2 style={{ fontSize: 26, margin: '4px 0' }}>Your pet found something!</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              {fmtDuration(found.elapsedMs)} in {ZONE_BY_ID[found.zoneId].name}
              {found.capped && ' (bag was full)'}
            </p>
            <div className="loot-list" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <span className="loot">🪙 +{found.gold}</span>
              <span className="loot">✨ +{found.xp} XP</span>
              {Object.entries(found.materials).map(([m, n]) => (
                <span key={m} className="loot">
                  {MAT_GLYPH[m]} +{n} {matName(m)}
                </span>
              ))}
              {found.overflowOre > 0 && <span className="loot">⛏️ +{found.overflowOre} (auto-salvaged)</span>}
            </div>
            {found.items.map((it) => {
              const info = itemInfo(it);
              return (
                <div key={it.id} className="item-row" style={{ justifyContent: 'center' }}>
                  <span className="glyph" style={{ color: info.color }}>{info.glyph}</span>
                  <span style={{ color: info.color, fontWeight: 900 }}>{info.name}</span>
                </div>
              );
            })}
            {found.levelUp && <p style={{ color: 'var(--mint)' }}>⬆ Level {found.levelUp.to}!</p>}
            <button className="btn primary block" onClick={() => setFound(null)}>Nice!</button>
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { RACES } from '@pso/shared';
import { api, type FightResponse } from '../api';
import { useGame } from '../game';
import { PetArt } from '../components/PetArt';
import { BattleReplay } from '../components/BattleReplay';
import { fmtDuration } from '../format';

type History = Awaited<ReturnType<typeof api.battles>>['battles'];

export function FightScreen() {
  const { state, act, loading, refresh } = useGame();
  const s = state!;
  const pet = s.pet!;
  const [replay, setReplay] = useState<FightResponse | null>(null);
  const [history, setHistory] = useState<History>([]);

  const loadHistory = () => api.battles().then((r) => setHistory(r.battles)).catch(() => {});
  useEffect(() => {
    loadHistory();
  }, []);

  const fight = async () => {
    const r = await act(() => api.fight());
    if (r) {
      setReplay(r);
      window.scrollTo({ top: 0 });
    }
  };

  if (replay)
    return (
      <BattleReplay
        key={replay.battle.id}
        data={replay}
        onClose={() => {
          setReplay(null);
          loadHistory();
          refresh();
        }}
        onAgain={replay.rewards ? fight : undefined}
      />
    );

  const noEnergy = s.energy.current < 1;
  const total = s.wins + s.losses;

  return (
    <>
      <div className="card fight-hero" style={{ background: 'linear-gradient(170deg, #3b2f6e, #222842)' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 0 }}>
          <PetArt race={pet.raceId} gender={pet.gender} evolution={pet.evolution} size={130} />
          <span className="display" style={{ fontSize: 34, color: 'var(--coral)', margin: '0 6px' }}>VS</span>
          <div style={{ width: 130, height: 143, display: 'grid', placeItems: 'center', fontSize: 64, opacity: 0.5 }}>❔</div>
        </div>
        <div className="big">Arena</div>
        <p className="muted small" style={{ margin: '4px 0 14px' }}>
          Fights are automatic. Your build is your strategy.
        </p>
        <button className="btn primary block" style={{ minHeight: 60, fontSize: 22, fontFamily: 'var(--display)' }} disabled={loading || noEnergy} onClick={fight}>
          {noEnergy ? 'Out of energy' : 'FIGHT  ⚡1'}
        </button>
        <p className="small muted" style={{ marginTop: 8 }}>
          ⚡ {s.energy.current}/{s.energy.max}
          {s.energy.nextAt && ` · +1 in ${fmtDuration(Math.max(60_000, s.energy.nextAt - s.serverTime))}`}
        </p>
      </div>

      <div className="card">
        <div className="grid3">
          <div className="stat"><b>{s.rating}</b><span>Rating</span></div>
          <div className="stat"><b>{s.wins}</b><span>Wins</span></div>
          <div className="stat"><b>{total ? Math.round((s.wins / total) * 100) : 0}%</b><span>Win rate</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Recent fights</h3>
        {history.length === 0 && <p className="muted small">No fights yet. Someone is waiting for you…</p>}
        {history.map((h) => (
          <button key={h.id} className="history-row" onClick={async () => setReplay(await api.battle(h.id))}>
            <span className={`wl ${h.won ? 'w' : 'l'}`}>{h.draw ? '=' : h.won ? 'W' : 'L'}</span>
            <PetArt race={h.opponent.raceId} gender="m" evolution={h.opponent.evolution} size={34} />
            <span style={{ flex: 1 }}>
              {h.opponent.name} <span className="small muted">Lv{h.opponent.level} {RACES[h.opponent.raceId].name}</span>
              {h.defended && <span className="small muted"> · attacked you</span>}
            </span>
            <span className="small" style={{ color: h.ratingDelta >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
              {h.ratingDelta >= 0 ? '+' : ''}{h.ratingDelta}
            </span>
            <span className="small muted">▶</span>
          </button>
        ))}
      </div>
    </>
  );
}

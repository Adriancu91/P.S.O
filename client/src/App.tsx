import { useEffect, useState } from 'react';
import { api } from './api';
import { useGame, type Screen } from './game';
import { MAT_GLYPH, matName } from './format';
import { Auth } from './screens/Auth';
import { CreatePet } from './screens/CreatePet';
import { PetScreen } from './screens/PetScreen';
import { GearScreen } from './screens/GearScreen';
import { FightScreen } from './screens/FightScreen';
import { ZoneScreen } from './screens/ZoneScreen';

export function App() {
  const { loggedIn, state } = useGame();
  if (!loggedIn) return <Auth />;
  if (!state) return <div className="center-screen"><div className="big-logo">P.S.O.</div></div>;
  if (!state.pet) return <CreatePet />;
  return <Shell />;
}

function Shell() {
  const { state, screen, go, logout } = useGame();
  const [menu, setMenu] = useState(false);
  const s = state!;
  const pet = s.pet!;
  const zoneReady = !!pet.zone?.canCollect;

  return (
    <div className="app">
      <header className="topbar">
        <button className="logo" style={{ background: 'none' }} onClick={() => setMenu((m) => !m)}>
          P.S.O.
        </button>
        <span className="pill" title="Gold">🪙 {s.gold.toLocaleString()}</span>
        <span className="pill" title="Ore">{MAT_GLYPH.ore} {s.materials.ore ?? 0}</span>
        <span className="pill" title="Energy">⚡ {s.energy.current}/{s.energy.max}</span>
      </header>
      {menu && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className="muted">Signed in as <b style={{ color: 'var(--text)' }}>{s.user.username}</b></span>
            <button className="btn sm danger" onClick={logout}>Log out</button>
          </div>
          <div className="grid3">
            <div className="stat"><b>{s.rating}</b><span>Rating</span></div>
            <div className="stat"><b>{s.wins}</b><span>Wins</span></div>
            <div className="stat"><b>{s.losses}</b><span>Losses</span></div>
          </div>
          <div className="loot-list" style={{ marginTop: 10 }}>
            {Object.entries(s.materials).map(([k, v]) => (
              <span key={k} className="loot">{MAT_GLYPH[k]} {matName(k)} × {v}</span>
            ))}
          </div>
        </div>
      )}

      <MissionBanner />

      {screen === 'pet' && <PetScreen />}
      {screen === 'gear' && <GearScreen />}
      {screen === 'fight' && <FightScreen />}
      {screen === 'zone' && <ZoneScreen />}

      <nav className="nav">
        <div className="nav-inner">
          <NavBtn id="pet" icon="🐾" label="Pet" cur={screen} go={go} dot={pet.freePoints > 0} />
          <NavBtn id="gear" icon="🎒" label="Gear" cur={screen} go={go} />
          <button className={`fight-btn ${screen === 'fight' ? 'active' : ''}`} onClick={() => go('fight')}>
            <span className="bubble">FIGHT</span>
          </button>
          <NavBtn id="zone" icon="🗺️" label="Explore" cur={screen} go={go} dot={zoneReady && !!pet.zone?.full} />
          <button className={menu ? 'active' : ''} onClick={() => { setMenu((m) => !m); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            {s.mission?.done && <span className="dot" />}
            <span className="ico">👤</span>
            Me
          </button>
        </div>
      </nav>
    </div>
  );
}

function NavBtn({ id, icon, label, cur, go, dot }: { id: Screen; icon: string; label: string; cur: Screen; go: (s: Screen) => void; dot?: boolean }) {
  return (
    <button className={cur === id ? 'active' : ''} onClick={() => { go(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
      {dot && <span className="dot" />}
      <span className="ico">{icon}</span>
      {label}
    </button>
  );
}

function MissionBanner() {
  const { state, go, act, toast } = useGame();
  const m = state?.mission;
  // "open_pet" is the only purely-UI event the client reports.
  useEffect(() => {
    if (m?.id === 'd1' && !m.done) api.missionEvent('open_pet').then(() => {}).catch(() => {});
  }, [m?.id, m?.done]);
  if (!m) return null;
  const claim = async () => {
    const r = await act(() => api.claimMission());
    if (r) toast(`Mission complete! ${rewardText(m.reward)}`);
  };
  return (
    <button className={`mission ${m.done ? 'done' : ''}`} onClick={() => (m.done ? claim() : go(m.screen))}>
      <span className="star">{m.done ? '🎁' : '⭐'}</span>
      <span style={{ flex: 1 }}>
        <span className="title">{m.title}</span>
        <br />
        <span className="small muted" style={{ color: '#d9d3ff' }}>
          {m.done ? `Tap to claim · ${rewardText(m.reward)}` : m.hint}
          {!m.done && m.count > 1 && ` · ${m.progress}/${m.count}`}
        </span>
      </span>
      <span className="small muted">{m.number}/{m.total}</span>
    </button>
  );
}

function rewardText(r: { gold?: number; xp?: number; ore?: number; item?: unknown }) {
  return [r.gold && `🪙 ${r.gold}`, r.ore && `⛏️ ${r.ore}`, r.xp && `✨ ${r.xp} XP`, r.item && '🎁 item'].filter(Boolean).join('  ');
}

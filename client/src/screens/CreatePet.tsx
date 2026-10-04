import { useState } from 'react';
import { RACES, RACE_IDS, type Gender, type RaceId } from '@pso/shared';
import { api } from '../api';
import { useGame } from '../game';
import { PetArt } from '../components/PetArt';
import { RACE_BG } from '../format';

export function CreatePet() {
  const { act } = useGame();
  const [race, setRace] = useState<RaceId>('vexa');
  const [gender, setGender] = useState<Gender>('f');
  const [name, setName] = useState('');
  const r = RACES[race];

  return (
    <div className="app" style={{ paddingTop: 16 }}>
      <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>Choose your pet</h2>

      <div className="hero" style={{ background: RACE_BG[race] }}>
        <PetArt race={race} gender={gender} evolution={1} size={170} className="art" />
        <div className="name">{r.name}</div>
        <div className="stage">{r.tagline}</div>
      </div>

      <div className="race-pick" style={{ marginBottom: 12 }}>
        {RACE_IDS.map((id) => (
          <button key={id} className={id === race ? 'on' : ''} onClick={() => setRace(id)}>
            <PetArt race={id} gender={gender} evolution={1} size={84} />
            <div className="display" style={{ fontSize: 16 }}>{RACES[id].name}</div>
            <div className="small muted">{RACES[id].animal}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <p style={{ margin: '0 0 10px', fontWeight: 600 }}>{r.personality}</p>
        <div className="grid2 small">
          <div>
            {r.strengths.map((s) => (
              <div key={s} style={{ color: 'var(--mint)' }}>▲ {s}</div>
            ))}
          </div>
          <div>
            {r.weaknesses.map((s) => (
              <div key={s} style={{ color: '#ff8fa0' }}>▼ {s}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>♀ Female</button>
        <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>♂ Male</button>
      </div>

      <input className="field" maxLength={16} placeholder="Name your pet" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn primary block" disabled={name.trim().length < 2} onClick={async () => { await act(() => api.createPet(name.trim(), race, gender), `${name.trim()} is ready!`); window.scrollTo({ top: 0 }); }}>
        Hatch {name.trim() || 'your pet'}
      </button>
      <p className="small muted" style={{ textAlign: 'center' }}>Gender changes only how your pet looks — never its power.</p>
    </div>
  );
}

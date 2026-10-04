import { useState } from 'react';
import { api } from '../api';
import { useGame } from '../game';
import { PetArt } from '../components/PetArt';

export function Auth() {
  const { onLogin, toast } = useGame();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
      onLogin(r.token);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app center-screen">
      <div className="row" style={{ justifyContent: 'center', gap: 0, marginBottom: -8 }}>
        <PetArt race="vexa" gender="f" evolution={2} size={110} />
        <PetArt race="tuskar" gender="m" evolution={3} size={130} />
        <PetArt race="hoolu" gender="m" evolution={2} size={110} />
      </div>
      <div className="big-logo">P.S.O.</div>
      <p className="muted" style={{ textAlign: 'center', margin: '6px 0 24px', letterSpacing: 2 }}>PET STRIKE ONLINE</p>
      <form onSubmit={submit}>
        <div className="seg" style={{ marginBottom: 12 }}>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>New player</button>
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>I have an account</button>
        </div>
        <input className="field" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          className="field"
          placeholder="Password (8+ characters)"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn primary block" disabled={busy || !username || !password}>
          {mode === 'login' ? 'Enter the arena' : 'Start playing'}
        </button>
      </form>
    </div>
  );
}

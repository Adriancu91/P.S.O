import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken, type GameState } from './api';

export type Screen = 'pet' | 'gear' | 'fight' | 'zone';

interface GameCtx {
  state: GameState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Run a server action, show errors as toast, refresh state after. */
  act: <T>(fn: () => Promise<T>, okMsg?: string) => Promise<T | undefined>;
  toast: (msg: string, error?: boolean) => void;
  screen: Screen;
  go: (s: Screen) => void;
  loggedIn: boolean;
  onLogin: (token: string) => void;
  logout: () => void;
}

const Ctx = createContext<GameCtx>(null as never);
export const useGame = () => useContext(Ctx);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [screen, setScreen] = useState<Screen>('pet');
  const [toastMsg, setToastMsg] = useState<{ msg: string; error: boolean } | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((msg: string, error = false) => {
    setToastMsg({ msg, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setToken(null);
    setState(null);
    setLoggedIn(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setLoggedIn(false);
        setState(null);
      } else toast('Connection problem. Retrying…', true);
    }
  }, [toast]);

  const act = useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string) => {
      setLoading(true);
      try {
        const r = await fn();
        if (okMsg) toast(okMsg);
        await refresh();
        return r;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong', true);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [refresh, toast],
  );

  useEffect(() => {
    if (loggedIn) refresh();
  }, [loggedIn, refresh]);

  // Keep timers (energy, zone) fresh while the app is open.
  useEffect(() => {
    if (!loggedIn) return;
    const id = window.setInterval(refresh, 30_000);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loggedIn, refresh]);

  const onLogin = (token: string) => {
    setToken(token);
    setLoggedIn(true);
    setScreen('pet');
  };

  return (
    <Ctx.Provider value={{ state, loading, refresh, act, toast, screen, go: setScreen, loggedIn, onLogin, logout }}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.error ? 'error' : ''}`}>{toastMsg.msg}</div>}
    </Ctx.Provider>
  );
}

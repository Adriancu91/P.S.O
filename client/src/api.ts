import type {
  Attributes,
  BattleEvent,
  Evolution,
  FighterSnapshot,
  FighterSummary,
  Gender,
  ItemInstance,
  MissionDef,
  RaceId,
  Stats,
} from '@pso/shared';

export interface GameItem extends ItemInstance {
  equipped: boolean;
  slot: string;
  upgradeCost: { gold: number; ore: number } | null;
}

export interface MissionView {
  id: string;
  title: string;
  hint: string;
  screen: MissionDef['screen'];
  progress: number;
  count: number;
  done: boolean;
  reward: MissionDef['reward'];
  number: number;
  total: number;
}

export interface PetView {
  id: string;
  name: string;
  raceId: RaceId;
  gender: Gender;
  level: number;
  xp: number;
  xpToNext: number;
  evolution: Evolution;
  stageName: string;
  attributes: Attributes;
  freePoints: number;
  skills: string[];
  battleSkills: string[];
  sets: { setId: string; count: number }[];
  stats: Stats;
  combatPower: number;
  respecCost: number;
  nextEvolution: { level: number; gold: number; essence: Record<string, number> } | null;
  zone: { zoneId: string; since: number; elapsedMs: number; capMs: number; full: boolean; canCollect: boolean } | null;
}

export interface GameState {
  user: { id: string; username: string };
  gold: number;
  rating: number;
  wins: number;
  losses: number;
  energy: { current: number; max: number; nextAt: number | null };
  materials: Record<string, number>;
  items: GameItem[];
  mission: MissionView | null;
  serverTime: number;
  pet: PetView | null;
}

export interface BattleView {
  id: string;
  fighters: [FighterSnapshot, FighterSnapshot];
  isBot: boolean;
  seed: string;
  engineVersion: string;
  winner: 0 | 1 | null;
  reason: 'ko' | 'timeout' | 'draw';
  durationMs: number;
  summary: [FighterSummary, FighterSummary];
  events: BattleEvent[];
  highlights: string[];
}

export interface FightResponse {
  battle: BattleView;
  you: 0 | 1;
  rewards: { gold: number; xp: number; rating: number } | null;
  levelUp?: { from: number; to: number; points: number } | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'pso.token';
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session-only login */
  }
};

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  // Each mutation gets a unique key so a network retry can never apply twice.
  if (method === 'POST') headers['idempotency-key'] = crypto.randomUUID();
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Something went wrong');
  return data as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<{ token: string }>('POST', '/auth/register', { username, password }),
  login: (username: string, password: string) => request<{ token: string }>('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request<GameState>('GET', '/me'),
  createPet: (name: string, race: RaceId, gender: Gender) => request('POST', '/pet', { name, race, gender }),
  allocate: (add: Partial<Attributes>) => request('POST', '/pet/allocate', { add }),
  respec: () => request('POST', '/pet/respec'),
  setSkills: (skills: string[]) => request('POST', '/pet/skills', { skills }),
  evolve: () => request<{ evolution: number; stageName: string }>('POST', '/pet/evolve'),
  equip: (id: string) => request('POST', `/items/${id}/equip`),
  unequip: (id: string) => request('POST', `/items/${id}/unequip`),
  upgrade: (id: string) => request<{ upgrade: number }>('POST', `/items/${id}/upgrade`),
  salvage: (id: string) => request<{ ore: number }>('POST', `/items/${id}/salvage`),
  startZone: (zoneId: string) => request<{ collected: ZoneCollect | null }>('POST', '/zone/start', { zoneId }),
  collect: () => request<ZoneCollect>('POST', '/zone/collect'),
  fight: () => request<FightResponse>('POST', '/battle/fight'),
  battles: () =>
    request<{
      battles: {
        id: string;
        won: boolean;
        draw: boolean;
        defended: boolean;
        opponent: { name: string; raceId: RaceId; level: number; evolution: Evolution };
        ratingDelta: number;
        at: number;
      }[];
    }>('GET', '/battles'),
  battle: (id: string) => request<FightResponse>('GET', `/battle/${id}`),
  verify: (id: string) => request<{ verified: boolean | null }>('GET', `/battle/${id}/verify`),
  claimMission: () => request<{ claimed: string; item: ItemInstance | null; levelUp: unknown }>('POST', '/missions/claim'),
  missionEvent: (event: string) => request('POST', '/missions/event', { event }),
};

export interface ZoneCollect {
  zoneId: string;
  elapsedMs: number;
  capped: boolean;
  gold: number;
  xp: number;
  materials: Record<string, number>;
  items: ItemInstance[];
  overflowOre: number;
  levelUp: { from: number; to: number; points: number } | null;
}

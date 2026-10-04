// Discovery missions: one active at a time, teach by doing.
// Principle: DO -> SEE -> DISCOVER. The text hints, it doesn't explain.

export type MissionEvent =
  | 'open_pet'
  | 'allocate_points'
  | 'fight'
  | 'win'
  | 'zone_start'
  | 'zone_collect'
  | 'equip'
  | 'equip_bonus_item'
  | 'upgrade'
  | 'salvage'
  | 'level'
  | 'choose_skill'
  | 'evolve';

export interface MissionDef {
  id: string;
  title: string;
  hint: string;
  event: MissionEvent;
  /** For 'level' this is the level to reach; otherwise number of times. */
  count: number;
  /** Which screen the hint points to. */
  screen: 'pet' | 'gear' | 'fight' | 'zone';
  reward: { gold?: number; xp?: number; ore?: number; item?: { tier: 1 | 2; rarity: 'uncommon' | 'rare' | 'epic' } };
}

export const DISCOVERY_MISSIONS: MissionDef[] = [
  {
    id: 'd1',
    title: 'Your pet is waiting.',
    hint: 'Go say hi.',
    event: 'open_pet',
    count: 1,
    screen: 'pet',
    reward: { gold: 50 },
  },
  {
    id: 'd2',
    title: 'Choose your strength.',
    hint: 'Your pet has points to spend.',
    event: 'allocate_points',
    count: 1,
    screen: 'pet',
    reward: { gold: 50, xp: 20 },
  },
  {
    id: 'd3',
    title: 'Someone is waiting for you.',
    hint: 'The arena is open.',
    event: 'fight',
    count: 1,
    screen: 'fight',
    reward: { gold: 80, item: { tier: 1, rarity: 'uncommon' } },
  },
  {
    id: 'd4',
    title: 'Your equipment needs attention.',
    hint: 'Something new is in your bag.',
    event: 'equip',
    count: 1,
    screen: 'gear',
    reward: { gold: 60, ore: 6 },
  },
  {
    id: 'd5',
    title: 'Your pet wants to explore.',
    hint: 'Send it somewhere. It keeps working when you leave.',
    event: 'zone_start',
    count: 1,
    screen: 'zone',
    reward: { gold: 60 },
  },
  {
    id: 'd6',
    title: 'Make it sharper.',
    hint: 'Gear can grow too.',
    event: 'upgrade',
    count: 1,
    screen: 'gear',
    reward: { gold: 100, ore: 6 },
  },
  {
    id: 'd7',
    title: 'Your pet can become stronger.',
    hint: 'Fights and exploring bring experience.',
    event: 'level',
    count: 3,
    screen: 'fight',
    reward: { gold: 120, item: { tier: 1, rarity: 'rare' } },
  },
  {
    id: 'd8',
    title: 'This item is different…',
    hint: 'Look closer at the colored lines.',
    event: 'equip_bonus_item',
    count: 1,
    screen: 'gear',
    reward: { gold: 120 },
  },
  {
    id: 'd9',
    title: 'Your pet found something.',
    hint: 'Come back later and collect.',
    event: 'zone_collect',
    count: 1,
    screen: 'zone',
    reward: { gold: 100, ore: 8 },
  },
  {
    id: 'd10',
    title: 'Prove it.',
    hint: 'Win three times.',
    event: 'win',
    count: 3,
    screen: 'fight',
    reward: { gold: 250, item: { tier: 2, rarity: 'rare' } },
  },
  {
    id: 'd11',
    title: 'Nothing is wasted.',
    hint: 'Old gear hides ore.',
    event: 'salvage',
    count: 1,
    screen: 'gear',
    reward: { ore: 15 },
  },
  {
    id: 'd12',
    title: 'Something is changing…',
    hint: 'Reach level 15.',
    event: 'level',
    count: 15,
    screen: 'fight',
    reward: { gold: 500 },
  },
  {
    id: 'd13',
    title: 'A new form.',
    hint: 'Your pet is ready to evolve.',
    event: 'evolve',
    count: 1,
    screen: 'pet',
    reward: { gold: 800, item: { tier: 2, rarity: 'epic' } },
  },
];

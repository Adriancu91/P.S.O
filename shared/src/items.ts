import { BONUS_POOL, ITEM_BASES, NON_SCALING_STATS, RARITY, SETS, TIERS, UPGRADE } from './config/items.js';
import type { Rng } from './rng.js';
import type { ItemInstance, Modifier, Rarity, Slot, StatKey } from './types.js';

export interface ItemTemplate {
  id: string;
  baseId: string;
  slot: Slot;
  tier: 1 | 2 | 3 | 4;
  name: string;
  levelReq: number;
  evolutionReq: number;
}

const TEMPLATES: Record<string, ItemTemplate> = {};
for (const base of ITEM_BASES) {
  for (const t of TIERS) {
    const id = `${base.id}_t${t.tier}`;
    TEMPLATES[id] = {
      id,
      baseId: base.id,
      slot: base.slot,
      tier: t.tier,
      name: `${t.prefix} ${base.name}`,
      levelReq: t.level,
      evolutionReq: t.evolution,
    };
  }
}

export function getTemplate(templateId: string): ItemTemplate {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`Unknown item template: ${templateId}`);
  return t;
}

export function allTemplates(): ItemTemplate[] {
  return Object.values(TEMPLATES);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The base (non-random) stats of an item after tier, rarity and upgrade. */
export function itemBaseStats(item: Pick<ItemInstance, 'templateId' | 'rarity' | 'upgrade'>): Modifier[] {
  const tpl = getTemplate(item.templateId);
  const base = ITEM_BASES.find((b) => b.id === tpl.baseId)!;
  const tierMult = TIERS[tpl.tier - 1].mult;
  const rarityMult = RARITY[item.rarity].mult;
  const upMult = 1 + UPGRADE.perLevel * item.upgrade;
  return (Object.entries(base.stats) as [StatKey, number][]).map(([stat, v]) => {
    const scale = NON_SCALING_STATS.includes(stat) ? 1 : tierMult;
    return { stat, mode: 'flat' as const, value: round1(v * scale * rarityMult * upMult) };
  });
}

/** All modifiers an item gives: base stats + random bonuses. */
export function itemModifiers(item: ItemInstance): Modifier[] {
  return [...itemBaseStats(item), ...item.bonuses];
}

export function rollBonuses(rng: Rng, rarity: Rarity, tier: number): Modifier[] {
  const r = RARITY[rarity];
  const pool = [...BONUS_POOL];
  const out: Modifier[] = [];
  for (let i = 0; i < r.bonuses && pool.length; i++) {
    const idx = Math.floor(rng.next() * pool.length);
    const b = pool.splice(idx, 1)[0];
    const quality = r.rollMin + (1 - r.rollMin) * rng.next();
    let value = b.min + (b.max - b.min) * quality;
    if (b.scales) value *= TIERS[tier - 1].mult;
    out.push({ stat: b.stat, mode: b.mode, value: b.mode === 'pct' ? Math.round(value) : round1(value) });
  }
  return out;
}

export interface GenerateItemOptions {
  tier: 1 | 2 | 3 | 4;
  rarity: Rarity;
  slot?: Slot;
  baseId?: string;
  setId?: string | null;
}

/** Deterministic for a given rng state. The id is assigned by the server. */
export function generateItem(rng: Rng, id: string, opts: GenerateItemOptions): ItemInstance {
  const bases = ITEM_BASES.filter((b) => (opts.slot ? b.slot === opts.slot : true));
  const base = opts.baseId ? ITEM_BASES.find((b) => b.id === opts.baseId)! : rng.pick(bases);
  return {
    id,
    templateId: `${base.id}_t${opts.tier}`,
    rarity: opts.rarity,
    upgrade: 0,
    bonuses: rollBonuses(rng, opts.rarity, opts.tier),
    setId: opts.setId ?? null,
  };
}

export function upgradeCost(item: ItemInstance): { gold: number; ore: number } | null {
  if (item.upgrade >= UPGRADE.max) return null;
  return UPGRADE.cost(item.upgrade, getTemplate(item.templateId).tier);
}

export function salvageValue(item: ItemInstance): { ore: number } {
  const tier = getTemplate(item.templateId).tier;
  return { ore: RARITY[item.rarity].salvageOre * tier + item.upgrade * tier };
}

export function itemDisplayName(item: ItemInstance): string {
  const tpl = getTemplate(item.templateId);
  const set = item.setId ? SETS[item.setId]?.name + ' ' : '';
  const up = item.upgrade > 0 ? ` +${item.upgrade}` : '';
  return `${set}${tpl.name}${up}`;
}

import { MATERIALS, RARITY, SETS, getTemplate, itemBaseStats, type ItemInstance, type Modifier, type StatKey } from '@pso/shared';

export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP',
  patk: 'Phys Atk',
  matk: 'Magic Atk',
  pdef: 'Phys Def',
  mdef: 'Magic Def',
  aspd: 'Atk Speed',
  critChance: 'Crit',
  critDmg: 'Crit Dmg',
  regen: 'Regen',
};

export function fmtStat(k: StatKey, v: number): string {
  if (k === 'critChance') return `${round(v)}%`;
  if (k === 'critDmg') return `${round(v)}%`;
  if (k === 'aspd') return `${(v / 100).toFixed(2)}/s`;
  if (k === 'regen') return `${round(v)}/s`;
  return `${Math.round(v)}`;
}

const round = (v: number) => (Math.round(v * 10) / 10).toString();

export function fmtMod(m: Modifier): string {
  const label = STAT_LABEL[m.stat];
  if (m.mode === 'pct') return `+${m.value}% ${label}`;
  if (m.stat === 'critChance' || m.stat === 'critDmg') return `+${round(m.value)}% ${label}`;
  if (m.stat === 'aspd') return `+${round(m.value)}% ${label}`;
  return `+${round(m.value)} ${label}`;
}

export const SLOT_GLYPH: Record<string, string> = {
  weapon: '🗡️',
  armor: '🛡️',
  helmet: '⛑️',
  boots: '🥾',
  ring: '💍',
  charm: '🧿',
};

export const BASE_GLYPH: Record<string, string> = {
  claw: '🗡️',
  orb: '🔮',
  plate: '🛡️',
  robe: '🥋',
  helm: '⛑️',
  hood: '🎩',
  treads: '🥾',
  sandals: '🩴',
  fang_ring: '💍',
  sage_ring: '💠',
  leaf_charm: '🍃',
  tooth_charm: '🦷',
};

export function itemInfo(item: ItemInstance) {
  const tpl = getTemplate(item.templateId);
  return {
    tpl,
    name: `${item.setId ? SETS[item.setId].name + ' ' : ''}${tpl.name}`,
    color: RARITY[item.rarity].color,
    glyph: BASE_GLYPH[tpl.baseId] ?? SLOT_GLYPH[tpl.slot],
    base: itemBaseStats(item),
  };
}

export const MAT_GLYPH: Record<string, string> = { ore: '⛏️', sap: '🌿', glass: '🔶', frost: '❄️', ember: '🔥' };
export const matName = (id: string) => MATERIALS[id]?.name ?? id;

export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export const RACE_BG: Record<string, string> = {
  tuskar: 'linear-gradient(170deg, #ffb27a 0%, #c46a3b 60%, #6e3a24 100%)',
  vexa: 'linear-gradient(170deg, #ffd08a 0%, #ff8a5c 55%, #7a3550 100%)',
  hoolu: 'linear-gradient(170deg, #b8c4ff 0%, #6f6ad8 55%, #2c2a6b 100%)',
};

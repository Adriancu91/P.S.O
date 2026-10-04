import { useState } from 'react';
import { INVENTORY_LIMIT, RARITY, SETS, SLOTS, canEquip, salvageValue } from '@pso/shared';
import { api, type GameItem } from '../api';
import { useGame } from '../game';
import { MAT_GLYPH, SLOT_GLYPH, fmtMod, itemInfo } from '../format';

export function GearScreen() {
  const { state } = useGame();
  const s = state!;
  const [open, setOpen] = useState<GameItem | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const equipped = Object.fromEntries(s.items.filter((i) => i.equipped).map((i) => [i.slot, i]));
  const bag = s.items.filter((i) => !i.equipped && (filter === 'all' || i.slot === filter));
  const current = open ? s.items.find((i) => i.id === open.id) ?? null : null;

  return (
    <>
      <div className="card">
        <h3>Equipped</h3>
        <div className="slots">
          {SLOTS.map((slot) => {
            const it = equipped[slot];
            if (!it)
              return (
                <button key={slot} className="slot" onClick={() => setFilter(slot)}>
                  <span className="glyph" style={{ opacity: 0.3 }}>{SLOT_GLYPH[slot]}</span>
                  {slot}
                </button>
              );
            const info = itemInfo(it);
            return (
              <button key={slot} className="slot filled" style={{ borderColor: info.color, color: 'var(--text)' }} onClick={() => setOpen(it)}>
                {it.upgrade > 0 && <span className="up">+{it.upgrade}</span>}
                <span className="glyph">{info.glyph}</span>
                <span style={{ fontSize: 11, color: info.color }}>{info.tpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Bag</h3>
          <span className="small muted">{s.items.length}/{INVENTORY_LIMIT}</span>
        </div>
        <div className="row" style={{ overflowX: 'auto', gap: 6, marginBottom: 10, paddingBottom: 2 }}>
          {['all', ...SLOTS].map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} style={{ boxShadow: 'none' }} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : SLOT_GLYPH[f]}
            </button>
          ))}
        </div>
        {bag.length === 0 && <p className="muted small">Nothing here yet. Fight, explore and finish missions to find gear.</p>}
        {bag.map((it) => (
          <ItemRow key={it.id} item={it} onClick={() => setOpen(it)} compareTo={equipped[it.slot]} />
        ))}
      </div>

      {current && <ItemSheet item={current} equippedInSlot={equipped[current.slot]} onClose={() => setOpen(null)} />}
    </>
  );
}

function ItemRow({ item, onClick, compareTo }: { item: GameItem; onClick: () => void; compareTo?: GameItem }) {
  const info = itemInfo(item);
  const { state } = useGame();
  const pet = state!.pet!;
  const err = canEquip(pet.level, pet.evolution, item);
  return (
    <button className="item-row" onClick={onClick}>
      <span className="glyph" style={{ color: info.color }}>{info.glyph}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: info.color, fontWeight: 900 }}>
          {info.name}
          {item.upgrade > 0 && ` +${item.upgrade}`}
        </span>
        <br />
        <span className="small muted">
          {info.base.map(fmtMod).join(' · ')}
          {item.bonuses.length > 0 && <span className="bonus"> · {item.bonuses.length} bonus{item.bonuses.length > 1 ? 'es' : ''}</span>}
        </span>
        {err && <span className="small" style={{ color: '#ff8fa0', display: 'block' }}>{err}</span>}
      </span>
      {!compareTo && !err && <span className="pill" style={{ fontSize: 11, borderColor: 'var(--mint)', color: 'var(--mint)' }}>Empty slot</span>}
    </button>
  );
}

function ItemSheet({ item, equippedInSlot, onClose }: { item: GameItem; equippedInSlot?: GameItem; onClose: () => void }) {
  const { state, act, loading } = useGame();
  const s = state!;
  const pet = s.pet!;
  const info = itemInfo(item);
  const err = canEquip(pet.level, pet.evolution, item);
  const cost = item.upgradeCost;
  const canUp = !!cost && s.gold >= cost.gold && (s.materials.ore ?? 0) >= cost.ore;
  const set = item.setId ? SETS[item.setId] : null;
  const setCount = set ? pet.sets.find((x) => x.setId === set.id)?.count ?? 0 : 0;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="glyph" style={{ fontSize: 40, width: 64, height: 64, display: 'grid', placeItems: 'center', borderRadius: 16, border: `3px solid ${info.color}`, background: 'var(--ink-2)' }}>
            {info.glyph}
          </span>
          <div>
            <h2 style={{ fontSize: 22, color: info.color }}>
              {info.name}
              {item.upgrade > 0 && ` +${item.upgrade}`}
            </h2>
            <div className="small muted">
              {item.rarity[0].toUpperCase() + item.rarity.slice(1)} · Tier {info.tpl.tier} · {info.tpl.slot}
              {info.tpl.levelReq > 1 && ` · Lv ${info.tpl.levelReq}`}
              {info.tpl.evolutionReq > 1 && ` · Evo ${info.tpl.evolutionReq}`}
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--ink-2)' }}>
          {info.base.map((m) => (
            <div key={m.stat}>{fmtMod(m)}</div>
          ))}
          {item.bonuses.map((m) => (
            <div key={m.stat} className="bonus">✦ {fmtMod(m)}</div>
          ))}
          {item.bonuses.length === 0 && RARITY[item.rarity].bonuses === 0 && (
            <div className="small muted" style={{ marginTop: 6 }}>Common items have no random bonuses. Look for green, blue, purple and gold.</div>
          )}
          {set && (
            <div style={{ marginTop: 8 }}>
              <div className="setline">◆ {set.name} set ({setCount}/6 equipped)</div>
              {set.pieces.map((p) => (
                <div key={p.count} className="small" style={{ color: setCount >= p.count ? 'var(--gold)' : 'var(--muted)' }}>
                  {p.count} pieces: {p.mods.map(fmtMod).join(', ')}
                  {p.skill && 'Set skill unlocked'}
                </div>
              ))}
            </div>
          )}
        </div>

        {equippedInSlot && equippedInSlot.id !== item.id && (
          <p className="small muted">Replaces: {itemInfo(equippedInSlot).name}{equippedInSlot.upgrade ? ` +${equippedInSlot.upgrade}` : ''}</p>
        )}

        <div className="grid2" style={{ marginBottom: 8 }}>
          {item.equipped ? (
            <button className="btn" disabled={loading} onClick={() => act(() => api.unequip(item.id))}>Unequip</button>
          ) : (
            <button className="btn mint" disabled={loading || !!err} onClick={async () => { if (await act(() => api.equip(item.id), 'Equipped')) onClose(); }}>
              {err ?? 'Equip'}
            </button>
          )}
          <button className="btn primary" disabled={loading || !canUp} onClick={() => act(() => api.upgrade(item.id), `Upgraded to +${item.upgrade + 1}!`)}>
            {cost ? (
              <>⬆ +{item.upgrade + 1} · 🪙{cost.gold} {MAT_GLYPH.ore}{cost.ore}</>
            ) : (
              'Max level'
            )}
          </button>
        </div>
        {!item.equipped && (
          <button
            className="btn danger block"
            disabled={loading}
            onClick={async () => {
              if (window.confirm(`Salvage ${info.name} for ${salvageValue(item).ore} ore? This destroys it.`)) {
                if (await act(() => api.salvage(item.id), `+${salvageValue(item).ore} ore`)) onClose();
              }
            }}
          >
            Salvage for {MAT_GLYPH.ore} {salvageValue(item).ore}
          </button>
        )}
      </div>
    </div>
  );
}

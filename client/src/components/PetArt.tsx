import type { Evolution, Gender, RaceId } from '@pso/shared';
import type { ReactNode } from 'react';

// Hand-built SVG characters: 3 races x 2 genders x 3 evolutions = 18 variants.
// Bold outlines + simple shapes: readable at thumbnail size, easy to animate,
// and simple enough to become a physical figure one day.

const INK = '#1b1430';
const SW = 3;

interface Palette {
  fur: string;
  dark: string;
  light: string;
  accent: string;
  extra: string;
}

const PALETTES: Record<RaceId, Record<Gender, Palette>> = {
  tuskar: {
    m: { fur: '#b5653a', dark: '#7a3f22', light: '#ecc09a', accent: '#e9a38f', extra: '#fff6e0' },
    f: { fur: '#cf8a5f', dark: '#94502f', light: '#f6d3b2', accent: '#f2b0a0', extra: '#ff7aa8' },
  },
  vexa: {
    m: { fur: '#ff8a3d', dark: '#c4561d', light: '#fff1e0', accent: '#2c2140', extra: '#22c3a6' },
    f: { fur: '#ff7a59', dark: '#c94a3a', light: '#fff1e6', accent: '#3a2346', extra: '#7c5cff' },
  },
  hoolu: {
    m: { fur: '#6c63d9', dark: '#463c9e', light: '#d9d3ff', accent: '#ffb238', extra: '#2b2f6b' },
    f: { fur: '#9b7cf0', dark: '#6a4fc4', light: '#efe4ff', accent: '#ffb238', extra: '#4fe0b0' },
  },
};

const SCALE: Record<Evolution, number> = { 1: 0.8, 2: 0.92, 3: 1 };

export function PetArt({
  race,
  gender,
  evolution,
  size = 180,
  className,
}: {
  race: RaceId;
  gender: Gender;
  evolution: Evolution;
  size?: number;
  className?: string;
}) {
  const p = PALETTES[race][gender];
  const s = SCALE[evolution];
  const id = `${race}-${gender}-${evolution}`;
  const body = race === 'tuskar' ? tuskar(p, gender, evolution) : race === 'vexa' ? vexa(p, gender, evolution) : hoolu(p, gender, evolution);
  return (
    <svg viewBox="0 0 200 220" width={size} height={(size * 220) / 200} className={className} aria-label={`${race} evolution ${evolution}`}>
      <defs>
        <radialGradient id={`aura-${id}`}>
          <stop offset="0%" stopColor={auraColor(race)} stopOpacity="0.55" />
          <stop offset="70%" stopColor={auraColor(race)} stopOpacity="0.12" />
          <stop offset="100%" stopColor={auraColor(race)} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="206" rx={52 * s} ry="7" fill="#000" opacity="0.25" />
      {evolution === 3 && <circle className="aura" cx="100" cy="120" r="98" fill={`url(#aura-${id})`} />}
      <g transform={`translate(100 205) scale(${s}) translate(-100 -205)`}>{body}</g>
    </svg>
  );
}

function auraColor(race: RaceId) {
  return race === 'tuskar' ? '#ff8a3d' : race === 'vexa' ? '#b46bff' : '#7fe7ff';
}

const eye = (x: number, y: number, r: number, female: boolean, lid?: 'brow' | 'sleepy' | 'sly') => (
  <g key={`eye${x}`}>
    <circle cx={x} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={2.5} />
    <circle cx={x + (x < 100 ? 1 : -1)} cy={y + 1} r={r * 0.55} fill={INK} />
    <circle cx={x + (x < 100 ? 2.5 : 0.5)} cy={y - r * 0.25} r={r * 0.2} fill="#fff" />
    {female && (
      <path
        d={x < 100 ? `M${x - r} ${y - r * 0.4} l-5 -4 M${x - r * 0.6} ${y - r * 0.85} l-3 -5` : `M${x + r} ${y - r * 0.4} l5 -4 M${x + r * 0.6} ${y - r * 0.85} l3 -5`}
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    )}
    {lid === 'sleepy' && (
      <path d={`M${x - r - 1} ${y} A${r + 1} ${r + 1} 0 0 1 ${x + r + 1} ${y} Z`} fill="currentColor" stroke={INK} strokeWidth={2.5} />
    )}
    {lid === 'brow' && (
      <path
        d={x < 100 ? `M${x - r - 3} ${y - r - 6} L${x + r + 2} ${y - r + 1}` : `M${x + r + 3} ${y - r - 6} L${x - r - 2} ${y - r + 1}`}
        stroke={INK}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
    )}
    {lid === 'sly' && (
      <path
        d={x < 100 ? `M${x - r - 2} ${y - r + 3} Q${x} ${y - r - 6} ${x + r + 2} ${y - r + 6}` : `M${x + r + 2} ${y - r + 3} Q${x} ${y - r - 6} ${x - r - 2} ${y - r + 6}`}
        stroke={INK}
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
    )}
  </g>
);

// ---------------------------------------------------------------- TUSKAR (boar)
function tuskar(p: Palette, g: Gender, e: Evolution): ReactNode {
  const f = g === 'f';
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      {e === 3 && <path d="M58 120 Q40 175 52 202 L148 202 Q160 175 142 120 Z" fill="#c8323c" />}
      {/* legs */}
      <rect x="70" y="168" width="24" height="34" rx="10" fill={p.dark} />
      <rect x="106" y="168" width="24" height="34" rx="10" fill={p.dark} />
      <path d="M70 196 h24 M106 196 h24" stroke={INK} />
      {/* body */}
      <ellipse cx="100" cy="148" rx="48" ry="40" fill={p.fur} />
      <ellipse cx="100" cy="156" rx="30" ry="24" fill={p.light} />
      {e >= 2 && (
        <>
          <rect x="56" y="166" width="88" height="11" rx="4" fill="#5a3a22" />
          <rect x="92" y="164" width="16" height="15" rx="3" fill="#ffc94a" />
        </>
      )}
      {e === 3 && <path d="M66 126 Q100 112 134 126 L130 168 Q100 176 70 168 Z" fill="#9aa6b8" />}
      {e === 3 && <path d="M84 134 L100 152 L116 134" fill="none" stroke="#5f6b80" strokeWidth={4} />}
      {/* arms */}
      <ellipse cx="52" cy="150" rx="13" ry="21" fill={p.fur} />
      <ellipse cx="148" cy="150" rx="13" ry="21" fill={p.fur} />
      {e >= 2 && <path d="M38 134 Q52 118 66 134 Z" fill="#8a94a6" />}
      {e >= 2 && <path d="M134 134 Q148 118 162 134 Z" fill="#8a94a6" />}
      {/* weapon */}
      {e === 2 && (
        <g>
          <rect x="150" y="96" width="10" height="70" rx="4" fill="#8b5a2b" transform="rotate(14 155 160)" />
          <ellipse cx="166" cy="96" rx="15" ry="20" fill="#a0693a" transform="rotate(14 166 96)" />
          <path d="M156 82 l-6 -6 M178 92 l7 -3 M170 76 l2 -8" strokeWidth={4} strokeLinecap="round" />
        </g>
      )}
      {e === 3 && (
        <g>
          <rect x="152" y="80" width="10" height="92" rx="4" fill="#6b4425" transform="rotate(10 157 160)" />
          <rect x="146" y="62" width="44" height="30" rx="6" fill="#9aa6b8" transform="rotate(10 168 77)" />
          <rect x="160" y="62" width="8" height="30" fill="#ffc94a" transform="rotate(10 168 77)" />
        </g>
      )}
      {/* head */}
      <path d="M62 66 L70 38 L88 58 Z" fill={p.fur} />
      <path d="M138 66 L130 38 L112 58 Z" fill={p.fur} />
      <path d="M68 58 L71 46 L80 56 Z M132 58 L129 46 L120 56 Z" fill={p.accent} strokeWidth={0} />
      <ellipse cx="100" cy="92" rx="46" ry="40" fill={p.fur} />
      {!f && e < 3 && <path d="M84 56 L88 42 L94 54 L100 38 L106 54 L112 42 L116 56 Z" fill={p.dark} />}
      {f && (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={66 + 7 * Math.cos((a * Math.PI) / 180)} cy={56 + 7 * Math.sin((a * Math.PI) / 180)} r="6" fill={p.extra} strokeWidth={2} />
          ))}
          <circle cx="66" cy="56" r="4.5" fill="#ffd84a" strokeWidth={2} />
        </g>
      )}
      {e === 3 && (
        <g>
          <path d="M58 82 Q60 46 100 44 Q140 46 142 82 Z" fill="#9aa6b8" />
          <path d="M60 70 Q38 58 40 30 Q52 50 66 56 Z" fill={p.extra === '#ff7aa8' ? '#fff6e0' : '#fff6e0'} />
          <path d="M140 70 Q162 58 160 30 Q148 50 134 56 Z" fill="#fff6e0" />
          <rect x="94" y="46" width="12" height="30" rx="3" fill="#ffc94a" />
        </g>
      )}
      <g color={p.fur}>
        {eye(82, 90, f ? 8 : 7, f, f ? undefined : 'brow')}
        {eye(118, 90, f ? 8 : 7, f, f ? undefined : 'brow')}
      </g>
      {f && <ellipse cx="70" cy="104" rx="7" ry="4" fill="#ff9aa8" strokeWidth={0} opacity={0.7} />}
      {f && <ellipse cx="130" cy="104" rx="7" ry="4" fill="#ff9aa8" strokeWidth={0} opacity={0.7} />}
      <ellipse cx="100" cy="110" rx="21" ry="15" fill={p.accent} />
      <ellipse cx="93" cy="110" rx="3.5" ry="5" fill={INK} strokeWidth={0} />
      <ellipse cx="107" cy="110" rx="3.5" ry="5" fill={INK} strokeWidth={0} />
      {/* tusks */}
      <path d={f ? 'M80 118 Q72 112 74 102 Q80 110 86 116 Z' : 'M80 120 Q66 112 70 92 Q78 108 87 116 Z'} fill="#fff6e0" />
      <path d={f ? 'M120 118 Q128 112 126 102 Q120 110 114 116 Z' : 'M120 120 Q134 112 130 92 Q122 108 113 116 Z'} fill="#fff6e0" />
    </g>
  );
}

// ---------------------------------------------------------------- VEXA (fox)
function vexa(p: Palette, g: Gender, e: Evolution): ReactNode {
  const f = g === 'f';
  const tail = (rot: number, key: number) => (
    <g key={key} transform={`rotate(${rot} 122 168)`}>
      <path d="M118 172 Q170 176 176 128 Q180 92 156 76 Q168 112 140 132 Q124 144 112 160 Z" fill={p.fur} />
      <path d="M156 76 Q168 92 170 108 Q162 100 150 98 Q156 88 156 76 Z" fill={p.light} />
    </g>
  );
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      {e === 3 && [-34, -16].map((r, i) => tail(r, i))}
      {tail(0, 9)}
      {/* legs */}
      <rect x="78" y="170" width="16" height="32" rx="7" fill={p.dark} />
      <rect x="106" y="170" width="16" height="32" rx="7" fill={p.dark} />
      <path d="M78 194 h16 M106 194 h16" stroke={INK} />
      {/* body */}
      <ellipse cx="100" cy="150" rx="32" ry="36" fill={p.fur} />
      <path d="M100 122 Q120 140 112 170 Q100 178 88 170 Q80 140 100 122 Z" fill={p.light} />
      {e === 3 && <path d="M72 140 Q100 128 128 140 L124 176 Q100 184 76 176 Z" fill="#2f2346" />}
      {e === 3 && <path d="M100 136 L100 178" stroke="#b46bff" strokeWidth={3} />}
      {/* arms */}
      <ellipse cx="66" cy="148" rx="9" ry="19" fill={p.fur} transform="rotate(12 66 148)" />
      <ellipse cx="134" cy="148" rx="9" ry="19" fill={p.fur} transform="rotate(-12 134 148)" />
      <circle cx="62" cy="164" r="7" fill={p.accent} />
      <circle cx="138" cy="164" r="7" fill={p.accent} />
      {/* blades */}
      {e >= 2 && (
        <path d="M140 164 L176 120 L180 124 L146 170 Z" fill="#dfe7f2" />
      )}
      {e === 3 && <path d="M60 164 L24 120 L20 124 L54 170 Z" fill="#dfe7f2" />}
      {/* scarf */}
      {e >= 2 && (
        <g>
          <path d="M70 120 Q100 136 130 120 L132 132 Q100 148 68 132 Z" fill={p.extra} />
          <path d="M120 130 L136 160 L124 158 L116 136 Z" fill={p.extra} />
        </g>
      )}
      {/* ears */}
      <path d="M60 80 L66 26 L92 62 Z" fill={p.fur} />
      <path d="M140 80 L134 26 L108 62 Z" fill={p.fur} />
      <path d="M64 44 L66 26 L76 40 Z M136 44 L134 26 L124 40 Z" fill={p.accent} />
      <path d="M68 70 L70 44 L84 62 Z M132 70 L130 44 L116 62 Z" fill={p.light} strokeWidth={0} />
      {/* head */}
      <path d="M58 92 Q58 58 100 56 Q142 58 142 92 Q144 112 124 120 L100 128 L76 120 Q56 112 58 92 Z" fill={p.fur} />
      <path d="M62 100 Q70 122 100 128 Q130 122 138 100 Q124 112 112 106 L100 116 L88 106 Q76 112 62 100 Z" fill={p.light} />
      {f && (
        <g>
          <path d="M120 58 L134 48 L136 64 Z M120 58 L134 66 L124 72 Z" fill={p.extra} />
          <circle cx="122" cy="60" r="4" fill={p.extra} />
        </g>
      )}
      {e === 3 && <path d="M64 82 Q100 70 136 82 L134 96 Q100 88 66 96 Z" fill="#2f2346" />}
      <g color={p.fur}>
        {eye(82, 88, f ? 8 : 7, f, f ? undefined : 'sly')}
        {eye(118, 88, f ? 8 : 7, f, f ? undefined : 'sly')}
      </g>
      <ellipse cx="100" cy="108" rx="6" ry="4.5" fill={INK} />
      <path d="M94 116 Q100 120 106 116" fill="none" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

// ---------------------------------------------------------------- HOOLU (owl)
function hoolu(p: Palette, g: Gender, e: Evolution): ReactNode {
  const f = g === 'f';
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      {e === 3 &&
        [
          [30, 90],
          [170, 100],
          [44, 46],
        ].map(([x, y], i) => <circle key={i} className="orb" cx={x} cy={y} r="8" fill="#7fe7ff" strokeWidth={2} />)}
      {/* staff */}
      {e >= 2 && (
        <g>
          <rect x="150" y="70" width="8" height="132" rx="4" fill="#8b5a2b" />
          <path d="M154 70 m-16 -8 a18 18 0 1 0 30 -12 a13 13 0 1 1 -30 12 Z" fill="#ffe27a" />
        </g>
      )}
      {/* feet */}
      <path d="M80 196 l-6 8 M86 196 v9 M92 196 l6 8 M108 196 l-6 8 M114 196 v9 M120 196 l6 8" stroke={p.accent} strokeWidth={4} strokeLinecap="round" />
      {/* robe / cloak behind */}
      {e >= 2 && <path d="M56 100 Q40 160 50 200 L150 200 Q160 160 144 100 Z" fill={p.extra === '#4fe0b0' ? '#3c2f7a' : p.extra} />}
      {/* body */}
      <ellipse cx="100" cy="140" rx="50" ry="60" fill={p.fur} />
      <ellipse cx="100" cy="158" rx="32" ry="38" fill={p.light} />
      {[0, 1, 2].map((r) =>
        [-1, 0, 1].map((c) => (
          <path key={`${r}${c}`} d={`M${100 + c * 14 - 5} ${146 + r * 14} l5 5 l5 -5`} fill="none" stroke={p.dark} strokeWidth={2.2} strokeLinecap="round" />
        )),
      )}
      {e === 3 &&
        [
          [72, 176],
          [128, 170],
          [100, 192],
        ].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z`} fill="#ffe27a" strokeWidth={1.5} />)}
      {/* wings */}
      <path d="M52 112 Q30 150 50 184 Q62 160 62 120 Z" fill={p.dark} />
      <path d="M148 112 Q170 150 150 184 Q138 160 138 120 Z" fill={p.dark} />
      {/* ear tufts */}
      <path d="M60 92 L52 58 L82 82 Z" fill={p.dark} />
      <path d="M140 92 L148 58 L118 82 Z" fill={p.dark} />
      {/* hood */}
      {e === 2 && <path d="M50 110 Q50 56 100 54 Q150 56 150 110 Q140 82 100 80 Q60 82 50 110 Z" fill={p.extra === '#4fe0b0' ? '#3c2f7a' : p.extra} />}
      {/* face disc */}
      <circle cx="80" cy="110" r="21" fill={p.light} />
      <circle cx="120" cy="110" r="21" fill={p.light} />
      <g color={p.light}>
        {eye(80, 110, 13, f, f ? undefined : 'sleepy')}
        {eye(120, 110, 13, f, f ? undefined : 'sleepy')}
      </g>
      <path d="M93 124 L107 124 L100 136 Z" fill={p.accent} />
      {f && <path d="M100 84 l6 7 l-6 7 l-6 -7 Z" fill={p.extra} />}
      {/* crown */}
      {e === 3 && <path d="M70 84 L74 60 L86 74 L100 52 L114 74 L126 60 L130 84 Z" fill="#ffc94a" />}
    </g>
  );
}

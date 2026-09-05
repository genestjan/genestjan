'use client';

/**
 * The four steps, as a bridge going up.
 *
 * The section immediately above this one is called The Gap, and the whole
 * argument of the site is that the money leaks in the space between the
 * pieces. So the process is drawn as the thing that closes a gap: survey the
 * span, find where it would fail, build across, then run traffic over it.
 *
 * Construction is cumulative and stepwise rather than scrubbed frame by frame.
 * Each stage is a CSS transition keyed off data-step, so scrolling advances
 * the build and clicking a step jumps to it, with no per-frame style writes.
 */

const DECK_L = 86;
const DECK_R = 434;
const DECK_Y = 190;
const TOWERS = [176, 344];

// Stay cables fan out either side of each tower to points along the deck.
const stays = TOWERS.flatMap((x) =>
  [-70, -50, -30, 30, 50, 70].map((d) => ({ x, to: x + d })),
);

const lights = Array.from({ length: 9 }, (_, i) => DECK_L + 20 + i * 39);

export default function BridgeBuild({ step }: { step: number }) {
  return (
    <svg
      aria-hidden
      data-step={step}
      className="bridge"
      viewBox="0 0 520 300"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bridgeDeck" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#5A6273" />
          <stop offset="50%" stopColor="#98A3B5" />
          <stop offset="100%" stopColor="#5A6273" />
        </linearGradient>
        <linearGradient id="bridgeTower" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#39424F" />
          <stop offset="40%" stopColor="#8C97A8" />
          <stop offset="100%" stopColor="#2B333D" />
        </linearGradient>
        <linearGradient id="bridgeBank" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1B2432" />
          <stop offset="100%" stopColor="#080B11" />
        </linearGradient>
      </defs>

      {/* ---- always present: the two banks and the void between them ---- */}
      <g className="br-banks">
        <path d={`M0 ${DECK_Y} H${DECK_L} V300 H0 Z`} fill="url(#bridgeBank)" />
        <path d={`M${DECK_R} ${DECK_Y} H520 V300 H${DECK_R} Z`} fill="url(#bridgeBank)" />
        <path d={`M0 ${DECK_Y} H${DECK_L}`} className="br-edge" />
        <path d={`M${DECK_R} ${DECK_Y} H520`} className="br-edge" />
      </g>

      {/* ---- 01 map: sight line across the gap, depth soundings ---- */}
      <g className="br-survey">
        <path d={`M${DECK_L} ${DECK_Y} H${DECK_R}`} className="br-sight" pathLength={1} />
        {[130, 200, 260, 320, 390].map((x, i) => (
          <path key={x} d={`M${x} ${DECK_Y + 6} V${DECK_Y + 20 + (i % 3) * 9}`} className="br-sound" />
        ))}
        <g className="br-pin" transform={`translate(${DECK_L - 14} ${DECK_Y})`}>
          <path d="M0 0 V-26" className="br-pin-mast" />
          <path d="M-5 -26 L5 -26 L0 -35 Z" className="br-pin-head" />
        </g>
        <g className="br-pin" transform={`translate(${DECK_R + 14} ${DECK_Y})`}>
          <path d="M0 0 V-26" className="br-pin-mast" />
          <path d="M-5 -26 L5 -26 L0 -35 Z" className="br-pin-head" />
        </g>
      </g>

      {/* ---- 02 constraint: piers driven, towers up, weak point called ---- */}
      <g className="br-piers">
        {TOWERS.map((x) => (
          <g key={x}>
            <rect x={x - 7} y={DECK_Y} width="14" height="74" className="br-pier" />
            <rect x={x - 13} y={DECK_Y + 68} width="26" height="8" className="br-footing" />
          </g>
        ))}
      </g>
      <g className="br-towers">
        {TOWERS.map((x) => (
          <g key={x} className="br-tower">
            <path
              d={`M${x - 9} ${DECK_Y} L${x - 3.5} 44 L${x + 3.5} 44 L${x + 9} ${DECK_Y} Z`}
              fill="url(#bridgeTower)"
            />
            <rect x={x - 12} y="112" width="24" height="5" className="br-crossbeam" />
            <circle cx={x} cy="38" r="2.6" className="br-beacon" />
          </g>
        ))}
      </g>
      <g className="br-constraint" transform={`translate(260 ${DECK_Y})`}>
        <circle r="9" className="br-constraint-ring" />
        <path d="M0 -6 L5 3 H-5 Z" className="br-constraint-mark" />
      </g>

      {/* ---- 03 build: crane on the bank, stays, then the deck across ---- */}
      <g className="br-crane">
        <path d={`M40 ${DECK_Y} V96`} className="br-crane-mast" />
        <path d="M12 100 H124" className="br-crane-jib" />
        <path d="M40 96 L40 104 M16 100 L40 88 M124 100 L40 88" className="br-crane-rig" />
        <path d="M104 100 V148" className="br-crane-line" />
        <rect x="99" y="148" width="10" height="7" className="br-crane-hook" />
      </g>
      <g className="br-stays">
        {stays.map((s, i) => (
          <path
            key={i}
            d={`M${s.x} 48 L${s.to} ${DECK_Y}`}
            className="br-stay"
            pathLength={1}
            style={{ transitionDelay: `${180 + (i % 6) * 70}ms` }}
          />
        ))}
      </g>
      <g className="br-deck">
        <path d={`M${DECK_L} ${DECK_Y} H${DECK_R}`} className="br-deck-slab" pathLength={1} />
        <path d={`M${DECK_L} ${DECK_Y + 6} H${DECK_R}`} className="br-deck-under" pathLength={1} />
      </g>

      {/* ---- 04 run: lights on, and something actually crossing ---- */}
      <g className="br-run">
        {lights.map((x) => (
          <circle key={x} cx={x} cy={DECK_Y - 7} r="1.9" className="br-light" />
        ))}
        <g className="br-traffic">
          <rect x="-9" y={DECK_Y - 9} width="18" height="5" rx="2.5" className="br-car" />
        </g>
      </g>
    </svg>
  );
}

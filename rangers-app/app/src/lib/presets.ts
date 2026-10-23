import type { BoardDoc } from './board';

const us = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, kind: 'us' as const, label: String(i + 1) }));
const them = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, kind: 'them' as const, label: '' }));

export const PRESETS: BoardDoc[] = [
  {
    id: 'give-and-go', name: 'Give-and-go', format: '8v8', moveMs: 1200, holdMs: 1400,
    whyKids: 'Pass, then run past. The defender can only watch the ball or the runner, not both.',
    pieces: [...us(2), ...them(1)],
    steps: [
      { positions: { u1: { x: 20, y: 22 }, u2: { x: 32, y: 14 }, t1: { x: 28, y: 22 } }, ballWith: 'u1', arrows: [] },
      { positions: { u1: { x: 20, y: 22 }, u2: { x: 32, y: 14 }, t1: { x: 28, y: 20 } }, ballWith: 'u2', arrows: [{ type: 'pass', from: { x: 20, y: 22 }, to: { x: 32, y: 14 } }] },
      { positions: { u1: { x: 38, y: 24 }, u2: { x: 32, y: 14 }, t1: { x: 30, y: 20 } }, ballWith: 'u1', arrows: [{ type: 'run', from: { x: 20, y: 22 }, to: { x: 38, y: 24 } }, { type: 'pass', from: { x: 32, y: 14 }, to: { x: 38, y: 24 } }] },
    ],
  },
  {
    id: 'overlap', name: 'Overlap on the wing', format: '8v8', moveMs: 1200, holdMs: 1400,
    whyKids: 'One holds the ball, a friend runs around the outside. Now it is 2 against 1.',
    pieces: [...us(2), ...them(1)],
    steps: [
      { positions: { u1: { x: 30, y: 8 }, u2: { x: 22, y: 12 }, t1: { x: 36, y: 10 } }, ballWith: 'u1', arrows: [] },
      { positions: { u1: { x: 32, y: 8 }, u2: { x: 38, y: 3 }, t1: { x: 36, y: 8 } }, ballWith: 'u1', arrows: [{ type: 'run', from: { x: 22, y: 12 }, to: { x: 38, y: 3 } }] },
      { positions: { u1: { x: 32, y: 8 }, u2: { x: 44, y: 5 }, t1: { x: 36, y: 8 } }, ballWith: 'u2', arrows: [{ type: 'pass', from: { x: 32, y: 8 }, to: { x: 44, y: 5 } }] },
    ],
  },
  {
    id: 'switch', name: 'Switch play', format: '8v8', moveMs: 1300, holdMs: 1400,
    whyKids: 'They crowd the ball. Pass to the far side, where there is space.',
    pieces: [...us(3), ...them(3)],
    steps: [
      { positions: { u1: { x: 28, y: 8 }, u2: { x: 28, y: 22 }, u3: { x: 28, y: 38 }, t1: { x: 32, y: 8 }, t2: { x: 32, y: 14 }, t3: { x: 32, y: 22 } }, ballWith: 'u1', arrows: [] },
      { positions: { u1: { x: 28, y: 8 }, u2: { x: 30, y: 22 }, u3: { x: 34, y: 38 }, t1: { x: 32, y: 8 }, t2: { x: 32, y: 14 }, t3: { x: 32, y: 22 } }, ballWith: 'u3', arrows: [{ type: 'pass', from: { x: 28, y: 8 }, to: { x: 34, y: 38 } }] },
    ],
  },
];

export const KEY_PHRASES = ['Win it back fast', 'Spread wide', 'Talk to each other', 'Play with your heart', 'Pass then move', 'Help your friend', 'Be brave on the ball', 'Stay goal-side'];
export const VALUES = ['Play With Your Heart', 'Teamwork', 'Sportsmanship', 'Perseverance', 'Respect', 'Integrity', 'Discipline', 'Community'];

/** Formation slots on a vertical pitch: x 0..1 across, y 0..1 from our goal (0) to theirs (1). First slot is GK when the format has one. */
export const FORMATIONS: Record<string, { code: string; x: number; y: number }[]> = {
  '4v4': [{ code: 'D', x: .5, y: .3 }, { code: 'L', x: .22, y: .55 }, { code: 'R', x: .78, y: .55 }, { code: 'F', x: .5, y: .8 }],
  '5v5': [{ code: 'GK', x: .5, y: .06 }, { code: 'D', x: .5, y: .3 }, { code: 'L', x: .22, y: .55 }, { code: 'R', x: .78, y: .55 }, { code: 'F', x: .5, y: .8 }],
  futsal: [{ code: 'GK', x: .5, y: .06 }, { code: 'D', x: .5, y: .3 }, { code: 'L', x: .22, y: .55 }, { code: 'R', x: .78, y: .55 }, { code: 'F', x: .5, y: .8 }],
  '7v7': [{ code: 'GK', x: .5, y: .06 }, { code: 'LB', x: .3, y: .27 }, { code: 'RB', x: .7, y: .27 }, { code: 'LM', x: .17, y: .55 }, { code: 'CM', x: .5, y: .5 }, { code: 'RM', x: .83, y: .55 }, { code: 'ST', x: .5, y: .82 }],
  '8v8': [{ code: 'GK', x: .5, y: .06 }, { code: 'LB', x: .2, y: .25 }, { code: 'CB', x: .5, y: .22 }, { code: 'RB', x: .8, y: .25 }, { code: 'LM', x: .2, y: .52 }, { code: 'CM', x: .5, y: .5 }, { code: 'RM', x: .8, y: .52 }, { code: 'ST', x: .5, y: .82 }],
  '9v9': [{ code: 'GK', x: .5, y: .06 }, { code: 'LB', x: .2, y: .25 }, { code: 'CB', x: .5, y: .22 }, { code: 'RB', x: .8, y: .25 }, { code: 'LCM', x: .38, y: .5 }, { code: 'RCM', x: .62, y: .5 }, { code: 'LW', x: .15, y: .74 }, { code: 'RW', x: .85, y: .74 }, { code: 'ST', x: .5, y: .84 }],
  '11v11': [{ code: 'GK', x: .5, y: .05 }, { code: 'LB', x: .15, y: .22 }, { code: 'LCB', x: .38, y: .2 }, { code: 'RCB', x: .62, y: .2 }, { code: 'RB', x: .85, y: .22 }, { code: 'LCM', x: .3, y: .48 }, { code: 'CM', x: .5, y: .45 }, { code: 'RCM', x: .7, y: .48 }, { code: 'LW', x: .15, y: .75 }, { code: 'ST', x: .5, y: .85 }, { code: 'RW', x: .85, y: .75 }],
};

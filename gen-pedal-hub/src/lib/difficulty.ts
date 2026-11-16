export type Difficulty = 'Easy' | 'Moderate' | 'Hard' | 'Extreme';

/**
 * How hard a route is, from its length and its climbing together.
 * Every 100 m of climbing counts like about 3 extra km on the flat, and a
 * route that is steep for its length moves up one level.
 */
export function difficulty(distanceM: number, elevGainM: number): Difficulty {
  const km = distanceM / 1000;
  const effort = km + (elevGainM / 100) * 3;
  const levels: Difficulty[] = ['Easy', 'Moderate', 'Hard', 'Extreme'];
  let i = effort < 30 ? 0 : effort < 70 ? 1 : effort < 130 ? 2 : 3;
  const steep = km >= 5 && elevGainM / km >= 20;
  if (steep && i < 3) i += 1;
  return levels[i];
}

export function difficultyHint(d: Difficulty): string {
  switch (d) {
    case 'Easy':
      return 'Short and mostly flat. Good for a first ride.';
    case 'Moderate':
      return 'Longer, or with some hills. Fine if you ride most weeks.';
    case 'Hard':
      return 'Long, or with big hills. Bring food and plenty of water.';
    default:
      return 'Very long or very hilly. For riders who train for it.';
  }
}

import type { HeatCategory } from '../lib/heatIndex';
export const HEAT_ACTIONS: Record<HeatCategory, { tone: 'ok' | 'warn' | 'bad'; breakEvery: number | null; text: string }> = {
  Normal: { tone: 'ok', breakEvery: null, text: 'Water at every natural break.' },
  Caution: { tone: 'ok', breakEvery: 20, text: 'Water break every 20 minutes. Rest in the shade.' },
  'Extreme caution': { tone: 'warn', breakEvery: 15, text: 'Water break every 15 minutes. Use shade, shorter hard blocks, more rolling subs. Avoid 10:00 to 16:00 where possible.' },
  Danger: { tone: 'bad', breakEvery: 10, text: 'Train before 9:00 or after 16:00, 45 to 60 minutes at most, cooling break every 10 to 15 minutes, no running fitness. Children who are unwell or have asthma rest.' },
  'Extreme danger': { tone: 'bad', breakEvery: 10, text: 'Cancel or postpone outdoor training and matches.' },
};
export const HEAT_ILLNESS = 'Stop the child, move to shade, cool with water on the skin, small sips of water. Call for medical help immediately if the child is confused, collapses, vomits, has hot skin or stops sweating: this can be heat stroke.';
export const LIGHTNING = 'When thunder roars, go indoors: a solid building or a closed vehicle, never under trees, goals or open sheds. Restart only 30 minutes after the last thunder.';
export const CONCUSSION = {
  signs: ['Lying motionless on the ground or slow to get up', 'Unsteady on feet, balance problems or falling over', 'Grabbing or clutching the head', 'Dazed, blank or vacant look', 'Confused or not aware of the match or team'],
  symptoms: ['Headache or pressure in the head', 'Dizziness', 'Blurred vision or sensitivity to light', 'Nausea', 'Feeling slowed down, foggy or "not right"', 'Sensitivity to noise'],
  redFlags: ['Neck pain or tenderness', 'Seizure or convulsion', 'Double vision', 'Loss of consciousness', 'Increasing confusion or irritability', 'Weakness or tingling in arms or legs', 'Repeated vomiting', 'Severe or increasing headache', 'Increasingly restless, agitated or combative', 'Deformity of the skull'],
  note: 'Check this list against the official Concussion Recognition Tool 6 (CRT6) before the season. If in doubt, sit them out.',
};
export const HEADING: { max: number; text: string }[] = [
  { max: 11, text: 'No heading in training. Do not coach heading.' },
  { max: 13, text: 'Low priority: at most one session a week, at most 5 headers each, with a light ball.' },
  { max: 16, text: 'At most one session a week, at most 10 headers each.' },
];
export const CHECKLIST = ['Water for every child and a refill plan', 'Shade and ice available', 'First-aid kit checked', 'Emergency contacts available on this phone', 'Goals anchored or weighted', 'Field walked for glass, stones and holes', 'Nearest hospital and directions known', 'At least two adults present'];
export const TIPS_PARENTS = ['Cheer effort, for every child, not only your own.', 'Leave instructions to the coaches: mixed messages confuse kids.', 'After the match start with "I love to watch you play" and "What was fun?".', 'Never compare your child with another child.', 'Growth spurts are normal. Late developers often catch up and pass early ones.'];
export const SAY_THIS = [['Great run back to help, Ana!', 'Good job'], ['What did you see there?', 'Why did you do that?'], ['Mistakes mean you are trying. Next play!', 'Shouting, or silence'], ['Your first touch is better than last month.', 'You are better than Ben.'], ['Who can show me a different way?', 'No, do it like this.']];

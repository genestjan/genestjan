import type { ChecklistItem, ChecklistItemState, ChecklistKind } from '../types';

export const CHECKLISTS: Record<ChecklistKind, { title: string; intro: string; items: ChecklistItem[] }> = {
  'pre-ride': {
    title: 'Pre-ride inspection',
    intro: 'Quick bike check before the next adventure.',
    items: [
      { id: 'helmet', label: 'Helmet fitted and secured', critical: true },
      { id: 'brakes', label: 'Brakes working front and rear', critical: true },
      { id: 'tires-visual', label: 'Tyres visually inspected (cuts, bulges, glass)', critical: true },
      { id: 'tire-pressure', label: 'Tyre pressure checked against the tyre or rim maker’s range' },
      { id: 'wheels', label: 'Wheels secure, spin true', critical: true },
      { id: 'axles', label: 'Quick releases or thru-axles closed and tight', critical: true },
      { id: 'chain', label: 'Chain and drivetrain checked' },
      { id: 'gears', label: 'Gears shifting properly' },
      { id: 'lights', label: 'Front and rear lights working and charged' },
      { id: 'reflective', label: 'Reflective gear available' },
      { id: 'bottles', label: 'Water bottles filled' },
      { id: 'food', label: 'Food and emergency snacks packed' },
      { id: 'phone', label: 'Phone charged' },
      { id: 'powerbank', label: 'Power bank, if needed' },
      { id: 'id', label: 'ID and emergency contact on you' },
      { id: 'repair-kit', label: 'Repair kit packed' },
      { id: 'spare', label: 'Spare tube or tyre repair supplies' },
      { id: 'pump', label: 'Pump or inflator' },
      { id: 'multitool', label: 'Multitool' },
      { id: 'first-aid', label: 'First aid supplies' },
      { id: 'weather', label: 'Rain or sun protection' },
      { id: 'offline', label: 'Ride plan saved on this phone for offline reference' },
    ],
  },
  'pit-stop': {
    title: 'Pit stop check',
    intro: 'Two minutes now saves an hour at the roadside.',
    items: [
      { id: 'tire-damage', label: 'No tyre damage or unusual pressure loss', critical: true },
      { id: 'brakes', label: 'Brakes behaving normally', critical: true },
      { id: 'loose', label: 'Wheels and parts not loose', critical: true },
      { id: 'chain', label: 'No unusual chain noise or damage' },
      { id: 'supplies', label: 'Water and food topped up' },
      { id: 'lights', label: 'Lights on if light or weather is changing' },
      { id: 'riders', label: 'All riders accounted for' },
      { id: 'next-stop', label: 'Everyone knows the next stop' },
      { id: 'ready', label: 'Group ready to roll' },
    ],
  },
  'post-ride': {
    title: 'Post-ride check',
    intro: 'Look after the bike that looked after you.',
    items: [
      { id: 'tires', label: 'Tyres checked for damage' },
      { id: 'brakes-drive', label: 'Brakes and drivetrain checked' },
      { id: 'clean', label: 'Bike cleaned as needed' },
      { id: 'lube', label: 'Chain lubricated if needed' },
      { id: 'issues', label: 'Mechanical issues written down' },
      { id: 'stats', label: 'Distance and time recorded' },
      { id: 'fatigue', label: 'Unusual fatigue or problems noted' },
      { id: 'notes', label: 'Notes saved for next ride' },
    ],
  },
};

export function progress(items: ChecklistItem[], states: Record<string, ChecklistItemState>) {
  const done = items.filter((i) => states[i.id] === 'ok' || states[i.id] === 'problem').length;
  const problems = items.filter((i) => states[i.id] === 'problem');
  const criticalProblems = problems.filter((i) => i.critical);
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0, problems, criticalProblems };
}

export const CRITICAL_MESSAGE =
  'Do not ride until this is fixed. A problem with brakes, steering, wheels, tyres or the frame can cause a crash. Get it made safe or arrange a pickup.';

import type { ClubEvent, Player } from './model';
import { fmtDateTime } from './util';

/** Who joined and who left the squad since the families were last told. */
export function squadChanges(prev: string[] = [], next: string[] = []) {
  return { added: next.filter((id) => !prev.includes(id)), removed: prev.filter((id) => !next.includes(id)) };
}
const nameOf = (p: Player) => `${p.firstName}${p.number ? ` (#${p.number})` : ''}`;
/** Team announcement: first names and shirt numbers only. */
export function squadAnnouncement(e: ClubEvent, picked: Player[], update: boolean) {
  const when = fmtDateTime(e.startsAt);
  const names = [...picked].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.firstName.localeCompare(b.firstName)).map(nameOf).join(', ');
  return {
    title: `${update ? 'Squad update' : 'Squad'}: ${e.title}`,
    body: `${when}${e.venue ? `, ${e.venue}` : ''}.\nPicked (${picked.length}): ${names}.${e.bring ? `\nBring: ${e.bring}.` : ''}\nIf your child cannot come, please message the coach as soon as possible.`,
  };
}
/** Private message to one picked child's family. */
export function squadMessage(e: ClubEvent, p: Player) {
  return `${p.firstName} has been picked for ${e.title} on ${fmtDateTime(e.startsAt)}${e.venue ? ` at ${e.venue}` : ''}.${e.bring ? ` Please bring: ${e.bring}.` : ''} Reply here if ${p.firstName} cannot come.`;
}

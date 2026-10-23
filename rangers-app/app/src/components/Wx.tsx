import { useEffect, useState } from 'react';
import { Tone } from './ui';
import { fetchWx, forEvent, YAM1, type EventWx } from '../lib/weather';
import { HEAT_ACTIONS, HEAT_ILLNESS, LIGHTNING } from '../content/safety';
import type { ClubEvent } from '../lib/model';

export function EventWeather({ e, compact }: { e: ClubEvent; compact?: boolean }) {
  const [wx, setWx] = useState<EventWx | null | 'na' | 'err'>(null);
  useEffect(() => {
    const days = (Date.parse(e.startsAt) - Date.now()) / 86400000;
    if (days > 6.5 || days < -0.5) { setWx('na'); return; }
    let live = true;
    const tz = (iso: string) => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 16); // Manila wall clock
    fetchWx(e.lat ?? YAM1.lat, e.lng ?? YAM1.lng).then((h) => live && setWx(forEvent(h, tz(e.startsAt), tz(e.endsAt)) ?? 'na')).catch(() => live && setWx('err'));
    return () => { live = false; };
  }, [e.id, e.startsAt, e.endsAt, e.lat, e.lng]);
  if (wx === null) return <p className="muted text-sm">Checking the heat forecast...</p>;
  if (wx === 'na') return <p className="muted text-sm">Heat forecast shows up to 6 days ahead.</p>;
  if (wx === 'err') return <p className="muted text-sm">Heat forecast unavailable (offline?). Check the heat index before you go and use the heat guide.</p>;
  const a = HEAT_ACTIONS[wx.category];
  return (
    <div className="grid gap-2">
      <Tone tone={a.tone}>Heat index up to {wx.maxHi}°C: {wx.category}</Tone>
      {!compact && <p className="text-sm">{a.text}</p>}
      {wx.thunder && <Tone tone="bad">Thunderstorms possible. {!compact && LIGHTNING}</Tone>}
      {!compact && wx.category !== 'Normal' && <p className="muted text-sm"><b>If a child feels unwell:</b> {HEAT_ILLNESS}</p>}
    </div>
  );
}

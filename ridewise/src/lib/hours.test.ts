import { hoursStatusAt, parseOpeningHours } from './hours';
import { parseLocal } from './time';

const at = (s: string) => parseLocal(s, 'Asia/Manila')!;
const tz = 'Asia/Manila';

describe('opening hours', () => {
  it('treats missing hours as unknown', () => {
    expect(hoursStatusAt(undefined, at('2026-11-07T10:00'), tz)).toBe('unknown');
  });
  it('handles 24/7', () => {
    expect(hoursStatusAt('24/7', at('2026-11-07T03:00'), tz)).toBe('listed-open');
  });
  it('handles day ranges and closed days', () => {
    const h = 'Mo-Fr 08:00-17:00; Sa 08:00-12:00; Su off';
    expect(hoursStatusAt(h, at('2026-11-07T10:00'), tz)).toBe('listed-open'); // Sat
    expect(hoursStatusAt(h, at('2026-11-07T13:00'), tz)).toBe('listed-closed');
    expect(hoursStatusAt(h, at('2026-11-08T10:00'), tz)).toBe('listed-closed'); // Sun
  });
  it('handles overnight ranges', () => {
    const h = 'Mo-Su 18:00-02:00';
    expect(hoursStatusAt(h, at('2026-11-08T01:00'), tz)).toBe('listed-open');
    expect(hoursStatusAt(h, at('2026-11-08T03:00'), tz)).toBe('listed-closed');
  });
  it('refuses to guess unusual formats', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-17:00; PH off')).toBeNull();
    expect(hoursStatusAt('sunrise-sunset', at('2026-11-07T10:00'), tz)).toBe('unknown');
  });
});

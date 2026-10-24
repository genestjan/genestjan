import { describe, expect, it } from 'vitest';
import { CLIP, clipExt, clipPath, clipsToDelete, isClipPath, planClip, recorderType, teamClipPath } from './mediaRules';

describe('short videos', () => {
  it('sends a small short clip as it is, shrinks a big or long one, and explains when it cannot', () => {
    expect(planClip({ type: 'video/mp4', size: 2e6 }, 12, true)).toEqual({ do: 'send' });
    expect(planClip({ type: 'video/webm;codecs=vp8', size: 2e6 }, 30, false)).toEqual({ do: 'send' });
    expect(planClip({ type: 'video/mp4', size: 40e6 }, 12, true)).toEqual({ do: 'shrink' });
    expect(planClip({ type: 'video/mp4', size: 2e6 }, 75, true)).toEqual({ do: 'shrink' });
    const no = planClip({ type: 'video/mp4', size: 40e6 }, 12, false); expect(no.do).toBe('refuse'); expect(no.do === 'refuse' && no.reason).toMatch(/Record a video/);
    expect(planClip({ type: 'image/jpeg', size: 1e5 }, 0, true).do).toBe('refuse');
    expect(planClip({ type: 'video/x-matroska', size: 1e6 }, 5, true)).toEqual({ do: 'shrink' });
  });
  it('30 seconds at the chosen quality stays under the size limit', () => {
    expect(((CLIP.videoBits + CLIP.audioBits) / 8) * CLIP.seconds).toBeLessThan(CLIP.maxBytes * 0.7);
  });
  it('records MP4 where the phone can (plays everywhere), else WebM', () => {
    expect(recorderType((t) => t.startsWith('video/mp4'))).toMatch(/^video\/mp4/);
    expect(recorderType((t) => t === 'video/webm;codecs=vp8,opus')).toBe('video/webm;codecs=vp8,opus');
    expect(recorderType(() => false)).toBe('');
    expect(clipExt('video/mp4;codecs=avc1')).toBe('mp4'); expect(clipExt('video/webm')).toBe('webm'); expect(clipExt('video/quicktime')).toBe('mov');
  });
  it('keeps videos where the same people can see them as photos', () => {
    expect(clipPath('kid', 'x', 'mp4')).toBe('p/kid/x.mp4'); expect(teamClipPath('team', 'y', 'webm')).toBe('t/team/y.webm');
    expect(isClipPath('p/kid/x.webm')).toBe(true); expect(isClipPath('p/kid/x.jpg')).toBe(false);
  });
  it("deletes a child's video 14 days after the coach checked it, never before", () => {
    const now = Date.parse('2026-11-30T00:00:00Z'); const day = 864e5;
    const sub = (o: object) => ({ mediaType: 'video', mediaPath: 'p/k/a.mp4', status: 'approved', reviewedAt: new Date(now - 15 * day).toISOString(), ...o });
    expect(clipsToDelete([sub({})], now)).toHaveLength(1);
    expect(clipsToDelete([sub({ status: 'redo' })], now)).toHaveLength(1);
    expect(clipsToDelete([sub({ reviewedAt: new Date(now - 10 * day).toISOString() })], now)).toHaveLength(0);
    expect(clipsToDelete([sub({ status: 'submitted', reviewedAt: undefined })], now)).toHaveLength(0);
    expect(clipsToDelete([sub({ mediaType: 'image' })], now)).toHaveLength(0);
    expect(clipsToDelete([sub({ mediaPath: '' })], now)).toHaveLength(0);
  });
});

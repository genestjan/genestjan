import { describe, it, expect } from 'vitest';
import { pathToReady, fitWithin } from './helpers';

describe('pathToReady', () => {
  it('walks valid transitions', () => {
    expect(pathToReady('in_repair')).toEqual(['quality_check', 'ready']);
    expect(pathToReady('checked_in')).toEqual(['in_repair', 'quality_check', 'ready']);
    expect(pathToReady('scheduled')).toEqual(['checked_in', 'in_repair', 'quality_check', 'ready']);
    expect(pathToReady('waiting_parts')).toEqual(['in_repair', 'quality_check', 'ready']);
    expect(pathToReady('quality_check')).toEqual(['ready']);
  });
  it('is empty when done or impossible', () => {
    expect(pathToReady('ready')).toEqual([]);
    expect(pathToReady('completed')).toEqual([]);
    expect(pathToReady('cancelled')).toEqual([]);
  });
});

describe('fitWithin', () => {
  it('downscales the long side', () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 1280, h: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ w: 960, h: 1280 });
  });
  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

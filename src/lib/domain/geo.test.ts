import { describe, expect, it } from 'vitest';
import { estimatedTravelMinutes, haversineKm } from './geo';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm({ latitude: 32.08, longitude: 34.78 }, { latitude: 32.08, longitude: 34.78 })).toBe(0);
  });

  it('matches a known Tel Aviv to Ramat Gan distance', () => {
    const distance = haversineKm({ latitude: 32.0790, longitude: 34.7805 }, { latitude: 32.0823, longitude: 34.8140 });
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(3.5);
  });

  it('is symmetric', () => {
    const a = { latitude: 32.0, longitude: 34.7 };
    const b = { latitude: 31.7, longitude: 35.2 };
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });
});

describe('estimatedTravelMinutes', () => {
  it('scales with distance and never returns zero', () => {
    expect(estimatedTravelMinutes(0)).toBe(1);
    expect(estimatedTravelMinutes(13)).toBe(30);
    expect(estimatedTravelMinutes(26)).toBe(60);
  });
});

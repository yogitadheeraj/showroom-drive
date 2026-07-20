import { describe, expect, it } from 'vitest';
import { fetchDealerGrowthStats } from './landingPageStats';

describe('fetchDealerGrowthStats', () => {
  it('uses the public landing stats endpoint for guest users', async () => {
    const apiGet = async (path: string) => {
      if (path.includes('/api/public/landing-stats')) {
        return {
          availableVehicles: 2,
          testDrivesScheduled: 1,
          testDrivesCompleted: 3,
          totalBrands: 4,
          totalLeads: 5,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    };

    const stats = await fetchDealerGrowthStats(apiGet as any);

    expect(stats.availableVehicles).toBe(2);
    expect(stats.testDrivesScheduled).toBe(1);
    expect(stats.testDrivesCompleted).toBe(3);
    expect(stats.totalBrands).toBe(4);
    expect(stats.totalLeads).toBe(5);
  });
});

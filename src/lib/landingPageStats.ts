type ApiGetFn = <T = unknown>(path: string) => Promise<T>;

export type DealerGrowthStats = {
  availableVehicles: number;
  testDrivesScheduled: number;
  testDrivesCompleted: number;
  totalBrands: number;
  salesToday: number;
  totalLeads: number;
  serviceBookingsTotal: number;
  serviceBookingsBooked: number;
  serviceBookingsConfirmed: number;
  serviceBookingsInProgress: number;
  serviceBookingsCompleted: number;
  serviceBookingsToday: number;
  serviceBookingsCancelled: number;
  serviceBookingsRescheduled: number;
};

export async function fetchDealerGrowthStats(apiGet: ApiGetFn): Promise<DealerGrowthStats> {
  try {
    const response = await apiGet<Record<string, unknown>>('/api/public/landing-stats');
    const payload =
      response && typeof response === 'object' && 'data' in response && response.data && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : response;

    return {
      availableVehicles: Number(payload?.availableVehicles ?? 0),
      testDrivesScheduled: Number(payload?.testDrivesScheduled ?? 0),
      testDrivesCompleted: Number(payload?.testDrivesCompleted ?? 0),
      totalBrands: Number(payload?.totalBrands ?? 0),
      salesToday: Number(payload?.salesToday ?? 0),
      totalLeads: Number(payload?.totalLeads ?? 0),
      serviceBookingsTotal: Number(payload?.serviceBookingsTotal ?? 0),
      serviceBookingsBooked: Number(payload?.serviceBookingsBooked ?? 0),
      serviceBookingsConfirmed: Number(payload?.serviceBookingsConfirmed ?? 0),
      serviceBookingsInProgress: Number(payload?.serviceBookingsInProgress ?? 0),
      serviceBookingsCompleted: Number(payload?.serviceBookingsCompleted ?? 0),
      serviceBookingsToday: Number(payload?.serviceBookingsToday ?? 0),
      serviceBookingsCancelled: Number(payload?.serviceBookingsCancelled ?? 0),
      serviceBookingsRescheduled: Number(payload?.serviceBookingsRescheduled ?? 0),
    };
  } catch {
    return {
      availableVehicles: 0,
      testDrivesScheduled: 0,
      testDrivesCompleted: 0,
      totalBrands: 0,
      salesToday: 0,
      totalLeads: 0,
      serviceBookingsTotal: 0,
      serviceBookingsBooked: 0,
      serviceBookingsConfirmed: 0,
      serviceBookingsInProgress: 0,
      serviceBookingsCompleted: 0,
      serviceBookingsToday: 0,
      serviceBookingsCancelled: 0,
      serviceBookingsRescheduled: 0,
    };
  }
}

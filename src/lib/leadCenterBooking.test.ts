import { describe, expect, it } from 'vitest';
import {
  buildCarBookingFromQuote,
  buildLeadConversionUpdate,
  buildSaleBookingFromOpportunity,
  getLeadConversionStage,
  isLeadStage,
  shouldCreateBookingFromQuote,
} from './leadCenterBooking';

describe('lead center booking handoff', () => {
  it('creates a booking payload for approved sale quotes', () => {
    const booking = buildCarBookingFromQuote({
      opportunityId: 'opp_123',
      customerId: 'cust_1',
      vehicleId: 'veh_1',
      testDriveId: 'td_1',
      locationId: 'loc_1',
      salesPersonProfileId: 'profile_1',
      quote: {
        final_payable: 42000,
        status: 'approved',
        insurance_provider: 'AXA',
        finance_provider: 'ADCB',
        financing_plan: '36 months',
      },
    });

    expect(shouldCreateBookingFromQuote({ status: 'approved', final_payable: 42000 })).toBe(true);
    expect(booking.booking_amount).toBe(42000);
    expect(booking.booking_status).toBe('confirmed');
    expect(booking.payment_status).toBe('pending');
    expect(booking.notes).toContain('approved');
  });

  it('does not create a booking for incomplete or draft quotes', () => {
    expect(shouldCreateBookingFromQuote({ status: 'proposal' })).toBe(false);
    expect(shouldCreateBookingFromQuote({ status: 'won', final_payable: 0 })).toBe(false);
  });

  it('converts lead stages into an opportunity stage for the sales pipeline', () => {
    expect(isLeadStage('new')).toBe(true);
    expect(isLeadStage('contacted')).toBe(true);
    expect(isLeadStage('qualified')).toBe(false);
    expect(getLeadConversionStage('new')).toBe('qualified');
    expect(getLeadConversionStage('contacted')).toBe('qualified');
    expect(getLeadConversionStage('qualified')).toBe('qualified');
  });

  it('builds a deterministic lead conversion payload for UI and API tests', () => {
    const update = buildLeadConversionUpdate({ stage: 'new', notes: 'Initial lead note', timestamp: '2026-01-01T10:00:00Z' });

    expect(update.stage).toBe('qualified');
    expect(update.notes).toContain('Initial lead note');
    expect(update.notes).toContain('Lead converted to opportunity');
    expect(update.updated_at).toBeTruthy();
  });

  it('creates a sale booking payload when an opportunity is converted to a sale', () => {
    const booking = buildSaleBookingFromOpportunity({
      opportunityId: 'opp_123',
      customerId: 'cust_1',
      vehicleId: 'veh_1',
      testDriveId: 'td_1',
      locationId: 'loc_1',
      salesPersonProfileId: 'profile_1',
      quote: {
        final_payable: 42000,
        status: 'won',
        insurance_provider: 'AXA',
        finance_provider: 'ADCB',
        financing_plan: '36 months',
      },
    });

    expect(booking.booking_status).toBe('confirmed');
    expect(booking.deal_status).toBe('won');
    expect(booking.booking_amount).toBe(42000);
    expect(booking.notes).toContain('won');
  });
});

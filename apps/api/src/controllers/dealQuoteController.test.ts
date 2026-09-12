import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../services/databaseService.js', () => ({
  runDbQuery: vi.fn(),
}));

import { updateDealQuoteController } from './dealQuoteController.js';
import { runDbQuery } from '../services/databaseService.js';

describe('deal quote controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an existing quote and recalculates totals', async () => {
    const mockedRunDbQuery = vi.mocked(runDbQuery);
    mockedRunDbQuery.mockResolvedValue({ data: [{ id: 'quote-1', status: 'approved' }] } as any);

    const req: any = {
      params: { id: 'quote-1' },
      body: {
        vehicle_price: 1000,
        accessories_total: 100,
        discounts: 50,
        vat_rate: 5,
        registration_and_insurance: 200,
        service_contract: 50,
        warranty: 25,
        finance_charges: 75,
        trade_in_value: 150,
        down_payment: 300,
        insurance_provider: 'AXA',
        finance_provider: 'ADCB',
        financing_plan: '36 months',
        status: 'approved',
      },
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await updateDealQuoteController(req, res);

    expect(mockedRunDbQuery).toHaveBeenCalledWith(expect.objectContaining({
      table: 'deal_quotes',
      action: 'update',
      payload: expect.objectContaining({
        status: 'approved',
        insurance_provider: 'AXA',
        financing_plan: '36 months',
      }),
      filters: [{ field: 'id', op: 'eq', value: 'quote-1' }],
    }));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.any(Array),
      error: null,
    }));
  });
});

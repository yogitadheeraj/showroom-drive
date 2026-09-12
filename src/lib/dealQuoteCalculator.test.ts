import { describe, expect, it } from 'vitest';
import { calculateDealSummary } from './dealQuoteCalculator';

describe('deal quote calculator', () => {
  it('computes the final payable amount, vat and net balance from the selected package', () => {
    const summary = calculateDealSummary({
      vehiclePrice: 450000,
      accessoriesTotal: 25000,
      discounts: 18000,
      vatRate: 5,
      registrationAndInsurance: 23000,
      serviceContract: 12000,
      warranty: 8000,
      financeCharges: 15000,
      tradeInValue: 35000,
      downPayment: 60000,
    });

    expect(summary.subtotal).toBe(533000);
    expect(summary.discountsTotal).toBe(18000);
    expect(summary.vatAmount).toBe(25750);
    expect(summary.finalPayable).toBe(505750);
    expect(summary.balanceAfterDownPayment).toBe(445750);
  });
});

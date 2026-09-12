export type DealQuoteInputs = {
  vehiclePrice: number;
  accessoriesTotal?: number;
  discounts?: number;
  vatRate?: number;
  registrationAndInsurance?: number;
  serviceContract?: number;
  warranty?: number;
  financeCharges?: number;
  tradeInValue?: number;
  downPayment?: number;
};

export type DealQuoteSummary = {
  subtotal: number;
  discountsTotal: number;
  postDiscountSubtotal: number;
  vatAmount: number;
  totalWithVat: number;
  finalPayable: number;
  balanceAfterDownPayment: number;
  financedAmount: number;
};

export function calculateDealSummary(input: DealQuoteInputs): DealQuoteSummary {
  const vehiclePrice = Number(input.vehiclePrice) || 0;
  const accessoriesTotal = Number(input.accessoriesTotal || 0);
  const discounts = Number(input.discounts || 0);
  const vatRate = Number(input.vatRate || 0) / 100;
  const registrationAndInsurance = Number(input.registrationAndInsurance || 0);
  const serviceContract = Number(input.serviceContract || 0);
  const warranty = Number(input.warranty || 0);
  const financeCharges = Number(input.financeCharges || 0);
  const tradeInValue = Number(input.tradeInValue || 0);
  const downPayment = Number(input.downPayment || 0);

  const subtotal = vehiclePrice + accessoriesTotal + registrationAndInsurance + serviceContract + warranty + financeCharges;
  const postDiscountSubtotal = Math.max(0, subtotal - discounts);
  const vatAmount = postDiscountSubtotal * vatRate;
  const totalWithVat = postDiscountSubtotal + vatAmount;
  const finalPayable = Math.max(0, totalWithVat - tradeInValue);
  const balanceAfterDownPayment = Math.max(0, finalPayable - downPayment);
  const financedAmount = Math.max(0, balanceAfterDownPayment);

  return {
    subtotal,
    discountsTotal: discounts,
    postDiscountSubtotal,
    vatAmount,
    totalWithVat,
    finalPayable,
    balanceAfterDownPayment,
    financedAmount,
  };
}

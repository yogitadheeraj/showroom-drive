export type LeadCenterBookingInput = {
  opportunityId?: string | null;
  customerId?: string | null;
  vehicleId?: string | null;
  testDriveId?: string | null;
  locationId?: string | null;
  salesPersonProfileId?: string | null;
  quote?: {
    final_payable?: number | string | null;
    status?: string | null;
    insurance_provider?: string | null;
    finance_provider?: string | null;
    financing_plan?: string | null;
    notes?: string | null;
  };
};

export function isLeadStage(stage?: string | null) {
  return ['new', 'contacted'].includes(String(stage || '').trim().toLowerCase());
}

export function getLeadConversionStage(stage?: string | null) {
  return isLeadStage(stage) ? 'qualified' : String(stage || 'qualified').trim().toLowerCase() || 'qualified';
}

export function buildLeadConversionUpdate(input?: { stage?: string | null; notes?: string | null; timestamp?: string | Date | null }) {
  const stage = getLeadConversionStage(input?.stage);
  const timestamp = input?.timestamp ? new Date(input.timestamp).toLocaleString() : new Date().toLocaleString();
  const note = `[${timestamp}] Lead converted to opportunity from follow-up center.`;

  return {
    stage,
    notes: input?.notes ? `${input.notes}\n${note}` : note,
    updated_at: new Date().toISOString(),
  };
}

export function shouldCreateBookingFromQuote(quote: { status?: string | null; final_payable?: number | string | null } | null | undefined) {
  if (!quote) return false;
  const status = String(quote.status || '').trim().toLowerCase();
  const finalPayable = Number(quote.final_payable ?? 0);

  if (!status) return false;
  if (!['approved', 'won', 'finance_review'].includes(status)) return false;
  if (!Number.isFinite(finalPayable) || finalPayable <= 0) return false;

  return true;
}

export function buildCarBookingFromQuote(input: LeadCenterBookingInput) {
  const quote = input.quote ?? {};
  const finalPayable = Number(quote.final_payable ?? 0);
  const status = String(quote.status || '').trim().toLowerCase();

  return {
    customer_id: input.customerId || null,
    vehicle_id: input.vehicleId || null,
    location_id: input.locationId || '',
    test_drive_id: input.testDriveId || null,
    opportunity_id: input.opportunityId || null,
    sales_person_profile_id: input.salesPersonProfileId || null,
    booking_status: 'confirmed',
    payment_method: 'cash',
    payment_status: 'pending',
    booking_amount: Number.isFinite(finalPayable) ? finalPayable : 0,
    insurance_provider: quote.insurance_provider || null,
    finance_provider: quote.finance_provider || null,
    financing_plan: quote.financing_plan || null,
    deal_status: status || 'approved',
    notes: [
      quote.notes,
      `Lead quote converted from ${status || 'quote'} flow`,
      quote.insurance_provider ? `Insurance: ${quote.insurance_provider}` : null,
      quote.finance_provider ? `Finance: ${quote.finance_provider}` : null,
      quote.financing_plan ? `Plan: ${quote.financing_plan}` : null,
    ].filter(Boolean).join(' | '),
  };
}

export function buildSaleBookingFromOpportunity(input: LeadCenterBookingInput) {
  const quote = input.quote ?? {};
  const finalPayable = Number(quote.final_payable ?? 0);
  const status = String(quote.status || '').trim().toLowerCase();

  return {
    customer_id: input.customerId || null,
    vehicle_id: input.vehicleId || null,
    location_id: input.locationId || '',
    test_drive_id: input.testDriveId || null,
    opportunity_id: input.opportunityId || null,
    sales_person_profile_id: input.salesPersonProfileId || null,
    booking_status: 'confirmed',
    payment_method: 'cash',
    payment_status: 'paid',
    booking_amount: Number.isFinite(finalPayable) ? finalPayable : 0,
    insurance_provider: quote.insurance_provider || null,
    finance_provider: quote.finance_provider || null,
    financing_plan: quote.financing_plan || null,
    deal_status: status || 'won',
    notes: [
      `Sale completed from opportunity ${input.opportunityId || 'unknown'}`,
      `Deal status: ${status || 'won'}`,
      quote.insurance_provider ? `Insurance: ${quote.insurance_provider}` : null,
      quote.finance_provider ? `Finance: ${quote.finance_provider}` : null,
      quote.financing_plan ? `Plan: ${quote.financing_plan}` : null,
    ].filter(Boolean).join(' | '),
  };
}

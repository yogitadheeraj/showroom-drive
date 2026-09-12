import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runDbQuery } from '../services/databaseService.js';

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function buildQuoteTotals(payload: Record<string, unknown>) {
  const vehiclePrice = toNumber(payload.vehicle_price);
  const accessoriesTotal = toNumber(payload.accessories_total);
  const discounts = toNumber(payload.discounts);
  const vatRate = toNumber(payload.vat_rate);
  const registrationAndInsurance = toNumber(payload.registration_and_insurance);
  const serviceContract = toNumber(payload.service_contract);
  const warranty = toNumber(payload.warranty);
  const financeCharges = toNumber(payload.finance_charges);
  const tradeInValue = toNumber(payload.trade_in_value);
  const downPayment = toNumber(payload.down_payment);

  const subtotal = vehiclePrice + accessoriesTotal + registrationAndInsurance + serviceContract + warranty + financeCharges;
  const postDiscountSubtotal = Math.max(0, subtotal - discounts);
  const vatAmount = postDiscountSubtotal * (vatRate / 100);
  const finalPayable = Math.max(0, postDiscountSubtotal + vatAmount - tradeInValue);
  const balanceAfterDownPayment = Math.max(0, finalPayable - downPayment);

  return {
    subtotal,
    discounts_total: discounts,
    vat_amount: vatAmount,
    final_payable: finalPayable,
    balance_after_down_payment: balanceAfterDownPayment,
    vehicle_price: vehiclePrice,
    accessories_total: accessoriesTotal,
    discounts,
    vat_rate: vatRate,
    registration_and_insurance: registrationAndInsurance,
    service_contract: serviceContract,
    warranty,
    finance_charges: financeCharges,
    trade_in_value: tradeInValue,
    down_payment: downPayment,
  };
}

export async function listDealQuotesController(req: Request, res: Response) {
  try {
    const where: Array<{ field: string; op: 'eq'; value: string | number | null }> = [];

    if (req.query.opportunity_id) {
      where.push({ field: 'opportunity_id', op: 'eq', value: String(req.query.opportunity_id) });
    }
    if (req.query.customer_id) {
      where.push({ field: 'customer_id', op: 'eq', value: String(req.query.customer_id) });
    }
    if (req.query.location_id) {
      where.push({ field: 'location_id', op: 'eq', value: String(req.query.location_id) });
    }
    if (req.query.limit) {
      const limit = Number(req.query.limit);
      if (Number.isFinite(limit) && limit > 0) {
        // handled by db query result below
      }
    }

    const result = await runDbQuery({
      table: 'deal_quotes',
      action: 'select',
      filters: where,
      order: [{ field: 'updated_at', ascending: false }],
      limit: Number(req.query.limit) || 20,
    });

    res.status(200).json({ data: result.data ?? [], error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function createDealQuoteController(req: Request, res: Response) {
  try {
    const payload = req.body ?? {};
    const opportunityId = String(payload.opportunity_id || '').trim();
    const customerId = String(payload.customer_id || '').trim();

    if (!opportunityId || !customerId) {
      throw new Error('opportunity_id and customer_id are required');
    }

    const totals = buildQuoteTotals(payload as Record<string, unknown>);

    const created = await runDbQuery({
      table: 'deal_quotes',
      action: 'insert',
      values: [{
        id: payload.id || randomUUID(),
        opportunity_id: opportunityId,
        customer_id: customerId,
        test_drive_id: payload.test_drive_id || null,
        dealer_id: payload.dealer_id ?? req.authUser?.dealer_id ?? null,
        location_id: payload.location_id ?? req.authUser?.location_id ?? null,
        created_by_profile_id: payload.created_by_profile_id ?? req.authUser?.profile_id ?? null,
        ...totals,
        insurance_provider: String(payload.insurance_provider || ''),
        finance_provider: String(payload.finance_provider || ''),
        financing_plan: String(payload.financing_plan || ''),
        status: String(payload.status || 'proposal'),
        subtotal: totals.subtotal,
        discounts_total: totals.discounts_total,
        vat_amount: totals.vat_amount,
        final_payable: totals.final_payable,
        balance_after_down_payment: totals.balance_after_down_payment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    });

    res.status(201).json({ data: created.data?.[0] ?? created.data ?? null, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function updateDealQuoteController(req: Request, res: Response) {
  try {
    const quoteId = String(req.params?.id || '').trim();
    if (!quoteId) {
      throw new Error('Quote id is required');
    }

    const payload = req.body ?? {};
    const totals = buildQuoteTotals(payload as Record<string, unknown>);
    const updatePayload = {
      ...totals,
      insurance_provider: String(payload.insurance_provider ?? ''),
      finance_provider: String(payload.finance_provider ?? ''),
      financing_plan: String(payload.financing_plan ?? ''),
      status: String(payload.status || 'proposal'),
      updated_at: new Date().toISOString(),
    };

    const updated = await runDbQuery({
      table: 'deal_quotes',
      action: 'update',
      payload: updatePayload,
      filters: [{ field: 'id', op: 'eq', value: quoteId }],
    });

    res.status(200).json({ data: updated.data ?? [], error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

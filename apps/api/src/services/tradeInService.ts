import { randomUUID } from 'node:crypto';
import { TradeInRequest } from '../models/TradeInRequest.js';

export type TradeInInput = {
  customer_name?: string;
  phone?: string;
  email?: string;
  preferred_brand?: string;
  preferred_model?: string;
  current_vehicle?: string;
  current_year?: string;
  current_mileage?: string;
  condition?: string;
  expected_offer?: string;
  notes?: string;
  status?: string;
  dealer_id?: string | null;
  location_id?: string | null;
};

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function listTradeInRequests(filters: Record<string, unknown> = {}, limit = 20) {
  const query: Record<string, unknown> = {};

  if (filters.dealer_id) query.dealer_id = filters.dealer_id;
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.status) query.status = filters.status;
  if (filters.phone) query.phone = String(filters.phone);

  const docs = await TradeInRequest.find(query).sort({ created_at: -1 }).limit(limit).lean();
  return docs.map((doc: any) => {
    const row = { ...doc };
    delete row._id;
    return row;
  });
}

export async function createTradeInRequest(payload: TradeInInput) {
  const now = new Date().toISOString();
  const record = {
    id: String(payload.customer_name ? `tradein_${randomUUID()}` : randomUUID()),
    customer_name: String(payload.customer_name || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    preferred_brand: String(payload.preferred_brand || 'BMW').trim(),
    preferred_model: String(payload.preferred_model || '').trim(),
    current_vehicle: String(payload.current_vehicle || '').trim(),
    current_year: String(payload.current_year || '').trim(),
    current_mileage: String(payload.current_mileage || '').trim(),
    condition: String(payload.condition || 'Good').trim(),
    expected_offer: String(payload.expected_offer || '').trim(),
    notes: String(payload.notes || '').trim(),
    status: String(payload.status || 'New enquiry').trim(),
    dealer_id: payload.dealer_id ?? null,
    location_id: payload.location_id ?? null,
    created_at: now,
    updated_at: now,
  };

  if (!record.customer_name || !record.phone || !record.current_vehicle) {
    throw new Error('Customer name, phone, and current vehicle are required.');
  }

  const doc = new TradeInRequest(record);
  await doc.save();
  return lean(doc);
}

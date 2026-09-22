import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { CarBooking, BookingStatus, PaymentMethod, PaymentStatus } from '../models/CarBooking.js';
import type { PaymentRequestMode } from '../models/CarBooking.js';
import { Customer } from '../models/Customer.js';
import { Dealer } from '../models/Dealer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { TestDrive } from '../models/TestDrive.js';
import { CarBookingPaymentEvent } from '../models/CarBookingPaymentEvent.js';
import { sendMail } from './mailService.js';
import { env } from '../config/env.js';
import {
  buildDefaultPaymentConfig,
  getCarBookingPaymentConfigByLocationId,
} from './carBookingPaymentConfigService.js';

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

const CURRENCY_LOCALE_BY_CODE: Record<string, string> = {
  AED: 'en-AE',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

function resolveCurrencyCode(currency?: string | null) {
  const normalized = String(currency || 'AED').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CURRENCY_LOCALE_BY_CODE, normalized) ? normalized : 'AED';
}

function formatCurrency(amount: number, currency?: string | null) {
  const code = resolveCurrencyCode(currency);
  const locale = CURRENCY_LOCALE_BY_CODE[code] || 'en-AE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

async function buildInvoicePdfBuffer(args: {
  invoiceNumber: string;
  paidAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicleName: string;
  locationName: string;
  paymentModeLabel: string;
  bookingAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currencyCode: string;
  dealerName?: string | null;
  dealerLogoUrl?: string | null;
  primaryColor?: string | null;
  dealerCode?: string | null;
  dealerEmail?: string | null;
  dealerPhone?: string | null;
  dealerGstNumber?: string | null;
  dealerPanNumber?: string | null;
  invoiceTerms?: string | null;
  locationAddress?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  locationPincode?: string | null;
  locationPhone?: string | null;
  locationEmail?: string | null;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  const primaryColor = args.primaryColor || '#2563eb';

  let logoBuffer: Buffer | null = null;
  if (args.dealerLogoUrl) {
    try {
      const response = await fetch(args.dealerLogoUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        logoBuffer = Buffer.from(arrayBuffer);
      }
    } catch {
      logoBuffer = null;
    }
  }

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 40, 34, { fit: [130, 50] });
      doc.y = 88;
    } catch {
      doc.y = 40;
    }
  }

  doc.fontSize(22).fillColor(primaryColor).text(args.dealerName || 'Payment Invoice', { align: 'left' });
  doc.fontSize(12).fillColor('#111827').text('Payment Invoice', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#6b7280').text(`Invoice No: ${args.invoiceNumber}`);
  doc.text(`Paid At: ${new Date(args.paidAt).toLocaleString('en-IN')}`);
  if (args.dealerCode) doc.text(`Dealer Code: ${args.dealerCode}`);

  doc.moveDown(1);
  doc.fontSize(13).fillColor(primaryColor).text('Seller / Dealership Details');
  doc.fontSize(10).fillColor('#374151').text(`Dealership: ${args.dealerName || args.locationName}`);
  doc.text(`Branch: ${args.locationName}`);
  const sellerAddress = [args.locationAddress, args.locationCity, args.locationState, args.locationCountry, args.locationPincode]
    .filter(Boolean)
    .join(', ');
  if (sellerAddress) doc.text(`Address: ${sellerAddress}`);
  if (args.dealerEmail || args.locationEmail) doc.text(`Email: ${args.locationEmail || args.dealerEmail}`);
  if (args.dealerPhone || args.locationPhone) doc.text(`Phone: ${args.locationPhone || args.dealerPhone}`);
  if (args.dealerGstNumber) doc.text(`GST: ${args.dealerGstNumber}`);
  if (args.dealerPanNumber) doc.text(`PAN: ${args.dealerPanNumber}`);

  doc.moveDown(1);
  doc.fontSize(13).fillColor(primaryColor).text('Customer Details');
  doc.fontSize(10).fillColor('#374151').text(`Name: ${args.customerName}`);
  doc.text(`Email: ${args.customerEmail || 'N/A'}`);
  doc.text(`Phone: ${args.customerPhone || 'N/A'}`);

  doc.moveDown(1);
  doc.fontSize(13).fillColor(primaryColor).text('Booking Details');
  doc.fontSize(10).fillColor('#374151').text(`Vehicle: ${args.vehicleName}`);
  doc.text(`Location: ${args.locationName}`);
  doc.text(`Payment Type: ${args.paymentModeLabel}`);

  doc.moveDown(1);
  doc.fontSize(13).fillColor(primaryColor).text('Amount Breakup');
  doc.moveDown(0.4);

  const lines = [
    ['Booking Amount', formatCurrency(args.bookingAmount, args.currencyCode)],
    ['Paid Now', formatCurrency(args.paidAmount, args.currencyCode)],
    ['Remaining Balance', formatCurrency(args.remainingAmount, args.currencyCode)],
    ['Tax / GST', args.dealerGstNumber ? `GST registered: ${args.dealerGstNumber}` : 'As applicable at final invoicing'],
  ];

  lines.forEach(([label, value]) => {
    doc.fontSize(10).fillColor('#111827').text(label, 40, doc.y, { continued: true });
    doc.text(String(value), { align: 'right' });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.fontSize(13).fillColor(primaryColor).text('Invoice Notes & Terms');
  doc.moveDown(0.4);
  if (args.invoiceTerms) {
    const termLines = String(args.invoiceTerms)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (termLines.length > 0) {
      termLines.forEach((line, index) => {
        doc.fontSize(10).fillColor('#4b5563').text(`${index + 1}. ${line}`, { align: 'left' });
      });
    }
  } else {
    doc.fontSize(10).fillColor('#4b5563').text('1. This invoice acknowledges receipt of the amount shown above against the booking.', { align: 'left' });
    doc.text('2. Any remaining balance, taxes, registration, insurance, accessories, and statutory charges will be shared separately where applicable.', { align: 'left' });
    doc.text('3. Please retain this invoice and payment confirmation for your records and future reference.', { align: 'left' });
  }
  doc.moveDown(0.6);
  doc.fontSize(10).fillColor('#6b7280').text('Thank you for your payment. We are excited to be part of your journey.', { align: 'left' });
  doc.end();
  return bufferPromise;
}

async function sendPaymentSuccessEmail(args: {
  booking: any;
  customer: any;
  vehicle: any;
  location: any;
  amount: number;
  paymentMode: PaymentRequestMode;
  paidAt: string;
  currencyCode: string;
  branding?: { dealerName?: string | null; dealerLogoUrl?: string | null; primaryColor?: string | null };
  dealership?: {
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    invoiceTerms?: string | null;
  };
}) {
  if (!args.customer?.email) return;

  const customerName = args.customer?.full_name || 'Customer';
  const vehicleName = args.vehicle ? `${args.vehicle.brand} ${args.vehicle.model}`.trim() : 'Vehicle';
  const locationName = args.location?.name || 'our showroom';
  const bookingAmount = Number(args.booking?.booking_amount || 0);
  const paidAmount = Number(args.amount || 0);
  const remainingAmount = Math.max(0, bookingAmount - paidAmount);
  const invoiceNumber = `INV-${String(args.booking.id).slice(0, 8).toUpperCase()}`;
  const paymentModeLabel = args.paymentMode === 'full' ? 'Full Payment' : 'Booking Deposit';
  const headline = args.paymentMode === 'full' ? 'Welcome to the family' : 'Your new adventure has officially begun';
  const subline = args.paymentMode === 'full'
    ? 'We are thrilled to have you with us. Your payment is complete and your booking is now secured.'
    : 'Your deposit has been received successfully. We are excited to take the next steps with you.';
  const primaryColor = args.branding?.primaryColor || '#2563eb';
  const dealerName = args.branding?.dealerName || locationName;
  const dealerLogoUrl = args.branding?.dealerLogoUrl || null;
  const branchAddress = [
    args.location?.address,
    args.location?.city,
    args.location?.state,
    args.location?.country,
    args.location?.pincode,
  ].filter(Boolean).join(', ');

  const invoicePdf = await buildInvoicePdfBuffer({
    invoiceNumber,
    paidAt: args.paidAt,
    customerName,
    customerEmail: args.customer?.email || null,
    customerPhone: args.customer?.phone || null,
    vehicleName,
    locationName,
    paymentModeLabel,
    bookingAmount,
    paidAmount,
    remainingAmount,
    currencyCode: args.currencyCode,
    dealerName,
    dealerLogoUrl,
    primaryColor,
    dealerCode: args.dealership?.code || null,
    dealerEmail: args.dealership?.email || null,
    dealerPhone: args.dealership?.phone || null,
    dealerGstNumber: args.dealership?.gstNumber || null,
    dealerPanNumber: args.dealership?.panNumber || null,
    invoiceTerms: args.dealership?.invoiceTerms || null,
    locationAddress: args.location?.address || null,
    locationCity: args.location?.city || null,
    locationState: args.location?.state || null,
    locationCountry: args.location?.country || null,
    locationPincode: args.location?.pincode || null,
    locationPhone: args.location?.phone || null,
    locationEmail: args.location?.email || null,
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;background:#ffffff;">
      <div style="padding:28px 32px;background:linear-gradient(135deg,${primaryColor} 0%,#0f172a 100%);color:#fff;border-radius:18px 18px 0 0;">
        ${dealerLogoUrl ? `<img src="${dealerLogoUrl}" alt="${dealerName}" style="height:42px;max-width:180px;object-fit:contain;display:block;margin-bottom:14px;" />` : ''}
        <p style="margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#bfdbfe;">Payment Confirmation</p>
        <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">${headline}</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#e0f2fe;">${subline}</p>
      </div>
      <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 18px 18px;">
        <p style="margin:0 0 12px;">Hi ${customerName},</p>
        <p style="margin:0 0 16px;color:#374151;line-height:1.7;">
          We have successfully received your <strong>${paymentModeLabel.toLowerCase()}</strong> for <strong>${vehicleName}</strong> at <strong>${locationName}</strong>.
        </p>
        ${branchAddress ? `<p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.6;">Delivery / billing branch: ${branchAddress}</p>` : ''}
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:18px 0;">
          <div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;">Invoice Number</span><strong>${invoiceNumber}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;">Booking Amount</span><strong>${formatCurrency(bookingAmount, args.currencyCode)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;">Paid Now</span><strong>${formatCurrency(paidAmount, args.currencyCode)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;"><span style="color:#6b7280;">Balance Remaining</span><strong>${formatCurrency(remainingAmount, args.currencyCode)}</strong></div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px 18px;margin:18px 0;color:#9a3412;">
          <p style="margin:0 0 8px;font-weight:700;color:#9a3412;">What is attached</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#9a3412;">Your invoice PDF includes the booking amount, paid amount, remaining balance, dealership details, and important invoice notes.</p>
        </div>
        <p style="margin:0 0 12px;color:#374151;line-height:1.7;">Your invoice PDF is attached with the complete breakup for your records.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Thank you for choosing ${dealerName}. We look forward to being part of your journey ahead.</p>
      </div>
    </div>
  `;

  const text = [
    headline,
    '',
    `Hi ${customerName},`,
    `We have received your ${paymentModeLabel.toLowerCase()} for ${vehicleName} at ${locationName}.`,
    `Invoice Number: ${invoiceNumber}`,
    `Booking Amount: ${formatCurrency(bookingAmount, args.currencyCode)}`,
    `Paid Now: ${formatCurrency(paidAmount, args.currencyCode)}`,
    `Balance Remaining: ${formatCurrency(remainingAmount, args.currencyCode)}`,
    '',
    'Your invoice PDF is attached with the full breakup.',
  ].join('\n');

  await sendMail({
    to: args.customer.email,
    subject: `Payment received — ${vehicleName}`,
    html,
    text,
    _dealerName: dealerName,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf',
      },
    ],
  });
}

async function resolveDealerBranding(locationId: string | undefined): Promise<{ dealerName?: string; dealerLogoUrl?: string; primaryColor?: string }> {
  if (!locationId) return {};
  try {
    const loc = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean() as any;
    if (!loc?.dealer_id) return {};
    const dealer = await Dealer.findOne({ id: loc.dealer_id }, { name: 1, logo_url: 1, primary_color: 1 }).lean() as any;
    if (!dealer) return {};
    return {
      dealerName: dealer.name || undefined,
      dealerLogoUrl: dealer.logo_url || undefined,
      primaryColor: dealer.primary_color || undefined,
    };
  } catch {
    return {};
  }
}

async function resolveDealerDetails(locationId: string | undefined): Promise<{ code?: string; email?: string; phone?: string; gstNumber?: string; panNumber?: string; invoiceTerms?: string }> {
  if (!locationId) return {};
  try {
    const loc = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean() as any;
    if (!loc?.dealer_id) return {};
    const dealer = await Dealer.findOne({ id: loc.dealer_id }, { code: 1, contact_email: 1, contact_phone: 1, gst_number: 1, pan_number: 1, invoice_terms: 1 }).lean() as any;
    if (!dealer) return {};
    return {
      code: dealer.code || undefined,
      email: dealer.contact_email || undefined,
      phone: dealer.contact_phone || undefined,
      gstNumber: dealer.gst_number || undefined,
      panNumber: dealer.pan_number || undefined,
      invoiceTerms: dealer.invoice_terms || undefined,
    };
  } catch {
    return {};
  }
}

// ─── List (with enriched relations) ─────────────────────────────────────────

export async function listCarBookings(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};

  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.sales_person_profile_id) query.sales_person_profile_id = filters.sales_person_profile_id;
  if (filters.booking_status) query.booking_status = filters.booking_status;

  const limit = typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : 200;

  const docs = await CarBooking.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  const rows = docs.map((d: any) => { const o = { ...d }; delete o._id; return o; });

  if (rows.length === 0) return rows;

  const customerIds  = Array.from(new Set(rows.map((r: any) => r.customer_id).filter(Boolean)));
  const vehicleIds   = Array.from(new Set(rows.map((r: any) => r.vehicle_id).filter(Boolean)));
  const locationIds  = Array.from(new Set(rows.map((r: any) => r.location_id).filter(Boolean)));
  const profileIds   = Array.from(new Set([
    ...rows.map((r: any) => r.sales_person_profile_id),
    ...rows.map((r: any) => r.cancelled_by_profile_id),
  ].filter(Boolean)));
  const tdIds        = Array.from(new Set(rows.map((r: any) => r.test_drive_id).filter(Boolean)));

  const [customers, vehicles, locations, profiles, testDrives] = await Promise.all([
    customerIds.length  ? Customer.find({ id: { $in: customerIds } }, { id: 1, full_name: 1, phone: 1, email: 1 }).lean() : [],
    vehicleIds.length   ? Vehicle.find({ id: { $in: vehicleIds } }, { id: 1, brand: 1, model: 1, variant: 1 }).lean() : [],
    locationIds.length  ? Location.find({ id: { $in: locationIds } }, { id: 1, name: 1, currency_type: 1 }).lean() : [],
    profileIds.length   ? Profile.find({ id: { $in: profileIds } }, { id: 1, full_name: 1, phone: 1 }).lean() : [],
    tdIds.length        ? TestDrive.find({ id: { $in: tdIds } }, { id: 1, scheduled_date: 1, scheduled_time: 1 }).lean() : [],
  ]);

  const cMap  = new Map((customers  as any[]).map((c: any) => [c.id, c]));
  const vMap  = new Map((vehicles   as any[]).map((v: any) => [v.id, v]));
  const lMap  = new Map((locations  as any[]).map((l: any) => [l.id, l]));
  const pMap  = new Map((profiles   as any[]).map((p: any) => [p.id, p]));
  const tdMap = new Map((testDrives as any[]).map((t: any) => [t.id, t]));

  return rows.map((r: any) => ({
    ...r,
    customers:   cMap.get(r.customer_id) || null,
    vehicles:    vMap.get(r.vehicle_id) || null,
    locations:   lMap.get(r.location_id) || null,
    salesPerson: pMap.get(r.sales_person_profile_id) || null,
    cancelledBy: pMap.get(r.cancelled_by_profile_id) || null,
    testDrive:   tdMap.get(r.test_drive_id) || null,
  }));
}

// ─── Get single ─────────────────────────────────────────────────────────────

export async function getCarBookingById(id: string) {
  const doc = await CarBooking.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any;
  delete o._id;
  return o;
}

async function getBookingPaymentContext(id: string) {
  const booking = await CarBooking.findOne({ id }).lean();
  if (!booking) return null;

  const [customerDoc, vehicleDoc, locationDoc] = await Promise.all([
    booking.customer_id ? Customer.findOne({ id: booking.customer_id }, { id: 1, full_name: 1, phone: 1, email: 1 }).lean() : null,
    booking.vehicle_id ? Vehicle.findOne({ id: booking.vehicle_id }, { id: 1, brand: 1, model: 1, variant: 1, color: 1 }).lean() : null,
    booking.location_id ? Location.findOne({ id: booking.location_id }, { id: 1, name: 1, address: 1, city: 1, currency_type: 1, phone: 1, email: 1 }).lean() : null,
  ]);

  const row = { ...(booking as any) };
  delete row._id;

  return {
    ...row,
    customers: customerDoc || null,
    vehicles: vehicleDoc || null,
    locations: locationDoc || null,
  };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export interface CreateCarBookingInput {
  customer_id?: string;
  vehicle_id?: string;
  location_id: string;
  test_drive_id?: string;
  opportunity_id?: string;
  sales_person_profile_id?: string;
  booking_status?: BookingStatus;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  booking_amount: number;
  insurance_provider?: string | null;
  finance_provider?: string | null;
  financing_plan?: string | null;
  deal_status?: string | null;
  payment_link?: string;
  payment_request_mode?: PaymentRequestMode;
  payment_requested_amount?: number;
  notes?: string;
}

export async function createCarBooking(input: CreateCarBookingInput) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const doc = new CarBooking({
    id,
    customer_id: input.customer_id || null,
    vehicle_id: input.vehicle_id || null,
    location_id: input.location_id,
    test_drive_id: input.test_drive_id || null,
    opportunity_id: input.opportunity_id || null,
    sales_person_profile_id: input.sales_person_profile_id || null,
    booking_status: input.booking_status ?? 'confirmed',
    payment_method: input.payment_method ?? 'cash',
    payment_status: input.payment_status ?? (input.payment_method === 'cash' ? 'paid' : 'pending'),
    booking_amount: input.booking_amount,
    insurance_provider: input.insurance_provider || null,
    finance_provider: input.finance_provider || null,
    financing_plan: input.financing_plan || null,
    deal_status: input.deal_status || null,
    refund_amount: 0,
    payment_link: input.payment_link || null,
    payment_request_mode: input.payment_request_mode || null,
    payment_requested_amount: Number(input.payment_requested_amount || 0),
    payment_link_sent_at: input.payment_link ? now : null,
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  });
  await doc.save();
  return toPlain(doc);
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

export interface CancelCarBookingInput {
  cancellation_reason: string;
  cancelled_by_profile_id?: string;
}

export async function cancelCarBooking(id: string, input: CancelCarBookingInput) {
  const now = new Date().toISOString();
  const doc = await CarBooking.findOneAndUpdate(
    { id, booking_status: 'confirmed' },
    {
      booking_status: 'cancelled',
      cancellation_reason: input.cancellation_reason,
      cancelled_at: now,
      cancelled_by_profile_id: input.cancelled_by_profile_id || null,
      updated_at: now,
    },
    { new: true }
  ).lean();

  if (!doc) return null;
  const booking = { ...doc } as any;
  delete booking._id;

  // Send cancel emails (non-blocking)
  void sendCancellationEmails(booking, 'cancel').catch(() => null);
  return booking;
}

// ─── Refund ──────────────────────────────────────────────────────────────────

export interface RefundCarBookingInput {
  refund_amount: number;
  refund_notes: string;
  cancelled_by_profile_id?: string;
}

export async function refundCarBooking(id: string, input: RefundCarBookingInput) {
  const now = new Date().toISOString();
  const doc = await CarBooking.findOneAndUpdate(
    { id, booking_status: 'confirmed' },
    {
      booking_status: 'refunded',
      payment_status: 'refunded',
      refund_amount: input.refund_amount,
      refund_notes: input.refund_notes,
      cancellation_reason: input.refund_notes,
      cancelled_at: now,
      refunded_at: now,
      cancelled_by_profile_id: input.cancelled_by_profile_id || null,
      updated_at: now,
    },
    { new: true }
  ).lean();

  if (!doc) return null;
  const booking = { ...doc } as any;
  delete booking._id;

  void sendCancellationEmails(booking, 'refund').catch(() => null);
  return booking;
}

// ─── Generic update ──────────────────────────────────────────────────────────

export async function updateCarBooking(id: string, updates: Partial<ICarBooking>) {
  const doc = await CarBooking.findOneAndUpdate(
    { id },
    { ...updates, updated_at: new Date().toISOString() },
    { new: true }
  ).lean();
  if (!doc) return null;
  const o = { ...doc } as any;
  delete o._id;
  return o;
}

export async function generateCarBookingPaymentLink(
  id: string,
  input: { payment_mode?: PaymentRequestMode } = {},
) {
  const booking = await CarBooking.findOne({ id }).lean();
  if (!booking) throw new Error('Car booking not found');
  if (booking.booking_status !== 'confirmed') {
    throw new Error('Payment link can be generated only for confirmed bookings');
  }

  const config =
    (await getCarBookingPaymentConfigByLocationId(booking.location_id)) ||
    buildDefaultPaymentConfig(booking.location_id);

  if (!config.payment_module_enabled) {
    throw new Error('Payment module is disabled for this location');
  }

  const preferredMode = input.payment_mode || config.default_collection_mode || 'deposit';
  const resolvedMode: PaymentRequestMode = preferredMode === 'full' ? 'full' : 'deposit';

  if (resolvedMode === 'deposit' && !config.allow_deposit) {
    throw new Error('Deposit collection is disabled for this location');
  }
  if (resolvedMode === 'full' && !config.allow_full_payment) {
    throw new Error('Full payment collection is disabled for this location');
  }

  const bookingAmount = Number(booking.booking_amount || 0);
  if (!(bookingAmount > 0)) {
    throw new Error('Invalid booking amount for payment link generation');
  }

  let amountToPay = bookingAmount;
  if (resolvedMode === 'deposit') {
    if (config.deposit_type === 'fixed') {
      amountToPay = Math.min(bookingAmount, Math.max(0, Number(config.deposit_value || 0)));
    } else {
      const pct = Math.max(1, Math.min(100, Number(config.deposit_value || 10)));
      amountToPay = Math.round((bookingAmount * pct) / 100);
    }
  }

  if (!(amountToPay > 0)) {
    throw new Error('Calculated payable amount is invalid. Please review payment settings.');
  }

  const baseUrl = (config.payment_link_base_url || '').trim() || `${env.publicFrontendUrl.replace(/\/$/, '')}/payment`;
  const url = new URL(baseUrl);
  url.searchParams.set('bookingId', booking.id);
  url.searchParams.set('locationId', booking.location_id);
  url.searchParams.set('mode', resolvedMode);
  url.searchParams.set('amount', String(amountToPay));
  url.searchParams.set('provider', String(config.provider_name || 'manual'));

  const now = new Date().toISOString();
  const updated = await CarBooking.findOneAndUpdate(
    { id: booking.id },
    {
      payment_method: 'payment_link',
      payment_status: 'pending',
      payment_link: url.toString(),
      payment_request_mode: resolvedMode,
      payment_requested_amount: amountToPay,
      payment_link_sent_at: now,
      updated_at: now,
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error('Failed to update booking payment link');

  const row = { ...(updated as any) };
  delete row._id;
  return row;
}

export async function getPublicCarBookingPaymentDetails(id: string, locationId?: string | null) {
  const details = await getBookingPaymentContext(id);
  if (!details) throw new Error('Car booking not found');
  if (locationId && details.location_id !== locationId) {
    throw new Error('Payment link does not match the booking location');
  }
  if (details.booking_status !== 'confirmed') {
    throw new Error('This booking is not available for payment');
  }

  return details;
}

export async function completeCarBookingPayment(
  id: string,
  input: { amount?: number; mode?: PaymentRequestMode; provider?: string; locationId?: string | null } = {},
) {
  const details = await getPublicCarBookingPaymentDetails(id, input.locationId);

  const amount = Number(input.amount || details.payment_requested_amount || details.booking_amount || 0);
  if (!(amount > 0)) throw new Error('Invalid payment amount');

  const paymentMode: PaymentRequestMode = input.mode === 'deposit' ? 'deposit' : 'full';
  const provider = String(input.provider || 'manual').trim() || 'manual';
  const now = new Date().toISOString();
  const currencyCode = resolveCurrencyCode(details.locations?.currency_type);
  const customer = details.customers;
  const vehicle = details.vehicles;
  const location = details.locations;
  const branding = await resolveDealerBranding(details.location_id);
  const dealership = await resolveDealerDetails(details.location_id);

  const updated = await CarBooking.findOneAndUpdate(
    { id: details.id },
    {
      payment_method: provider === 'manual' ? 'payment_link' : 'online',
      payment_status: 'paid',
      payment_request_mode: paymentMode,
      payment_requested_amount: amount,
      updated_at: now,
    },
    { new: true },
  ).lean();

  await new CarBookingPaymentEvent({
    id: randomUUID(),
    booking_id: details.id,
    location_id: details.location_id,
    customer_id: details.customer_id || null,
    vehicle_id: details.vehicle_id || null,
    amount,
    currency_code: currencyCode,
    payment_mode: paymentMode,
    provider,
    status: 'success',
    payment_link: details.payment_link || null,
    paid_at: now,
    created_at: now,
    updated_at: now,
  }).save();

  await sendPaymentSuccessEmail({
    booking: details,
    customer,
    vehicle,
    location,
    amount,
    paymentMode,
    paidAt: now,
    currencyCode,
    branding,
    dealership,
  }).catch((error) => {
    console.error('[car-booking-payment-email] failed', error);
  });

  const row = { ...(updated as any) };
  delete row._id;
  return {
    ...row,
    payment_event: {
      amount,
      currency_code: currencyCode,
      payment_mode: paymentMode,
      provider,
      status: 'success',
      paid_at: now,
    },
  };
}

export async function emailCarBookingPaymentLink(id: string) {
  const booking = await CarBooking.findOne({ id }).lean();
  if (!booking) throw new Error('Car booking not found');
  if (booking.booking_status !== 'confirmed') {
    throw new Error('Payment link can be emailed only for confirmed bookings');
  }
  if (!booking.payment_link) {
    throw new Error('Generate the payment link before sending email');
  }

  const [customerDoc, vehicleDoc, locationDoc] = await Promise.all([
    booking.customer_id ? Customer.findOne({ id: booking.customer_id }, { full_name: 1, email: 1 }).lean() : null,
    booking.vehicle_id ? Vehicle.findOne({ id: booking.vehicle_id }, { brand: 1, model: 1 }).lean() : null,
    booking.location_id ? Location.findOne({ id: booking.location_id }, { name: 1 }).lean() : null,
  ]);

  const customer = customerDoc as any;
  const vehicle = vehicleDoc as any;
  const location = locationDoc as any;

  if (!customer?.email) {
    throw new Error('Customer email is not available for this booking');
  }

  const customerName = customer?.full_name || 'Customer';
  const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : 'Vehicle';
  const locationName = location?.name || '';
  const amountStr = formatCurrency(booking.payment_requested_amount || booking.booking_amount || 0, location?.currency_type);
  const paymentModeLabel = booking.payment_request_mode === 'full' ? 'full amount' : 'booking deposit';

  await sendMail({
    to: customer.email,
    subject: `Complete your car booking payment — ${vehicleName}`,
    html: paymentLinkEmailHtml({
      customerName,
      vehicleName,
      locationName,
      amountStr,
      paymentModeLabel,
      paymentLink: booking.payment_link,
    }),
  });

  return { sent: true, email: customer.email };
}

// ─── Count ───────────────────────────────────────────────────────────────────

export async function countCarBookings(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.booking_status) query.booking_status = filters.booking_status;
  return CarBooking.countDocuments(query);
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendCancellationEmails(booking: any, mode: 'cancel' | 'refund') {
  // Look up customer & vehicle name
  const [customerDoc, vehicleDoc, locationDoc] = await Promise.all([
    booking.customer_id ? Customer.findOne({ id: booking.customer_id }, { full_name: 1, email: 1 }).lean() : null,
    booking.vehicle_id  ? Vehicle.findOne({ id: booking.vehicle_id }, { brand: 1, model: 1 }).lean() : null,
    booking.location_id ? Location.findOne({ id: booking.location_id }, { name: 1 }).lean() : null,
  ]);

  const customer = customerDoc as any;
  const vehicle  = vehicleDoc  as any;
  const location = locationDoc as any;

  const customerName  = customer?.full_name || 'Customer';
  const vehicleName   = vehicle  ? `${vehicle.brand} ${vehicle.model}`.trim() : 'Vehicle';
  const locationName  = location?.name || '';
  const amountStr     = formatCurrency(booking.booking_amount, location?.currency_type);
  const refundStr     = formatCurrency(booking.refund_amount || 0, location?.currency_type);
  const reason        = booking.cancellation_reason || booking.refund_notes || '—';
  const date          = new Date(booking.cancelled_at || booking.created_at).toLocaleDateString('en-IN');

  if (customer?.email) {
    const subject = mode === 'cancel'
      ? `Your car booking has been cancelled — ${vehicleName}`
      : `Refund initiated for your booking — ${vehicleName}`;

    const html = mode === 'cancel'
      ? cancellationEmailHtml({ customerName, vehicleName, locationName, amountStr, reason, date })
      : refundEmailHtml({ customerName, vehicleName, locationName, amountStr, refundStr, reason, date });

    await sendMail({ to: customer.email, subject, html }).catch(() => null);
  }

  // Get Organization Admin / sales admin emails from profiles at this location
  if (booking.location_id) {
    const adminProfiles = await Profile.find(
      { location_id: booking.location_id },
      { id: 1, full_name: 1 }
    ).lean();

    // We don't store email on Profile — skip for now (Supabase auth holds emails)
    // This is intentional: admins get in-app notifications via activity logs
    void adminProfiles; // referenced to avoid lint warning
  }
}

function cancellationEmailHtml(p: { customerName: string; vehicleName: string; locationName: string; amountStr: string; reason: string; date: string }) {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#e11d48">Booking Cancelled</h2>
  <p>Dear ${p.customerName},</p>
  <p>Your car booking has been <strong>cancelled</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Vehicle</td><td style="padding:8px;border:1px solid #eee">${p.vehicleName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Location</td><td style="padding:8px;border:1px solid #eee">${p.locationName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Booking Amount</td><td style="padding:8px;border:1px solid #eee">${p.amountStr}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Reason</td><td style="padding:8px;border:1px solid #eee">${p.reason}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Date</td><td style="padding:8px;border:1px solid #eee">${p.date}</td></tr>
  </table>
  <p>If you have questions, please contact our sales team.</p>
  <p style="color:#666;font-size:12px">This is an automated notification. Please do not reply.</p>
</div>`;
}

function refundEmailHtml(p: { customerName: string; vehicleName: string; locationName: string; amountStr: string; refundStr: string; reason: string; date: string }) {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#d97706">Refund Initiated</h2>
  <p>Dear ${p.customerName},</p>
  <p>A <strong>refund</strong> has been initiated for your car booking.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Vehicle</td><td style="padding:8px;border:1px solid #eee">${p.vehicleName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Location</td><td style="padding:8px;border:1px solid #eee">${p.locationName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Original Amount</td><td style="padding:8px;border:1px solid #eee">${p.amountStr}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Refund Amount</td><td style="padding:8px;border:1px solid #eee;color:#d97706;font-weight:bold">${p.refundStr}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Reason</td><td style="padding:8px;border:1px solid #eee">${p.reason}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Date</td><td style="padding:8px;border:1px solid #eee">${p.date}</td></tr>
  </table>
  <p>Refunds typically take 3–7 business days to reflect in your account.</p>
  <p style="color:#666;font-size:12px">This is an automated notification. Please do not reply.</p>
</div>`;
}

function paymentLinkEmailHtml(p: {
  customerName: string;
  vehicleName: string;
  locationName: string;
  amountStr: string;
  paymentModeLabel: string;
  paymentLink: string;
}) {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#2563eb">Payment Link for Your Car Booking</h2>
  <p>Dear ${p.customerName},</p>
  <p>Your payment link is ready for the <strong>${p.paymentModeLabel}</strong> of your booking.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Vehicle</td><td style="padding:8px;border:1px solid #eee">${p.vehicleName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Location</td><td style="padding:8px;border:1px solid #eee">${p.locationName}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;color:#666">Amount</td><td style="padding:8px;border:1px solid #eee">${p.amountStr}</td></tr>
  </table>
  <p>
    <a href="${p.paymentLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
      Pay Now
    </a>
  </p>
  <p>If the button does not work, use this link:</p>
  <p><a href="${p.paymentLink}">${p.paymentLink}</a></p>
  <p style="color:#666;font-size:12px">This is an automated notification. Please do not reply.</p>
</div>`;
}

// avoid unused import warning
import type { ICarBooking } from '../models/CarBooking.js';

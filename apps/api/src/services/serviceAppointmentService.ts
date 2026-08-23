import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Customer } from '../models/Customer.js';
import { Location } from '../models/Location.js';
import { LocationOperatingHour } from '../models/LocationOperatingHour.js';
import { Profile } from '../models/Profile.js';
import {
  IServiceAppointment,
  IServiceVehicleDetails,
  ServiceAppointment,
  ServiceAppointmentStatus,
} from '../models/ServiceAppointment.js';
import { createNotification } from './notificationService.js';
import { createCommunication } from './communicationService.js';
import {
  createCustomer,
  findCustomerByEmail,
  findCustomerByPhone,
  updateCustomer,
} from './customerService.js';
import { sendTransactionalEmail } from './reportEmailService.js';
import { env } from '../config/env.js';

export type ServicePackage = {
  code: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

export type ServiceBookingInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  preferred_contact?: string;
  location_id: string;
  package_code: string;
  appointment_date: string;
  appointment_time: string;
  vehicle: IServiceVehicleDetails;
};

export type RescheduleServiceInput = {
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  reason?: string;
};

export type CancelServiceInput = {
  customer_phone: string;
  reason?: string;
};

export type UpdateProgressInput = {
  status?: ServiceAppointmentStatus;
  progress_step: string;
  payment_status?: 'pending' | 'partial' | 'paid';
  assigned_service_expert_profile_id?: string | null;
  note?: string;
  updated_by_profile_id?: string;
};

const servicePackagesFile = fileURLToPath(new URL('../data/service-packages.json', import.meta.url));

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

function normalizePhone(value: string) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function normalizeRegistration(value: string) {
  return String(value || '').replace(/\s+/g, '').toUpperCase().trim();
}

function parseTimeToMinutes(time: string) {
  const [hh, mm] = String(time || '00:00').split(':').map((v) => Number(v));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return (hh * 60) + mm;
}

function minutesToTime(totalMinutes: number) {
  const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const mm = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function slotEndTime(startTime: string, durationMinutes: number) {
  const endMinutes = parseTimeToMinutes(startTime) + Math.max(15, Number(durationMinutes) || 60);
  return minutesToTime(endMinutes);
}

function sanitizeVehicle(input: IServiceVehicleDetails): IServiceVehicleDetails {
  return {
    registration_number: normalizeRegistration(input.registration_number),
    brand: String(input.brand || '').trim(),
    model: String(input.model || '').trim(),
    variant: input.variant ? String(input.variant).trim() : null,
    year: Number.isFinite(Number(input.year)) ? Number(input.year) : null,
    color: input.color ? String(input.color).trim() : null,
  };
}

function generateAppointmentNumber() {
  const stamp = Date.now().toString().slice(-8);
  const token = Math.floor(Math.random() * 9000 + 1000);
  return `SRV-${stamp}-${token}`;
}

function loadServicePackages(): ServicePackage[] {
  const raw = readFileSync(servicePackagesFile, 'utf8');
  const parsed = JSON.parse(raw) as ServicePackage[];
  return parsed.filter((pkg) => pkg.is_active !== false);
}

function getPackageByCode(code: string) {
  const normalizedCode = String(code || '').trim().toLowerCase();
  return loadServicePackages().find((pkg) => pkg.code.toLowerCase() === normalizedCode) || null;
}

async function resolveCustomerForBooking(input: ServiceBookingInput) {
  const phone = normalizePhone(input.customer_phone);
  const email = normalizeEmail(input.customer_email);

  let customer = phone ? await findCustomerByPhone(phone) : null;

  if (!customer && email) {
    customer = await findCustomerByEmail(email);
  }

  if (customer) {
    const patch: Record<string, unknown> = {};
    if (input.customer_name && input.customer_name !== customer.full_name) patch.full_name = input.customer_name;
    if (email !== customer.email) patch.email = email;
    if ((input.preferred_contact || 'phone') !== customer.preferred_contact) {
      patch.preferred_contact = input.preferred_contact || 'phone';
    }

    if (Object.keys(patch).length > 0) {
      customer = (await updateCustomer(customer.id, patch)) || customer;
    }

    return customer;
  }

  return createCustomer({
    full_name: input.customer_name,
    phone,
    email,
    preferred_contact: input.preferred_contact || 'phone',
  });
}

export async function listServicePackages() {
  return loadServicePackages();
}

export async function getServiceAvailability(locationId: string, date: string, packageCode: string) {
  const location = await Location.findOne({ id: locationId, is_active: true }, {
    id: 1,
    name: 1,
    max_concurrent_test_drives: 1,
    slot_duration_minutes: 1,
  }).lean() as any;

  if (!location) {
    throw new Error('Invalid location selected.');
  }

  const selectedPackage = getPackageByCode(packageCode);
  if (!selectedPackage) {
    throw new Error('Selected service package is not available.');
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const operatingHour = await LocationOperatingHour.findOne({
    location_id: locationId,
    day_of_week: dayOfWeek,
  }).lean() as any;

  if (operatingHour?.is_closed) {
    return {
      location,
      package: selectedPackage,
      slots: [],
      message: 'Location is closed on the selected date.',
    };
  }

  const openTime = operatingHour?.open_time || '09:00';
  const closeTime = operatingHour?.close_time || '19:00';
  const slotMinutes = Number(location.slot_duration_minutes) > 0
    ? Number(location.slot_duration_minutes)
    : 30;
  const maxPerSlot = Math.max(1, Number(location.max_concurrent_test_drives) || 4);

  const startMinutes = parseTimeToMinutes(openTime);
  const endMinutes = parseTimeToMinutes(closeTime);

  const booked = await ServiceAppointment.find({
    location_id: locationId,
    appointment_date: date,
    status: { $nin: ['cancelled'] },
  }, {
    appointment_time: 1,
  }).lean();

  const bookedCount = new Map<string, number>();
  for (const item of booked) {
    const time = String((item as any).appointment_time || '');
    if (!time) continue;
    bookedCount.set(time, (bookedCount.get(time) || 0) + 1);
  }

  const slots: Array<{ time: string; available_units: number; is_available: boolean }> = [];
  const now = new Date();
  const selectedDate = new Date(`${date}T00:00:00`);
  const sameDay = selectedDate.toDateString() === now.toDateString();
  const cutoffMinutes = parseTimeToMinutes(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);

  for (let cursor = startMinutes; cursor + selectedPackage.duration_minutes <= endMinutes; cursor += slotMinutes) {
    if (sameDay && cursor <= cutoffMinutes) continue;
    const time = minutesToTime(cursor);
    const used = bookedCount.get(time) || 0;
    const available = Math.max(0, maxPerSlot - used);
    slots.push({
      time,
      available_units: available,
      is_available: available > 0,
    });
  }

  return {
    location,
    package: selectedPackage,
    slots,
    max_per_slot: maxPerSlot,
    slot_minutes: slotMinutes,
  };
}

async function findDuplicateBooking(input: ServiceBookingInput) {
  const registration = normalizeRegistration(input.vehicle.registration_number);
  return ServiceAppointment.findOne({
    customer_phone: normalizePhone(input.customer_phone),
    location_id: input.location_id,
    appointment_date: input.appointment_date,
    appointment_time: input.appointment_time,
    'vehicle.registration_number': registration,
    status: { $nin: ['cancelled', 'completed'] },
  }).lean();
}

export async function checkDuplicateServiceBooking(input: {
  customer_phone: string;
  location_id: string;
  appointment_date: string;
  appointment_time: string;
  registration_number: string;
}) {
  const registration = normalizeRegistration(input.registration_number);
  if (!registration) return null;

  const duplicate = await ServiceAppointment.findOne({
    customer_phone: normalizePhone(input.customer_phone),
    location_id: input.location_id,
    appointment_date: input.appointment_date,
    appointment_time: input.appointment_time,
    'vehicle.registration_number': registration,
    status: { $nin: ['cancelled', 'completed'] },
  }).lean();

  return duplicate ? toPlain(duplicate) : null;
}

async function notifyLocationStaff(locationId: string, title: string, body: string, referenceId: string, type: string) {
  const recipients = await Profile.find({
    $or: [
      { location_id: locationId },
      { location_ids: { $in: [locationId] } },
    ],
    is_active: true,
  }, {
    user_id: 1,
    id: 1,
    location_id: 1,
  }).lean();

  await Promise.all(
    recipients.map((profile: any) =>
      createNotification({
        user_id: profile.user_id,
        profile_id: profile.id,
        location_id: locationId,
        title,
        body,
        type,
        reference_id: referenceId,
        reference_type: 'service_appointment',
      }),
    ),
  );
}

async function createCustomerCommunication(
  appointment: Partial<IServiceAppointment>,
  purpose: string,
  status: string,
  subject: string,
  body: string,
) {
  if (!appointment.customer_id) return;

  await createCommunication({
    id: randomUUID(),
    customer_id: appointment.customer_id,
    test_drive_id: null,
    parent_id: appointment.id,
    type: appointment.preferred_contact || 'phone',
    purpose,
    sent_to: appointment.customer_phone,
    subject,
    body,
    status,
    sent_at: new Date().toISOString(),
  });
}

async function sendServiceCustomerEmail(args: {
  event: 'created' | 'cancelled' | 'rescheduled' | 'enquiry';
  recipientEmail?: string | null;
  customerName: string;
  customerPhone?: string;
  appointmentNumber?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  packageName?: string;
  locationName?: string;
}) {
  const recipientEmail = normalizeEmail(args.recipientEmail);
  if (!recipientEmail) return;

  const templateNameByEvent: Record<typeof args.event, string> = {
    created: 'service-booking-confirmed',
    cancelled: 'service-booking-cancelled',
    rescheduled: 'service-booking-rescheduled',
    enquiry: 'service-booking-enquiry',
  };

  const normalizedPhone = normalizePhone(args.customerPhone || '');
  const manageBookingUrl = normalizedPhone
    ? `${env.publicFrontendUrl}/service-booking?${new URLSearchParams({ manage: '1', phone: normalizedPhone }).toString()}`
    : `${env.publicFrontendUrl}/service-booking?manage=1`;

  try {
    await sendTransactionalEmail({
      recipientEmail,
      templateName: templateNameByEvent[args.event],
      templateData: {
        customerName: args.customerName,
        appointmentNumber: args.appointmentNumber,
        appointmentDate: args.appointmentDate,
        appointmentTime: args.appointmentTime,
        packageName: args.packageName,
        locationName: args.locationName,
        manageBookingUrl,
      },
    });
  } catch (error) {
    console.error(`[service-booking-email] ${args.event} email failed:`, error);
  }
}

export async function createServiceBooking(input: ServiceBookingInput) {
  const selectedPackage = getPackageByCode(input.package_code);
  if (!selectedPackage) {
    throw new Error('Selected service package is not available.');
  }

  const vehicle = sanitizeVehicle(input.vehicle);
  if (!vehicle.registration_number || !vehicle.brand || !vehicle.model) {
    throw new Error('Vehicle registration, brand, and model are required.');
  }

  const duplicate = await findDuplicateBooking({ ...input, vehicle });
  if (duplicate) {
    const existing = toPlain(duplicate);
    throw new Error(`Duplicate booking detected for this vehicle and slot. Existing booking: ${existing.appointment_number}`);
  }

  const availability = await getServiceAvailability(input.location_id, input.appointment_date, selectedPackage.code);
  const matchingSlot = availability.slots.find((slot) => slot.time === input.appointment_time);

  if (!matchingSlot || !matchingSlot.is_available) {
    const customer = await resolveCustomerForBooking(input);
    const location = await Location.findOne({ id: input.location_id }, { id: 1, name: 1, city: 1 }).lean() as any;

    await createCommunication({
      id: randomUUID(),
      customer_id: customer.id,
      test_drive_id: null,
      parent_id: null,
      type: input.preferred_contact || 'phone',
      purpose: 'custom',
      sent_to: normalizeEmail(input.customer_email) || normalizePhone(input.customer_phone),
      subject: 'Service slot enquiry',
      body: `Requested slot ${input.appointment_date} ${input.appointment_time} is unavailable for ${selectedPackage.name}.`,
      status: 'pending',
      sent_at: new Date().toISOString(),
    });

    await notifyLocationStaff(
      input.location_id,
      'Service Slot Enquiry',
      `${input.customer_name} requested ${selectedPackage.name} on ${input.appointment_date} ${input.appointment_time}, but no slot was available.`,
      customer.id,
      'service_booking_enquiry',
    );

    await sendServiceCustomerEmail({
      event: 'enquiry',
      recipientEmail: input.customer_email || null,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      appointmentDate: input.appointment_date,
      appointmentTime: input.appointment_time,
      packageName: selectedPackage.name,
      locationName: location?.name || '',
    });

    throw new Error('Selected slot is unavailable. Your request has been captured as an enquiry and our team will contact you shortly.');
  }

  const customer = await resolveCustomerForBooking(input);
  const now = new Date().toISOString();

  const doc = new ServiceAppointment({
    id: randomUUID(),
    appointment_number: generateAppointmentNumber(),
    customer_id: customer?.id || null,
    customer_name: input.customer_name,
    customer_phone: normalizePhone(input.customer_phone),
    customer_email: normalizeEmail(input.customer_email),
    preferred_contact: input.preferred_contact || 'phone',
    location_id: input.location_id,
    package_code: selectedPackage.code,
    package_name: selectedPackage.name,
    package_price: selectedPackage.price,
    duration_minutes: selectedPackage.duration_minutes,
    appointment_date: input.appointment_date,
    appointment_time: input.appointment_time,
    slot_end_time: slotEndTime(input.appointment_time, selectedPackage.duration_minutes),
    status: 'booked',
    progress_step: 'booked',
    payment_status: 'pending',
    assigned_service_expert_profile_id: null,
    vehicle,
    progress_history: [{
      step: 'booked',
      note: 'Appointment created',
      updated_by_profile_id: null,
      created_at: now,
    }],
    source: 'online',
    created_at: now,
    updated_at: now,
  });

  await doc.save();

  const saved = toPlain(doc);

  await createCustomerCommunication(
    saved,
    'service_booking_created',
    'sent',
    `Service booking confirmed - ${saved.appointment_number}`,
    `Your service booking is confirmed for ${saved.appointment_date} at ${saved.appointment_time}.`,
  );

  await notifyLocationStaff(
    saved.location_id,
    'New Service Booking',
    `${saved.customer_name} booked ${saved.package_name} at ${saved.appointment_time}.`,
    saved.id,
    'service_booking_created',
  );

  const bookingLocation = await Location.findOne({ id: saved.location_id }, { id: 1, name: 1, city: 1 }).lean() as any;
  await sendServiceCustomerEmail({
    event: 'created',
    recipientEmail: saved.customer_email,
    customerName: saved.customer_name,
    customerPhone: saved.customer_phone,
    appointmentNumber: saved.appointment_number,
    appointmentDate: saved.appointment_date,
    appointmentTime: saved.appointment_time,
    packageName: saved.package_name,
    locationName: bookingLocation?.name || '',
  });

  return saved;
}

export async function listServiceBookingsByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const docs = await ServiceAppointment.find({ customer_phone: normalizedPhone })
    .sort({ appointment_date: -1, appointment_time: -1 })
    .lean();

  const locationIds = Array.from(new Set(docs.map((row: any) => row.location_id).filter(Boolean)));
  const locations = locationIds.length > 0
    ? await Location.find({ id: { $in: locationIds } }, { id: 1, name: 1, city: 1 }).lean()
    : [];
  const locationMap = new Map((locations as any[]).map((row: any) => [row.id, row]));

  return docs.map((row: any) => {
    const appointment = toPlain(row);
    const loc = locationMap.get(appointment.location_id);
    return {
      ...appointment,
      location: loc || null,
    };
  });
}

export async function getCustomerPrefillByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const customer = await findCustomerByPhone(normalizedPhone);

  const docs = await ServiceAppointment.find({ customer_phone: normalizedPhone }, {
    vehicle: 1,
    appointment_date: 1,
    appointment_time: 1,
    status: 1,
  }).sort({ appointment_date: -1, appointment_time: -1 }).lean();

  const vehicleMap = new Map<string, IServiceVehicleDetails>();
  for (const row of docs as any[]) {
    const vehicle = row.vehicle as IServiceVehicleDetails;
    if (!vehicle?.registration_number) continue;
    const key = normalizeRegistration(vehicle.registration_number);
    if (!vehicleMap.has(key)) {
      vehicleMap.set(key, vehicle);
    }
  }

  return {
    customer: customer || null,
    vehicles: Array.from(vehicleMap.values()),
    recent_bookings: (docs as any[]).slice(0, 10).map((row) => ({
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      status: row.status,
      vehicle: row.vehicle,
    })),
  };
}

export async function cancelServiceBooking(id: string, input: CancelServiceInput) {
  const appointment = await ServiceAppointment.findOne({ id }).lean();
  if (!appointment) return null;

  const normalizedPhone = normalizePhone(input.customer_phone);
  if (appointment.customer_phone !== normalizedPhone) {
    throw new Error('Customer phone does not match this appointment.');
  }

  if ((appointment as any).status === 'cancelled') {
    return toPlain(appointment);
  }

  const now = new Date().toISOString();

  const doc = await ServiceAppointment.findOneAndUpdate(
    { id },
    {
      status: 'cancelled',
      progress_step: 'cancelled',
      cancel_reason: input.reason || null,
      updated_at: now,
      $push: {
        progress_history: {
          step: 'cancelled',
          note: input.reason || 'Cancelled by customer',
          updated_by_profile_id: null,
          created_at: now,
        },
      },
    },
    { new: true },
  ).lean();

  if (!doc) return null;
  const saved = toPlain(doc);

  await createCustomerCommunication(
    saved,
    'service_booking_cancelled',
    'sent',
    `Service booking cancelled - ${saved.appointment_number}`,
    `Your service booking scheduled for ${saved.appointment_date} at ${saved.appointment_time} has been cancelled.`,
  );

  await notifyLocationStaff(
    saved.location_id,
    'Service Booking Cancelled',
    `${saved.customer_name} cancelled appointment ${saved.appointment_number}.`,
    saved.id,
    'service_booking_cancelled',
  );

  const cancelLocation = await Location.findOne({ id: saved.location_id }, { id: 1, name: 1, city: 1 }).lean() as any;
  await sendServiceCustomerEmail({
    event: 'cancelled',
    recipientEmail: saved.customer_email,
    customerName: saved.customer_name,
    customerPhone: saved.customer_phone,
    appointmentNumber: saved.appointment_number,
    appointmentDate: saved.appointment_date,
    appointmentTime: saved.appointment_time,
    packageName: saved.package_name,
    locationName: cancelLocation?.name || '',
  });

  return saved;
}

export async function rescheduleServiceBooking(id: string, input: RescheduleServiceInput) {
  const appointment = await ServiceAppointment.findOne({ id }).lean();
  if (!appointment) return null;

  const normalizedPhone = normalizePhone(input.customer_phone);
  if (appointment.customer_phone !== normalizedPhone) {
    throw new Error('Customer phone does not match this appointment.');
  }

  const currentStatus = (appointment as any).status;
  const originalAppointmentDate = (appointment as any).appointment_date || input.appointment_date;
  const originalAppointmentTime = (appointment as any).appointment_time || input.appointment_time;

  const duplicate = await ServiceAppointment.findOne({
    id: { $ne: id },
    customer_phone: normalizedPhone,
    location_id: (appointment as any).location_id,
    appointment_date: input.appointment_date,
    appointment_time: input.appointment_time,
    'vehicle.registration_number': normalizeRegistration((appointment as any).vehicle?.registration_number || ''),
    status: { $nin: ['cancelled', 'completed'] },
  }).lean();

  if (duplicate) {
    throw new Error('A booking for this slot already exists for this vehicle.');
  }

  const availability = await getServiceAvailability(
    (appointment as any).location_id,
    input.appointment_date,
    (appointment as any).package_code,
  );
  const matchingSlot = availability.slots.find((slot) => slot.time === input.appointment_time);

  if (!matchingSlot || !matchingSlot.is_available) {
    throw new Error('Selected reschedule slot is unavailable.');
  }

  const now = new Date().toISOString();
  const durationMinutes = Number((appointment as any).duration_minutes) || 60;

  const doc = await ServiceAppointment.findOneAndUpdate(
    { id },
    {
      status: 'rescheduled',
      progress_step: 'rescheduled',
      reschedule_reason: input.reason || (currentStatus === 'cancelled' ? 'Rebooked after cancellation' : null),
      original_appointment_date: (appointment as any).original_appointment_date || originalAppointmentDate,
      original_appointment_time: (appointment as any).original_appointment_time || originalAppointmentTime,
      appointment_date: input.appointment_date,
      appointment_time: input.appointment_time,
      slot_end_time: slotEndTime(input.appointment_time, durationMinutes),
      updated_at: now,
      $push: {
        progress_history: {
          step: 'rescheduled',
          note: input.reason || (currentStatus === 'cancelled' ? 'Rebooked after cancellation' : 'Rescheduled by customer'),
          updated_by_profile_id: null,
          created_at: now,
        },
      },
    },
    { new: true },
  ).lean();

  if (!doc) return null;
  const saved = toPlain(doc);

  await createCustomerCommunication(
    saved,
    'service_booking_rescheduled',
    'sent',
    `Service booking rescheduled - ${saved.appointment_number}`,
    `Your service booking is rescheduled to ${saved.appointment_date} at ${saved.appointment_time}.`,
  );

  await notifyLocationStaff(
    saved.location_id,
    'Service Booking Rescheduled',
    `${saved.customer_name} moved appointment ${saved.appointment_number} to ${saved.appointment_time}.`,
    saved.id,
    'service_booking_rescheduled',
  );

  const rescheduleLocation = await Location.findOne({ id: saved.location_id }, { id: 1, name: 1, city: 1 }).lean() as any;
  await sendServiceCustomerEmail({
    event: 'rescheduled',
    recipientEmail: saved.customer_email,
    customerName: saved.customer_name,
    customerPhone: saved.customer_phone,
    appointmentNumber: saved.appointment_number,
    appointmentDate: saved.appointment_date,
    appointmentTime: saved.appointment_time,
    packageName: saved.package_name,
    locationName: rescheduleLocation?.name || '',
  });

  return saved;
}

export async function listServiceBookings(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};

  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.customer_phone) query.customer_phone = normalizePhone(String(filters.customer_phone));
  if (filters.status) query.status = filters.status;
  if (filters.appointment_date) query.appointment_date = filters.appointment_date;

  const docs = await ServiceAppointment.find(query)
    .sort({ appointment_date: -1, appointment_time: 1 })
    .limit(300)
    .lean();

  return docs.map((row) => toPlain(row));
}

export async function updateServiceProgress(id: string, input: UpdateProgressInput) {
  if (!String(input.progress_step || '').trim()) {
    throw new Error('progress_step is required.');
  }

  const now = new Date().toISOString();
  const nextStatus = input.status || undefined;
  const paymentStatus = input.payment_status || undefined;
  const assignedServiceExpert = input.assigned_service_expert_profile_id ?? undefined;

  const doc = await ServiceAppointment.findOneAndUpdate(
    { id },
    {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      ...(assignedServiceExpert !== undefined ? { assigned_service_expert_profile_id: assignedServiceExpert } : {}),
      progress_step: input.progress_step,
      updated_at: now,
      $push: {
        progress_history: {
          step: input.progress_step,
          note: input.note || null,
          updated_by_profile_id: input.updated_by_profile_id || null,
          created_at: now,
        },
      },
    },
    { new: true },
  ).lean();

  if (!doc) return null;

  const saved = toPlain(doc);

  await createCustomerCommunication(
    saved,
    'service_booking_progress',
    'sent',
    `Service progress update - ${saved.appointment_number}`,
    `Your vehicle service status is now: ${saved.progress_step.replace(/_/g, ' ')}.${saved.payment_status ? ` Payment: ${saved.payment_status}.` : ''}`,
  );

  await notifyLocationStaff(
    saved.location_id,
    'Service Progress Updated',
    `${saved.customer_name}'s appointment ${saved.appointment_number} is now ${saved.progress_step}.`,
    saved.id,
    'service_booking_progress',
  );

  return saved;
}

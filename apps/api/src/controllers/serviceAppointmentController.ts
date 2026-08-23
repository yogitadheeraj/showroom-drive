import { Request, Response } from 'express';
import { applyLocationScope } from '../middleware/locationFilter.js';
import {
  checkDuplicateServiceBooking,
  cancelServiceBooking,
  createServiceBooking,
  getCustomerPrefillByPhone,
  getServiceAvailability,
  listServiceBookings,
  listServiceBookingsByPhone,
  listServicePackages,
  rescheduleServiceBooking,
  updateServiceProgress,
} from '../services/serviceAppointmentService.js';
import {
  requestServiceBookingOtp,
  validateServiceBookingVerificationToken,
  verifyServiceBookingOtp,
} from '../services/serviceBookingOtpService.js';

export async function listServicePackagesController(_req: Request, res: Response) {
  try {
    const data = await listServicePackages();
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function serviceAvailabilityController(req: Request, res: Response) {
  try {
    const locationId = String(req.query.location_id || '').trim();
    const date = String(req.query.date || '').trim();
    const packageCode = String(req.query.package_code || '').trim();

    if (!locationId || !date || !packageCode) {
      return res.status(400).json({ data: null, error: { message: 'location_id, date and package_code are required' } });
    }

    const data = await getServiceAvailability(locationId, date, packageCode);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function createServiceBookingController(req: Request, res: Response) {
  try {
    const data = await createServiceBooking(req.body);
    res.status(201).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const isDuplicate = /duplicate booking/i.test(message);
    res.status(isDuplicate ? 409 : 400).json({ data: null, error: { message } });
  }
}

export async function serviceBookingDuplicateCheckController(req: Request, res: Response) {
  try {
    const data = await checkDuplicateServiceBooking(req.body);
    res.status(200).json({ data: { duplicate: data }, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function serviceBookingLookupController(req: Request, res: Response) {
  try {
    const phone = String(req.query.phone || '').trim();
    const verificationToken = String(req.query.verification_token || '').trim();
    const isAuthenticatedStaff = Boolean(req.authUser?.uid);
    if (!phone) {
      return res.status(400).json({ data: null, error: { message: 'phone is required' } });
    }

    const isVerified = isAuthenticatedStaff
      ? true
      : await validateServiceBookingVerificationToken(phone, verificationToken);
    if (!isVerified) {
      return res.status(401).json({ data: null, error: { message: 'Valid verification token is required for lookup' } });
    }

    const [prefill, bookings] = await Promise.all([
      getCustomerPrefillByPhone(phone),
      listServiceBookingsByPhone(phone),
    ]);

    res.status(200).json({ data: { ...prefill, bookings }, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function cancelServiceBookingController(req: Request, res: Response) {
  try {
    const data = await cancelServiceBooking(req.params.id, req.body);
    if (!data) {
      return res.status(404).json({ data: null, error: { message: 'Service booking not found' } });
    }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function rescheduleServiceBookingController(req: Request, res: Response) {
  try {
    const data = await rescheduleServiceBooking(req.params.id, req.body);
    if (!data) {
      return res.status(404).json({ data: null, error: { message: 'Service booking not found' } });
    }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function listServiceBookingsController(req: Request, res: Response) {
  try {
    const filters: Record<string, unknown> = { ...(req.query as Record<string, unknown>) };
    applyLocationScope(req, filters);
    const data = await listServiceBookings(filters);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function updateServiceProgressController(req: Request, res: Response) {
  try {
    const payload = {
      ...req.body,
      updated_by_profile_id: req.authUser?.profile_id || req.body?.updated_by_profile_id || null,
    };

    const data = await updateServiceProgress(req.params.id, payload);
    if (!data) {
      return res.status(404).json({ data: null, error: { message: 'Service booking not found' } });
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function requestServiceBookingOtpController(req: Request, res: Response) {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ data: null, error: { message: 'phone is required' } });
    }

    const data = await requestServiceBookingOtp(phone);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function verifyServiceBookingOtpController(req: Request, res: Response) {
  try {
    const phone = String(req.body?.phone || '').trim();
    const otp = String(req.body?.otp || '').trim();
    if (!phone || !otp) {
      return res.status(400).json({ data: null, error: { message: 'phone and otp are required' } });
    }

    const data = await verifyServiceBookingOtp(phone, otp);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

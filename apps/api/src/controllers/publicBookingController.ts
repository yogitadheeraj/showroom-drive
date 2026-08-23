import { Request, Response } from 'express';
import { z } from 'zod';
import { createPublicTestDrive } from '../services/testDriveService.js';

const preferredContactValueSchema = z.string().transform((value) => {
  const normalized = String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .filter((part) => ['phone', 'email', 'whatsapp'].includes(part));

  if (!normalized.length) return 'phone';
  if (normalized.length === 3) return 'all';
  return normalized.join(',');
});

const publicBookingSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  phone: z.string().min(5, 'Phone is required'),
  email: z.string().email().nullable().optional(),
  preferred_contact: preferredContactValueSchema.default('phone'),
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  location_id: z.string().min(1, 'Location is required'),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}/, 'Time must be HH:MM'),
  slot_duration_minutes: z.number().int().positive().optional(),
});

export async function publicBookTestDriveController(req: Request, res: Response) {
  try {
    const body = publicBookingSchema.parse(req.body);
    const result = await createPublicTestDrive(body);
    res.status(201).json({ data: result, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Booking failed';
    res.status(400).json({ data: null, error: { message } });
  }
}

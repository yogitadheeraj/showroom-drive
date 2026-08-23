import { Request, Response } from 'express';
import { Brand } from '../models/Brand.js';
import { Customer } from '../models/Customer.js';
import { ServiceAppointment } from '../models/ServiceAppointment.js';
import { TestDrive } from '../models/TestDrive.js';
import { Vehicle } from '../models/Vehicle.js';

export async function publicLandingStatsController(req: Request, res: Response) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [
      availableVehicles,
      scheduledDrives,
      completedDrives,
      totalBrands,
      totalLeads,
      serviceBookingsTotal,
      serviceBookingsBooked,
      serviceBookingsConfirmed,
      serviceBookingsInProgress,
      serviceBookingsCompleted,
      serviceBookingsToday,
      serviceBookingsCancelled,
      serviceBookingsRescheduled,
    ] = await Promise.all([
      Vehicle.countDocuments({ is_active: true }),
      TestDrive.countDocuments({ status: 'scheduled' }),
      TestDrive.countDocuments({ status: 'completed' }),
      Brand.countDocuments({}),
      Customer.countDocuments({}),
      ServiceAppointment.countDocuments({}),
      ServiceAppointment.countDocuments({ status: 'booked' }),
      ServiceAppointment.countDocuments({ status: 'confirmed' }),
      ServiceAppointment.countDocuments({ status: { $in: ['in_progress', 'ready_for_delivery'] } }),
      ServiceAppointment.countDocuments({ status: 'completed' }),
      ServiceAppointment.countDocuments({ appointment_date: today }),
      ServiceAppointment.countDocuments({ status: 'cancelled' }),
      ServiceAppointment.countDocuments({ status: 'rescheduled' }),
    ]);

    res.status(200).json({
      data: {
        availableVehicles,
        testDrivesScheduled: scheduledDrives,
        testDrivesCompleted: completedDrives,
        totalBrands,
        salesToday: 0,
        totalLeads,
        serviceBookingsTotal,
        serviceBookingsBooked,
        serviceBookingsConfirmed,
        serviceBookingsInProgress,
        serviceBookingsCompleted,
        serviceBookingsToday,
        serviceBookingsCancelled,
        serviceBookingsRescheduled,
      },
      error: null,
    });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

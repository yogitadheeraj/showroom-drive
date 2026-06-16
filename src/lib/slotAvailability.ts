import { apiDbQuery, apiGet } from '@/lib/apiClient';

/**
 * Generate available time slots for a given date and location
 */
export async function getAvailableTimeSlots(
  locationId: string,
  selectedDate: string, // YYYY-MM-DD format
  slotDurationMinutes: number = 30
) {
  try {
    // Get location operating hours for this day
    const dayOfWeek = new Date(selectedDate).getDay();
    // Use the proper API endpoint (not apiDbQuery) to avoid auth-scope filter overriding location_id
    const hoursRows = await apiGet<any[]>(
      `/api/location-operating-hours?location_id=${encodeURIComponent(locationId)}&day_of_week=${dayOfWeek}`
    );
    const operatingHours = Array.isArray(hoursRows) ? hoursRows[0] : hoursRows;

    if (!operatingHours) {
      return { slots: [], error: 'Operating hours not found for this day' };
    }

    if (operatingHours.is_closed) {
      return { slots: [], error: 'Location closed on this day' };
    }

    // Check for special periods (closures/breaks)
    // Use the proper API endpoint (not apiDbQuery) to avoid auth-scope filter overriding location_id
    const specialPeriods = await apiGet<any[]>(
      `/api/location-special-periods?location_id=${encodeURIComponent(locationId)}&start_date=${selectedDate}&end_date=${selectedDate}`
    );

    let openTime = operatingHours.open_time;
    let closeTime = operatingHours.close_time;
    let isClosed = false;

    if (specialPeriods && specialPeriods.length > 0) {
      const activePeriod = specialPeriods[0];
      if (activePeriod.is_full_closure) {
        isClosed = true;
      } else if (activePeriod.modified_open_time && activePeriod.modified_close_time) {
        openTime = activePeriod.modified_open_time;
        closeTime = activePeriod.modified_close_time;
      }
    }

    if (isClosed) {
      return { slots: [], error: 'Location closed on this date' };
    }

    // Parse times
    const [openHour, openMin] = openTime.substring(0, 5).split(':').map(Number);
    const [closeHour, closeMin] = closeTime.substring(0, 5).split(':').map(Number);

    const openTimeInMinutes = openHour * 60 + openMin;
    const closeTimeInMinutes = closeHour * 60 + closeMin;

    // Generate all possible slots
    const allSlots = [];
    for (let time = openTimeInMinutes; time + slotDurationMinutes <= closeTimeInMinutes; time += slotDurationMinutes) {
      const startHour = Math.floor(time / 60);
      const startMin = time % 60;
      const endTime = time + slotDurationMinutes;
      const endHour = Math.floor(endTime / 60);
      const endMin = endTime % 60;

      const startStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      allSlots.push({
        startTime: startStr,
        endTime: endStr,
        startMinutes: time,
        endMinutes: endTime,
      });
    }

    // Get existing bookings and blocked slots for this date in parallel
    const [existingBookings, blockedSlots] = await Promise.all([
      apiDbQuery<any[]>({
        table: 'test_drives',
        action: 'select',
        select: 'scheduled_time, slot_duration_minutes',
        filters: [
          { field: 'location_id', op: 'eq', value: locationId },
          { field: 'scheduled_date', op: 'eq', value: selectedDate },
          { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show', 'in_progress'] },
        ],
      }),
      apiDbQuery<any[]>({
        table: 'location_blocked_slots',
        action: 'select',
        select: 'start_time, end_time',
        filters: [
          { field: 'location_id', op: 'eq', value: locationId },
          { field: 'blocked_date', op: 'eq', value: selectedDate },
        ],
      }),
    ]);

    // Filter out slots that conflict with existing bookings or blocked windows
    const availableSlots = allSlots.filter(slot => {
      // Check existing test-drive bookings
      const hasBookingConflict = existingBookings?.some(booking => {
        if (!booking.scheduled_time) return false;
        const [bookHour, bookMin] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
        const bookingStartMinutes = bookHour * 60 + bookMin;
        const bookingEndMinutes = bookingStartMinutes + (booking.slot_duration_minutes || 30);
        return !(slot.endMinutes <= bookingStartMinutes || slot.startMinutes >= bookingEndMinutes);
      });

      if (hasBookingConflict) return false;

      // Check manually blocked slots
      const hasBlockConflict = blockedSlots?.some(blocked => {
        const [bStartHour, bStartMin] = blocked.start_time.substring(0, 5).split(':').map(Number);
        const [bEndHour, bEndMin] = blocked.end_time.substring(0, 5).split(':').map(Number);
        const blockStartMinutes = bStartHour * 60 + bStartMin;
        const blockEndMinutes = bEndHour * 60 + bEndMin;
        return !(slot.endMinutes <= blockStartMinutes || slot.startMinutes >= blockEndMinutes);
      });

      return !hasBlockConflict;
    });

    return { slots: availableSlots, error: null };
  } catch (error: any) {
    return { slots: [], error: error.message };
  }
}

/**
 * Get available vehicles for a specific time slot at a location
 */
export async function getAvailableVehicles(
  locationId: string,
  selectedDate: string,
  slotStartTime: string,
  slotDurationMinutes: number = 30
) {
  try {
    const vehicles = await apiDbQuery<any[]>({
      table: 'vehicles',
      action: 'select',
      select: 'id, brand, model, variant, year, available_units',
      filters: [
        { field: 'location_id', op: 'eq', value: locationId },
        { field: 'is_active', op: 'eq', value: true },
      ],
    });

    if (!vehicles) {
      return { vehicles: [], error: 'Failed to fetch vehicles' };
    }

    // Parse slot time
    const [slotHour, slotMin] = slotStartTime.split(':').map(Number);
    const slotStartMinutes = slotHour * 60 + slotMin;
    const slotEndMinutes = slotStartMinutes + slotDurationMinutes;

    // Get existing bookings for this time slot
    const bookings = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: 'vehicle_id, scheduled_time, slot_duration_minutes',
      filters: [
        { field: 'location_id', op: 'eq', value: locationId },
        { field: 'scheduled_date', op: 'eq', value: selectedDate },
        { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show', 'in_progress'] },
      ],
    });

    // Count bookings per vehicle that conflict with this slot
    const vehicleBookingCounts: Record<string, number> = {};
    bookings?.forEach(booking => {
      if (!booking.vehicle_id || !booking.scheduled_time) return;

      const [bookHour, bookMin] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
      const bookingStartMinutes = bookHour * 60 + bookMin;
      const bookingEndMinutes = bookingStartMinutes + (booking.slot_duration_minutes || 30);

      // Check if booking overlaps with requested slot
      if (!(slotEndMinutes <= bookingStartMinutes || slotStartMinutes >= bookingEndMinutes)) {
        vehicleBookingCounts[booking.vehicle_id] = (vehicleBookingCounts[booking.vehicle_id] || 0) + 1;
      }
    });

    // Mark vehicles as available/unavailable
    const vehiclesWithAvailability = vehicles.map(vehicle => {
      const bookedCount = vehicleBookingCounts[vehicle.id] || 0;
      const availableCount = (vehicle.available_units || 1) - bookedCount;

      return {
        ...vehicle,
        availableForSlot: availableCount > 0,
        bookedCount,
        availableCount: Math.max(0, availableCount),
      };
    });

    return { vehicles: vehiclesWithAvailability, error: null };
  } catch (error: any) {
    return { vehicles: [], error: error.message };
  }
}

/**
 * Check and auto-release no-show bookings for a date
 */
export async function checkAndReleaseNoShowBookings(
  locationId?: string,
  selectedDate?: string
) {
  try {
    const now = new Date();
    const dateToCheck = selectedDate || now.toISOString().split('T')[0];
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    const filters: Array<{ field: string; op: any; value: unknown }> = [
      { field: 'scheduled_date', op: 'eq', value: dateToCheck },
      { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show'] },
    ];
    if (locationId) {
      filters.push({ field: 'location_id', op: 'eq', value: locationId });
    }

    const bookings = await apiDbQuery<any[]>({
      table: 'test_drives',
      action: 'select',
      select: 'id, scheduled_time, slot_duration_minutes, status',
      filters,
    });

    // Find bookings that have passed their slot time
    const noShowBookings = bookings?.filter(booking => {
      if (!booking.scheduled_time) return false;

      const [hour, min] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
      const bookingStartMinutes = hour * 60 + min;
      const bookingEndMinutes = bookingStartMinutes + (booking.slot_duration_minutes || 30);

      // If current time is past booking end time, it's a no-show
      return currentTimeMinutes > bookingEndMinutes;
    }) || [];

    // Update no-show bookings
    if (noShowBookings.length > 0) {
      try {
        await apiDbQuery({
          table: 'test_drives',
          action: 'update',
          payload: { status: 'no_show' },
          filters: [{ field: 'id', op: 'in', value: noShowBookings.map((b: any) => b.id) }],
        });
      } catch (updateError: any) {
        console.error('Failed to mark no-show bookings:', updateError);
        return { released: 0, error: updateError.message };
      }

      return { released: noShowBookings.length, error: null };
    }

    return { released: 0, error: null };
  } catch (error: any) {
    console.error('Error checking no-show bookings:', error);
    return { released: 0, error: error.message };
  }
}

/**
 * Format time slot display
 */
export function formatTimeSlot(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

/**
 * Check if a location is currently open
 */
export async function isLocationCurrentlyOpen(locationId: string) {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    // Get operating hours for today using the proper API endpoint to avoid
    // auth-scope middleware replacing location_id with IN [all dealer locations]
    const hoursRows = await apiGet<any[]>(
      `/api/location-operating-hours?location_id=${encodeURIComponent(locationId)}&day_of_week=${dayOfWeek}`
    );
    const operatingHours = Array.isArray(hoursRows) ? hoursRows[0] : hoursRows;

    if (!operatingHours) {
      return { isOpen: false, openTime: null, closeTime: null, error: 'Operating hours not found' };
    }

    if (operatingHours.is_closed) {
      return { isOpen: false, openTime: null, closeTime: null, error: 'Location is closed today' };
    }

    // Check for special periods (closures/breaks)
    const today = now.toISOString().split('T')[0];
    // Use the proper API endpoint to avoid auth-scope overrides
    const specialPeriods = await apiGet<any[]>(
      `/api/location-special-periods?location_id=${encodeURIComponent(locationId)}&start_date=${today}&end_date=${today}`
    );

    let openTime = operatingHours.open_time;
    let closeTime = operatingHours.close_time;

    if (specialPeriods && specialPeriods.length > 0) {
      const activePeriod = specialPeriods[0];
      if (activePeriod.is_full_closure) {
        return { isOpen: false, openTime: null, closeTime: null, error: 'Location is closed today (special closure)' };
      }
      if (activePeriod.modified_open_time && activePeriod.modified_close_time) {
        openTime = activePeriod.modified_open_time;
        closeTime = activePeriod.modified_close_time;
      }
    }

    // Parse times
    const [openHour, openMin] = openTime.substring(0, 5).split(':').map(Number);
    const [closeHour, closeMin] = closeTime.substring(0, 5).split(':').map(Number);

    const openTimeInMinutes = openHour * 60 + openMin;
    const closeTimeInMinutes = closeHour * 60 + closeMin;

    const isOpen = currentTimeMinutes >= openTimeInMinutes && currentTimeMinutes < closeTimeInMinutes;

    return {
      isOpen,
      openTime: openTime.substring(0, 5),
      closeTime: closeTime.substring(0, 5),
      error: null,
    };
  } catch (error: any) {
    return { isOpen: false, openTime: null, closeTime: null, error: error.message };
  }
}

/**
 * Re-check if a specific vehicle is still available for a given slot just before booking.
 * Returns { available: true } when the vehicle has remaining units, { available: false, reason } when fully booked.
 */
export async function checkVehicleSlotAvailable(
  vehicleId: string,
  scheduledDate: string,
  scheduledTime: string,
  slotDurationMinutes: number = 30,
): Promise<{ available: boolean; reason?: string }> {
  try {
    const [vehicleRows, bookings] = await Promise.all([
      apiDbQuery<any[]>({
        table: 'vehicles',
        action: 'select',
        select: 'available_units',
        filters: [{ field: 'id', op: 'eq', value: vehicleId }],
        limit: 1,
      }),
      apiDbQuery<any[]>({
        table: 'test_drives',
        action: 'select',
        select: 'scheduled_time, slot_duration_minutes',
        filters: [
          { field: 'vehicle_id', op: 'eq', value: vehicleId },
          { field: 'scheduled_date', op: 'eq', value: scheduledDate },
          { field: 'status', op: 'in', value: ['scheduled', 'confirmed', 'show', 'in_progress'] },
        ],
      }),
    ]);

    const vehicle = Array.isArray(vehicleRows) ? vehicleRows[0] : vehicleRows;
    const availableUnits = vehicle?.available_units ?? 1;

    const [reqHour, reqMin] = scheduledTime.substring(0, 5).split(':').map(Number);
    const reqStart = reqHour * 60 + reqMin;
    const reqEnd = reqStart + slotDurationMinutes;

    let bookedCount = 0;
    (bookings ?? []).forEach((booking: any) => {
      if (!booking.scheduled_time) return;
      const [bHour, bMin] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
      const bStart = bHour * 60 + bMin;
      const bEnd = bStart + (booking.slot_duration_minutes || 30);
      if (!(reqEnd <= bStart || reqStart >= bEnd)) bookedCount++;
    });

    if (bookedCount >= availableUnits) {
      return {
        available: false,
        reason: 'This vehicle is no longer available for the selected time slot. Please choose a different slot or vehicle.',
      };
    }
    return { available: true };
  } catch (error: any) {
    return { available: false, reason: error.message };
  }
}

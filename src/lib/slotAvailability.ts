import { supabase } from '@/integrations/supabase/client';

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
    const { data: operatingHours, error: hoursError } = await supabase
      .from('location_operating_hours')
      .select('open_time, close_time, is_closed')
      .eq('location_id', locationId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (hoursError || !operatingHours) {
      return { slots: [], error: 'Operating hours not found for this day' };
    }

    if (operatingHours.is_closed) {
      return { slots: [], error: 'Location closed on this day' };
    }

    // Check for special periods (closures/breaks)
    const { data: specialPeriods } = await supabase
      .from('location_special_periods')
      .select('is_full_closure, modified_open_time, modified_close_time')
      .eq('location_id', locationId)
      .lte('start_date', selectedDate)
      .gte('end_date', selectedDate);

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

    // Get existing bookings for this date
    const { data: existingBookings } = await supabase
      .from('test_drives')
      .select('scheduled_time, slot_duration_minutes')
      .eq('location_id', locationId)
      .eq('scheduled_date', selectedDate)
      .in('status', ['scheduled', 'confirmed', 'show', 'in_progress']);

    // Check for no-show bookings that have passed (should be released)
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    // Filter out slots that conflict with existing bookings
    const availableSlots = allSlots.filter(slot => {
      const hasConflict = existingBookings?.some(booking => {
        if (!booking.scheduled_time) return false;
        const [bookHour, bookMin] = booking.scheduled_time.substring(0, 5).split(':').map(Number);
        const bookingStartMinutes = bookHour * 60 + bookMin;
        const bookingEndMinutes = bookingStartMinutes + (booking.slot_duration_minutes || 30);

        // Check if slot overlaps with booking
        return !(slot.endMinutes <= bookingStartMinutes || slot.startMinutes >= bookingEndMinutes);
      });

      return !hasConflict;
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
    // Get all vehicles at this location
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, brand, model, variant, year, available_units')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (vehiclesError || !vehicles) {
      return { vehicles: [], error: 'Failed to fetch vehicles' };
    }

    // Parse slot time
    const [slotHour, slotMin] = slotStartTime.split(':').map(Number);
    const slotStartMinutes = slotHour * 60 + slotMin;
    const slotEndMinutes = slotStartMinutes + slotDurationMinutes;

    // Get existing bookings for this time slot
    const { data: bookings } = await supabase
      .from('test_drives')
      .select('vehicle_id, scheduled_time, slot_duration_minutes')
      .eq('location_id', locationId)
      .eq('scheduled_date', selectedDate)
      .in('status', ['scheduled', 'confirmed', 'show', 'in_progress']);

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

    let query = supabase
      .from('test_drives')
      .select('id, scheduled_time, slot_duration_minutes, status')
      .eq('scheduled_date', dateToCheck)
      .in('status', ['scheduled', 'confirmed', 'show']);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data: bookings } = await query;

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
      const { error } = await supabase
        .from('test_drives')
        .update({ status: 'no_show' as any })
        .in(
          'id',
          noShowBookings.map(b => b.id)
        );

      if (error) {
        console.error('Failed to mark no-show bookings:', error);
        return { released: 0, error: error.message };
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

    // Get operating hours for today
    const { data: operatingHours, error: hoursError } = await supabase
      .from('location_operating_hours')
      .select('open_time, close_time, is_closed')
      .eq('location_id', locationId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (hoursError || !operatingHours) {
      return { isOpen: false, openTime: null, closeTime: null, error: 'Operating hours not found' };
    }

    if (operatingHours.is_closed) {
      return { isOpen: false, openTime: null, closeTime: null, error: 'Location is closed today' };
    }

    // Check for special periods (closures/breaks)
    const today = now.toISOString().split('T')[0];
    const { data: specialPeriods } = await supabase
      .from('location_special_periods')
      .select('is_full_closure, modified_open_time, modified_close_time')
      .eq('location_id', locationId)
      .lte('start_date', today)
      .gte('end_date', today);

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

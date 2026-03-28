# BookingPage Enhancement Guide

## Overview
This guide shows how to integrate the slot availability system into the existing BookingPage.

## Current BookingPage Structure
```
1. Dealer Selection (if superadmin)
2. Location Selection
3. Preferred Date Picker (with disabled dates)
4. Vehicle Selection
5. Personal Details
6. Confirmation
```

## New Structure with Slots
```
1. Dealer Selection
2. Location Selection  
3. Preferred Date Picker
4. ➕ TIME SLOT SELECTION (NEW)
5. ➕ VEHICLE AVAILABILITY FOR SLOT (UPDATED)
6. Personal Details
7. Confirmation
```

---

## Implementation Steps

### Step 1: Import Slot Utilities
```tsx
import { 
  getAvailableTimeSlots, 
  getAvailableVehicles,
  checkAndReleaseNoShowBookings 
} from '@/lib/slotAvailability';
```

### Step 2: Add State Variables
```tsx
const [selectedDate, setSelectedDate] = useState<string>('');
const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
const [availableSlots, setAvailableSlots] = useState<any[]>([]);
const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
const [loadingSlots, setLoadingSlots] = useState(false);
const [loadingVehicles, setLoadingVehicles] = useState(false);
```

### Step 3: Fetch Slots When Date Changes
```tsx
useEffect(() => {
  if (!selectedLocation || !selectedDate) {
    setAvailableSlots([]);
    return;
  }

  const loadSlots = async () => {
    setLoadingSlots(true);
    
    // Get location slot duration
    const { data: location } = await supabase
      .from('locations')
      .select('metadata')
      .eq('id', selectedLocation)
      .single();
    
    const duration = location?.metadata?.slot_duration_minutes || 30;
    setSlotDurationMinutes(duration);

    // Check for no-show bookings first
    await checkAndReleaseNoShowBookings(selectedLocation, selectedDate);

    // Get available slots
    const { slots, error } = await getAvailableTimeSlots(
      selectedLocation,
      selectedDate,
      duration
    );

    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      setAvailableSlots([]);
    } else {
      setAvailableSlots(slots);
    }
    
    setLoadingSlots(false);
  };

  loadSlots();
}, [selectedLocation, selectedDate]);
```

### Step 4: Fetch Vehicles When Time Slot Changes
```tsx
useEffect(() => {
  if (!selectedLocation || !selectedDate || !selectedTimeSlot) {
    setAvailableVehicles([]);
    return;
  }

  const loadVehicles = async () => {
    setLoadingVehicles(true);

    const { vehicles, error } = await getAvailableVehicles(
      selectedLocation,
      selectedDate,
      selectedTimeSlot,
      slotDurationMinutes
    );

    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      setAvailableVehicles([]);
    } else {
      setAvailableVehicles(vehicles);
    }

    setLoadingVehicles(false);
  };

  loadVehicles();
}, [selectedLocation, selectedDate, selectedTimeSlot]);
```

### Step 5: Add Time Slot Selection UI (After Date Picker)
```tsx
{selectedDate && (
  <div className="space-y-2">
    <Label>Select Time Slot *</Label>
    <p className="text-xs text-muted-foreground">
      Slot duration: {slotDurationMinutes} minutes
    </p>
    
    {loadingSlots ? (
      <div className="text-center py-4 text-muted-foreground">Loading available slots...</div>
    ) : availableSlots.length === 0 ? (
      <div className="text-center py-4 text-muted-foreground">
        No available slots for this date. Try another date.
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {availableSlots.map((slot, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedTimeSlot(slot.startTime)}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              selectedTimeSlot === slot.startTime
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="font-semibold">{slot.startTime}</div>
            <div className="text-xs opacity-75">to {slot.endTime}</div>
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

### Step 6: Update Vehicle Selection UI
```tsx
{selectedTimeSlot && (
  <div className="space-y-2">
    <Label>Select Vehicle *</Label>
    <p className="text-xs text-muted-foreground">
      Available vehicles for {selectedDate} at {selectedTimeSlot}
    </p>
    
    {loadingVehicles ? (
      <div className="text-center py-4 text-muted-foreground">Checking vehicle availability...</div>
    ) : availableVehicles.length === 0 ? (
      <div className="text-center py-4 text-destructive">
        No vehicles available for this time slot. Try another slot.
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {availableVehicles.map(vehicle => (
          <div
            key={vehicle.id}
            onClick={() => setSelectedVehicleId(vehicle.id)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              selectedVehicleId === vehicle.id
                ? 'border-primary bg-primary/10'
                : vehicle.availableForSlot
                  ? 'border-border bg-card hover:border-primary/50'
                  : 'border-destructive bg-destructive/5 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">{vehicle.brand} {vehicle.model}</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.variant || 'Standard'} • {vehicle.year}
                </p>
              </div>
              <Badge
                variant={vehicle.availableForSlot ? 'default' : 'destructive'}
                className="text-xs"
              >
                {vehicle.availableForSlot ? '✓ Available' : '✗ Booked'}
              </Badge>
            </div>
            {!vehicle.availableForSlot && (
              <p className="text-xs text-destructive mt-2">
                {vehicle.bookedCount} bookings at this time
              </p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### Step 7: Update Booking Submission
```tsx
const handleBooking = async () => {
  // ... validation ...

  // Set slot duration from location config
  const bookingData = {
    // ... existing fields ...
    scheduled_date: selectedDate,
    scheduled_time: selectedTimeSlot,
    slot_duration_minutes: slotDurationMinutes,
    // ... other fields ...
  };

  // Submit booking
  const { error } = await supabase
    .from('test_drives')
    .insert(bookingData);

  if (error) {
    toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
  } else {
    toast({ title: 'Booking confirmed!', description: `${selectedDate} at ${selectedTimeSlot}` });
    // Redirect or reset form
  }
};
```

---

## Example: Time Slots Display

### Scenario
- Location: Downtown Showroom
- Slot Duration: 30 minutes
- Operating Hours: 09:00 - 18:00
- Existing Bookings:
  - 10:00-10:30 (Toyota Fortuner)
  - 10:30-11:00 (Honda CR-V, vehicle_id_2)
  - 11:00-11:30 (All vehicles booked)

### Available Slots Shown:
```
09:00 ✓    09:30 ✓
10:00 ✗    10:30 ✗
11:00 ✗    11:30 ✓
12:00 ✓    12:30 ✓
... (continues until 17:30)
```

### Vehicle Availability for 10:00 Slot:
```
😞 All vehicles currently booked for this slot
   - Toyota Fortuner: Booked
   - Honda CR-V: Available but has late overlap
   - Hyundai Creta: Available ✓
   - Maruti Swift: Available ✓
```

---

## Testing Checklist

- [ ] Slots generate correctly for location operating hours
- [ ] Slot duration respects location config
- [ ] Existing bookings block corresponding slots
- [ ] No-show bookings are released after slot time passes
- [ ] Vehicle availability updates when time slot changes
- [ ] Booking submission includes slot_duration_minutes
- [ ] Mobile responsive - slots display in grid
- [ ] Edge cases: Closed days, special periods, zero slots available

---

## Performance Optimization

### Queries to Monitor:
1. `getAvailableTimeSlots` - Should be fast (<500ms)
2. `getAvailableVehicles` - Should be fast (<500ms)
3. `checkAndReleaseNoShowBookings` - Run on demand, not on every load

### Caching Strategy:
- Cache slot configuration per location for 1 hour
- Cache available slots for 2 minutes (user bookings are rare)
- No cache for vehicle availability (real-time check needed)

### Index Impact:
- Queries should use `idx_test_drives_slot_availability`
- Monitor query performance on locations with 1000+ daily bookings

---

## Future Enhancements

1. Recurring time slots (same time daily)
2. Slot availability calendar heatmap
3. Vehicle slot reservations (pre-block slots)
4. Automatic SMS/Email when slot becomes available
5. Waitlist for fully booked slots

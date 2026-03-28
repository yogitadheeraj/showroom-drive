# Vehicle Slot Management System

## Overview
This document outlines the vehicle slot booking system for test drives with automatic no-show handling.

## Features Implemented

### 1. Slot Duration Configuration (✅ DONE)
- **Location**: Locations page → Each location card has "Slot Duration" button
- **Options**: 15min, 30min, 45min, 60min, 90min, 120min
- **Storage**: Saved in `locations.metadata.slot_duration_minutes`
- **Default**: 30 minutes

### Example Flow:
- Admin sets Location A to 30-minute slots
- Admin sets Location B to 60-minute slots
- BookingPage respects these durations when showing available times

---

## Features to Implement

### 2. Available Time Slots Display (TODO)
**Where**: BookingPage.tsx - After date & location selection

**Logic**:
```
For each operating hour (e.g., 09:00-18:00):
  - Divide into slots of X minutes (from location config)
  - Slots: 09:00, 09:30, 10:00, 10:30... (for 30min duration)
  - Check if slot conflicts with existing bookings
  - Hide slot if any existing booking blocks it
  
Example (30min slots, 09:00-18:00):
  09:00 ✓ Available
  09:30 ✓ Available
  10:00 ✗ Booked (existing booking 09:45-10:15)
  10:30 ✓ Available
  ...
```

### 3. Vehicle Availability Checker (TODO)
**Where**: BookingPage.tsx - Show available vehicles for selected slot

**Logic**:
```
When user selects: Location + Date + Time Slot

1. Get all vehicles at location
2. For each vehicle:
   - Check existing bookings that overlap with slot time
   - Mark as "Available" if no conflicts
   - Mark as "Booked" if conflict exists
   - Mark as "No-show (Hold)" if previous booking exceeded duration

Example Output:
  - Toyota Fortuner 2024 ✓ Available for 10:00-10:30
  - Hyundai Creta 2023 ✗ Booked (10:15-10:45 booking)
  - Honda CR-V 2022 ⏱️ No-show Hold (previous booking ended at 10:45)
```

### 4. No-Show Auto-Release (TODO)
**Where**: Real-time check during booking page load & through a scheduled job

**Current Behavior**:
```
Booking slot: 10:00-10:30
- If current time > 10:30 AND booking status ≠ 'completed':
  → Auto-mark as 'no_show'
  → Vehicle becomes available
```

**How to Implement**:
1. Add `no_show_check_at` field to test_drives table
2. In BookingPage load - query and update:
   ```sql
   UPDATE test_drives 
   SET status = 'no_show', no_show_checked_at = now()
   WHERE scheduled_date::date = today
     AND scheduled_time + slot_duration > now()
     AND status NOT IN ('completed', 'no_show', 'cancelled')
   ```
3. Optional: Supabase Edge Function for automatic cleanup

---

## Database Updates Needed

### 1. Locations Table (Already supported via metadata)
```
metadata->>'slot_duration_minutes' = '30'
```

### 2. Test Drives Table - Add Columns
```sql
ALTER TABLE test_drives ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30;
ALTER TABLE test_drives ADD COLUMN IF NOT EXISTS no_show_checked_at TIMESTAMP;
```

### 3. Create Index for Performance
```sql
CREATE INDEX idx_test_drives_slot_availability 
ON test_drives(location_id, scheduled_date, scheduled_time);
```

---

## Booking Page Changes Required

### Current State
- Date picker (✓ with smart disabled dates)
- Time picker (✗ needs to show available slots)
- Vehicle selector (✗ needs to check availability)

### New State
1. **Date Selection** → Select from available dates
2. **Time Slot Selection** → Show grid of available slots based on operating hours + slot duration
3. **Vehicle Selection** → Filter by location and available for that time slot
4. **Confirmation** → Show slot details: "Toyota Fortuner - 10:00-10:30 on Mar 30, 2026"

---

## Implementation Checklist

- [ ] Add slot duration button to Locations page ✅
- [ ] Load slot durations from location metadata ✅
- [ ] Add columns to test_drives table
- [ ] Create time slot generation function in BookingPage
- [ ] Implement vehicle availability checker
- [ ] Add no-show auto-detection logic
- [ ] Create Supabase RLS policies for slot queries
- [ ] Add test drive booking with slot details
- [ ] Create Edge Function for scheduled no-show cleanup

---

## Example: 30-Minute Slots at a Location

**Location Operating Hours**: 09:00 - 18:00 (9 hours = 540 minutes)
**Slot Duration**: 30 minutes
**Total Slots Per Day**: 18 slots

```
09:00 - 09:30
09:30 - 10:00
10:00 - 10:30
10:30 - 11:00
... (18 slots total) ...
17:30 - 18:00
```

**If someone books 10:00-10:30**:
- Vehicle blocked for 10:00 slot
- If not shown by 10:30, status → 'no_show'
- Vehicle available again for 10:30 slot

---

## No-Show Examples

| Scenario | Booking Time | Current Time | Action |
|----------|--------------|--------------|--------|
| User shows up | 10:00-10:30 | 10:15 | ✓ Status: in_progress |
| User late but within slot | 10:00-10:30 | 10:29 | ✓ Still bookable as in_progress |
| User didn't show | 10:00-10:30 | 10:35 | ⏱️ Auto-mark no_show, vehicle released |
| User still ongoing | 10:00-10:30 | 10:20 | ⏳ Booking continues |

---

## Files to Modify

1. ✅ **LocationsPage.tsx** - Slot duration config added
2. **BookingPage.tsx** - Add slot display & vehicle availability
3. **supabase/migrations/** - Add new columns & functions
4. **src/lib/slotAvailability.ts** - New utility for slot logic
5. **src/integrations/supabase/types.ts** - Update types

---

## Next Steps

1. Create migration for test_drives columns
2. Build slot availability utility function
3. Update BookingPage to display available slots
4. Add vehicle filtering logic
5. Test with sample bookings

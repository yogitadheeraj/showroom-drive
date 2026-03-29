# Report Configuration System - Setup Guide

## Overview
Complete test drive and activity report system with configurable email recipients and automated scheduling.

---

## Database Schema

### 1. **report_email_config** Table
Stores which email addresses receive which reports for each location.

**Columns:**
- `id` (uuid): Primary key
- `location_id` (uuid): Reference to location
- `dealer_id` (uuid): Optional - reference to profile/dealer
- `email_address` (text): Email recipient
- `report_type` (enum): `test_drive_daily` | `activity_daily` | `both`
- `is_enabled` (boolean): Enable/disable this configuration
- `created_at` (timestamptz): Creation timestamp
- `updated_at` (timestamptz): Last update timestamp

**Unique Constraint:** `(location_id, email_address, report_type)`

### 2. **report_schedule_config** Table
Stores automated report sending schedules for each location.

**Columns:**
- `id` (uuid): Primary key
- `location_id` (uuid): Reference to location
- `report_type` (enum): `test_drive_daily` | `activity_daily`
- `schedule_time` (TIME): Time to send report (e.g., "09:00")
- `days_of_week` (text[]): Array of days ('monday', 'tuesday', etc.)
- `is_enabled` (boolean): Enable/disable this schedule
- `timezone` (text): Timezone for scheduling (default: 'Asia/Kolkata')
- `last_sent_at` (timestamptz): When report was last sent
- `created_at` (timestamptz): Creation timestamp
- `updated_at` (timestamptz): Last update timestamp

**Unique Constraint:** `(location_id, report_type)`

### 3. **daily_test_drive_reports** Table
Logs sent test drive reports.

**Columns:**
- `id` (uuid): Primary key
- `dealer_id` (uuid): Reference to dealer/profile
- `location_id` (uuid): Reference to location
- `report_date` (date): Date of report
- `total_test_drives` (int): Total test drives on that day
- `status_breakdown` (jsonb): Status counts (scheduled, completed, no_show, etc.)
- `sales_person_stats` (jsonb): Sales person performance data
- `security_stats` (jsonb): Security checkpoint data
- `gro_stats` (jsonb): GRO performance data
- `activity_summary` (jsonb): Staff activity summary
- `email_sent_to` (text): Email address report was sent to
- `sent_at` (timestamptz): When report was sent

### 4. **activity_report_logs** Table
Logs sent activity reports.

**Columns:**
- `id` (uuid): Primary key
- `location_id` (uuid): Reference to location
- `report_date` (date): Date of report
- `staff_activity_summary` (jsonb): Session and event counts
- `event_breakdown` (jsonb): Event type breakdown
- `role_wise_activity` (jsonb): Activity by role
- `sent_at` (timestamptz): When report was sent

---

## Supabase Edge Functions

### 1. **send-daily-test-drive-reports**
Generates and sends test drive reports to configured email recipients.

**Location:** `/supabase/functions/send-daily-test-drive-reports/index.ts`

**Request Body:**
```json
{
  "reportDate": "2026-03-30",
  "dealerIds": ["uuid1", "uuid2"] // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reports processed: X sent, Y failed",
  "reportDate": "2026-03-30",
  "summary": {
    "sent": 0,
    "failed": 0,
    "total": 0
  },
  "results": []
}
```

**Report Includes:**
- Total test drives for the day
- Status breakdown (scheduled, confirmed, completed, no_show, cancelled, etc.)
- Sales person performance (assigned, completed, no_show)
- Security checkpoint data (check-ins, check-outs)
- GRO performance data
- Staff activity summary with role-wise breakdown

### 2. **send-daily-activity-reports**
Generates and sends staff activity reports to location admins.

**Location:** `/supabase/functions/send-daily-activity-reports/index.ts`

**Request Body:**
```json
{
  "reportDate": "2026-03-30",
  "locationIds": ["uuid1", "uuid2"] // Optional
}
```

**Report Includes:**
- Total events logged
- Event type breakdown
- Role-wise activity (events, sessions, avg duration)
- Top 10 events
- Staff activity timeline (last 15 staff)

### 3. **trigger-scheduled-reports**
Automated scheduler that checks configurations and sends reports.

**Location:** `/supabase/functions/trigger-scheduled-reports/index.ts`

**Invocation:** 
- Called via cron job (every 5-10 minutes recommended)
- Checks current day and time
- Compares against configured schedules
- Automatically triggers report sending if conditions match

**Response:**
```json
{
  "success": true,
  "message": "Processed scheduled reports: X sent",
  "date": "2026-03-30",
  "day": "sunday",
  "processed": 0,
  "results": []
}
```

---

## RPC Functions (Database Helpers)

### 1. **get_sales_person_daily_stats**
Retrieves sales person performance statistics for a specific day.

```sql
SELECT * FROM public.get_sales_person_daily_stats(
  location_id := 'uuid',
  report_date := '2026-03-30'
);
```

### 2. **get_security_daily_stats**
Retrieves security checkpoint statistics for a specific day.

```sql
SELECT * FROM public.get_security_daily_stats(
  location_id := 'uuid',
  report_date := '2026-03-30'
);
```

### 3. **get_gro_daily_stats**
Retrieves GRO performance statistics for a specific day.

```sql
SELECT * FROM public.get_gro_daily_stats(
  location_id := 'uuid',
  report_date := '2026-03-30'
);
```

### 4. **get_activity_daily_summary**
Retrieves staff activity summary for a specific day and location.

```sql
SELECT * FROM public.get_activity_daily_summary(
  location_id := 'uuid',
  report_date := '2026-03-30'
);
```

---

## Frontend Components

### **ReportSettingsConfig Component**
Location: `/src/components/settings/ReportSettingsConfig.tsx`

**Features:**
- Add/remove email recipients
- Configure report types per email (test drive, activity, or both)
- Create/edit automated schedules
- Select days of week and send time
- Choose timezone
- Enable/disable configurations
- Visual status indicators

**Usage:**
```tsx
import ReportSettingsConfig from '@/components/settings/ReportSettingsConfig';

<ReportSettingsConfig />
```

### **Integration in DealerSettingsPage**
Added new "Report Settings" tab alongside existing settings tabs.

**Tab:** Mail icon + "Report Settings"

---

## Report Service Utilities

Location: `/src/lib/reportService.ts`

**Available Functions:**

```typescript
// Manually trigger test drive reports
triggerTestDriveReports({
  reportDate?: '2026-03-30',
  locationIds?: ['uuid1', 'uuid2']
})

// Manually trigger activity reports
triggerActivityReports({
  reportDate?: '2026-03-30',
  locationIds?: ['uuid1', 'uuid2']
})

// Trigger scheduled report checker
triggerScheduledReportCheck()

// Get all schedules for a location
getReportSchedules(locationId: string)

// Get email recipients for a location
getReportEmailRecipients(locationId: string)

// Get sent report history
getReportHistory(locationId: string, limit?: 30)

// Get activity report history
getActivityReportHistory(locationId: string, limit?: 30)
```

---

## Deployment Steps

### 1. **Apply Database Migrations**
```bash
supabase db push
```

This will apply:
- `20260330_add_daily_test_drive_reports.sql` - Report tables
- `20260330_add_report_config_tables.sql` - Configuration tables
- `20260330_add_report_rpc_functions.sql` - Helper functions

### 2. **Deploy Edge Functions**
```bash
supabase functions deploy send-daily-test-drive-reports
supabase functions deploy send-daily-activity-reports
supabase functions deploy trigger-scheduled-reports
```

### 3. **Frontend Deployment**
```bash
npm run build
npm run deploy
```

### 4. **Setup Scheduled Reporter (Optional but Recommended)**

To automatically send reports on schedule, set up a cron job:

**Using Supabase Cron Extension:**
```sql
SELECT cron.schedule(
  'trigger-scheduled-reports',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT.supabase.co/functions/v1/trigger-scheduled-reports',
      headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}',
      body:='{}'
    ) as request_id;
  $$
);
```

**Alternative: External Cron Service**
- Use services like EasyCron, Uptime Robot, or AWS EventBridge
- Call the `trigger-scheduled-reports` endpoint every 5-10 minutes

---

## Usage Workflow

### Step 1: Configure Email Recipients
1. Navigate to **Settings > Report Settings**
2. Enter email address(es) that should receive reports
3. Select report type(s): "Test Drive Reports Only", "Activity Reports Only", or "Both"
4. Click "Add Email Recipient"

### Step 2: Configure Schedule
1. Select report type to configure
2. Enter send time (e.g., "09:00" for 9 AM)
3. Choose timezone
4. Select which days of the week to send
5. Click "Save Schedule"

### Step 3: Automatic Sending
- Reports will be sent automatically at configured times
- After first send, `last_sent_at` is updated to prevent duplicates
- Can be toggled on/off with the toggle button

### Step 4: Manual Trigger (Optional)
```typescript
import { triggerTestDriveReports } from '@/lib/reportService';

// Send test drive report for today
await triggerTestDriveReports();

// Send for specific date and location
await triggerTestDriveReports({
  reportDate: '2026-03-30',
  locationIds: ['location-uuid']
});
```

---

## Email Report Format

### Test Drive Report
- **Header:** Summary of total test drives, completed, no-show, in-progress
- **Status Breakdown:** Visual bar charts showing status distribution
- **Sales Person Performance:** Table with assigned, completed, no-show counts
- **Security Checkpoint:** Check-in and check-out data per officer
- **GRO Performance:** Assigned and completed counts per GRO
- **Activity Summary:** Total events, event type breakdown, role-wise activity
- **Footer:** Report generation timestamp

### Activity Report
- **Overview:** Total events, sessions, active sessions
- **Event Type Breakdown:** Count of each event type
- **Role-wise Activity:** Events, sessions, and average duration per role
- **Top Events:** Most frequently logged event types
- **Staff Timeline:** Staff member activity with last seen time and session duration
- **Custom Note:** Information about what the report captures

---

## Row-Level Security (RLS) Policies

### Who Can Manage Configurations?
- **Dealers/Location Admins:** Can manage their own location's configurations
- **Superadmins:** Can view and manage all configurations

### Who Can View Configurations?
- **Dealers/Location Staff:** Can view their location's configurations
- **Superadmins:** Can view all configurations

---

## Troubleshooting

### Reports Not Sending
1. Check if email configuration is enabled
2. Verify schedule is enabled and time matches current time
3. Check timezone setting (should match server timezone)
4. Verify email addresses are valid
5. Check Supabase Edge Function logs for errors

### Missing Data in Reports
1. Verify test drive records have required fields
2. Ensure sales persons, GRO, and security staff are assigned
3. Check that staff activity is being logged to `staff_activity_events`

### Email Not Received
1. Check if email address is on suppression list
2. Verify email provider settings
3. Check spam/junk folder
4. Review Supabase email logs in `email_send_log` table

---

## Performance Considerations

- Schedules run every 5-10 minutes - adjust cron frequency as needed
- Each report generation queries up to 3 tables (test_drives, profiles, staff_activity_events)
- Reports are cached in `daily_test_drive_reports` and `activity_report_logs` tables
- Indexes created on: `location_id`, `report_date`, `sent_at`

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/functions/v1/send-daily-test-drive-reports` | POST | Manual test drive report trigger |
| `/functions/v1/send-daily-activity-reports` | POST | Manual activity report trigger |
| `/functions/v1/trigger-scheduled-reports` | POST | Check and send scheduled reports |

---

## Next Steps

1. ✅ Migrate database schema
2. ✅ Deploy Edge Functions
3. ✅ Configure email recipients in Settings UI
4. ✅ Configure report schedules
5. ✅ Test manual report trigger
6. ✅ Setup automated cron job
7. ✅ Monitor first scheduled report send
8. ✅ Adjust schedules/recipients as needed

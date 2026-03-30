# Report Retry System - Deployment Instructions

## 📋 Summary

This document outlines deployment steps for the complete Report Delivery Monitoring, Error Tracking, and Automatic Retry System.

**Key Features:**
- ✅ Track all report send attempts with attempt count (1-3)
- ✅ Automatic exponential backoff retry: 5 min → 15 min → 1 hour
- ✅ Manual retry via dashboard button
- ✅ Error tracking with error code and message
- ✅ Superadmin alert email on 3rd failure
- ✅ Full monitoring dashboard with filters and stats
- ✅ RLS-protected data (location staff/dealer admins/superadmin)

## 🗂 Files Modified/Created

### Migrations (Database)
- [x] `/supabase/migrations/20260330150000_add_report_send_attempts.sql` - NEW
- [x] `/supabase/migrations/20260330150100_add_report_retry_functions.sql` - NEW

### Edge Functions
- [x] `/supabase/functions/send-daily-test-drive-reports/index.ts` - UPDATED (error logging added)
- [x] `/supabase/functions/send-daily-activity-reports/index.ts` - UPDATED (error logging added)
- [x] `/supabase/functions/handle-report-retry/index.ts` - NEW
- [x] `/supabase/functions/handle-report-retry/deno.json` - NEW
- [x] `/supabase/functions/process-report-retries/index.ts` - NEW
- [x] `/supabase/functions/process-report-retries/deno.json` - NEW

### React Components
- [x] `/src/pages/ReportMonitoringPage.tsx` - NEW (integrated with edge functions)

## 🚀 Deployment Steps

### Step 1: Deploy Migrations

```bash
cd /Users/dheerajvarshney/showroom-drive
supabase db push
```

**What this does:**
- Creates `report_send_attempts` table
- Creates `log_report_send_attempt()` and `get_failed_reports_for_retry()` RPC functions
- Sets up RLS policies for secure data access

**Verify:**
```sql
-- Check table exists
SELECT tablename FROM pg_tables WHERE tablename = 'report_send_attempts';

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname LIKE 'log_report_send_attempt%';
```

### Step 2: Deploy Edge Functions

```bash
# Deploy updated send functions
supabase functions deploy send-daily-test-drive-reports
supabase functions deploy send-daily-activity-reports

# Deploy new retry functions
supabase functions deploy handle-report-retry
supabase functions deploy process-report-retries
```

**Verification:**
```bash
supabase functions list
# Should show all 4 functions deployed
```

### Step 3: Set Up Cron Job (Optional but Recommended)

To automatically retry failed reports every 5-10 minutes, add this to your scheduled tasks or cron job:

```bash
# Call process-report-retries every 5 minutes
*/5 * * * * curl -X POST https://[your-supabase-project].supabase.co/functions/v1/process-report-retries \
  -H "Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json"
```

**Alternative: Use Supabase Cron Extension**

If your Supabase project has pg_cron enabled, create a function that calls the edge function:

```sql
-- Enable if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule automatic retries every 5 minutes
SELECT cron.schedule(
  'process-report-retries',
  '*/5 * * * *',
  'SELECT pg_http.http_post(
    ''https://[your-project].supabase.co/functions/v1/process-report-retries'',
    ''{}''::jsonb,
    ''{"Authorization": "Bearer [SUPABASE_SERVICE_ROLE_KEY]"}''::jsonb
  )'
);
```

### Step 4: Frontend Integration

The `ReportMonitoringPage` component is already integrated and will:
- ✅ Display all report send attempts in a dashboard
- ✅ Show filters by status and email
- ✅ Display stats cards (Total, Success, Failed, Pending, Retry Ready, Admin Alerts)
- ✅ Allow manual retry via button click
- ✅ Respect RLS policies (only shows user's location data)

**Add to navigation (if not already present):**

```tsx
// In your navigation/sidebar component
<NavLink to="/reports/monitoring" icon={Activity}>
  Report Monitor
</NavLink>
```

## 📊 Data Flow & Architecture

### Send Failure Flow

```
Report Send Function
├─ Try to send email
├─ If success
│  └─ log_report_send_attempt(status='success')
└─ If failure
   ├─ Extract error_message and error_code
   └─ log_report_send_attempt(status='failed', error_message, error_code)
       ├─ Auto-calculates attempt_number
       ├─ Sets next_retry_at based on exponential backoff:
       │  • 1st fail → 5 minutes
       │  • 2nd fail → 15 minutes
       │  • 3rd fail → 1 hour + superadmin_notified_at = now()
       └─ Returns attempt UUID
```

### Automatic Retry Flow

```
process-report-retries (runs every 5-10 min)
├─ get_failed_reports_for_retry() RPC
│  └─ Returns reports with attempt < 3 and next_retry_at <= now(), limit 50
├─ For each failed report
│  ├─ Call handle-report-retry
│  │  ├─ Call appropriate send function (test-drive or activity)
│  │  ├─ Filter to specific recipient email only
│  │  └─ Log result via log_report_send_attempt()
│  │      ├─ If success → no more retries needed
│  │      └─ If fail → calculate next exponential backoff
│  │
│  └─ If attempt_number >= 3 and still failed
│     └─ Generate superadmin alert email
│        ├─ List all 3-attempt failures
│        ├─ Include error messages
│        ├─ Suggest troubleshooting steps
│        └─ Send to all superadmin users
└─ Return stats (processed, succeeded, failed, alerts)
```

### Manual Retry Flow (User Dashboard)

```
User clicks "Retry" in ReportMonitoringPage
├─ Get session auth token
├─ Call handle-report-retry edge function with:
│  ├─ locationId
│  ├─ reportType (test_drive_daily | activity_daily)
│  ├─ recipientEmail
│  └─ reportDate
├─ Edge function:
│  ├─ Fetches failed attempt from database
│  ├─ Validates attempt_number < 3
│  ├─ Calls send function with recipientEmails filter
│  └─ Logs result
└─ Dashboard refreshes after 1s
```

## 📈 Monitoring & Verification

### Real-Time Dashboard

Visit the Report Monitoring page to see:
- **Stats Cards**: Total, Success, Failed, Pending, Retry Ready, Admin Alerts
- **Attempt Details**: Date, Type, Email, Attempt Count, Status, Error Message
- **Manual Actions**: Retry button for failed reports (if < 3 attempts)

### Database Queries

```sql
-- See all send attempts
SELECT * FROM report_send_attempts 
ORDER BY created_at DESC 
LIMIT 20;

-- See failed attempts ready for retry
SELECT * FROM report_send_attempts
WHERE status = 'failed' 
  AND attempt_number < 3 
  AND next_retry_at <= NOW()
ORDER BY next_retry_at ASC;

-- See reports that triggered superadmin alerts
SELECT * FROM report_send_attempts
WHERE superadmin_notified_at IS NOT NULL
ORDER BY superadmin_notified_at DESC;

-- Get retry statistics
SELECT 
  status,
  COUNT(*) as count,
  AVG(attempt_number) as avg_attempts
FROM report_send_attempts
GROUP BY status;
```

## ✅ Testing Checklist

### Pre-Deployment

- [ ] Review migrations for SQL syntax errors
  ```bash
  supabase migration list
  ```

- [ ] Verify edge function TypeScript compiles
  ```bash
  supabase functions build handle-report-retry
  supabase functions build process-report-retries
  ```

### Post-Deployment

- [ ] [ ] **Test 1: Send a Report**
  - Trigger a test drive or activity report
  - Verify data appears in `report_send_attempts` table
  - Check status = 'success' if email sent

- [ ] [ ] **Test 2: Simulate Failure**
  - Temporarily break email function
  - Send test report
  - Verify status = 'failed', error_message, error_code populated
  - Verify attempt_number = 1, next_retry_at set to ~5 min future

- [ ] [ ] **Test 3: Manual Retry**
  - Open Report Monitoring dashboard
  - Find a failed report
  - Click "Retry" button
  - Verify attempt_number increments to 2
  - Verify status changes based on retry result

- [ ] [ ] **Test 4: Automatic Retries**
  - Simulate failure, then wait/trigger process-report-retries
  - Verify attempt increments automatically
  - Verify exponential backoff timing

- [ ] [ ] **Test 5: Superadmin Alert**
  - Force 3 consecutive failures
  - Verify superadmin_notified_at is set
  - Check superadmin receives alert email with details
  - Verify "Alert Sent" badge appears in dashboard

- [ ] [ ] **Test 6: RLS Policies**
  - Login as location staff → should see only their location's reports
  - Login as dealer admin → should see all dealer locations' reports
  - Login as superadmin → should see all reports globally

- [ ] [ ] **Test 7: Dashboard Filters**
  - Filter by status (success/failed/pending)
  - Filter by email address
  - Verify counts match filtered results
  - Clear filters works properly

## 🔧 Troubleshooting

### Issue: Edge Functions Not Deploying

```bash
# Check function syntax
cat supabase/functions/handle-report-retry/index.ts

# Check deno.json imports
cat supabase/functions/handle-report-retry/deno.json

# Deploy with verbose output
supabase functions deploy handle-report-retry --debug
```

### Issue: RLS Errors When Inserting

**Error**: `new row violates row-level security policy for table report_send_attempts`

**Solution**: 
- Verify user role via RLS policies
- Check location_id belongs to user's dealer
- Ensure profiles table has correct user_id linkage

```sql
-- Debug: Check user's location_id
SELECT up.user_id, p.full_name, p.location_id 
FROM profiles p
JOIN user_profiles up ON p.id = up.user_id
WHERE p.email = 'test@example.com';

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'report_send_attempts'
ORDER BY tablename, policyname;
```

### Issue: Superadmin Alert Email Not Sent

**Possible causes:**
1. Superadmin email not in database
2. send-transactional-email function failing
3. Email service rate-limited

**Debug:**
```sql
-- Check superadmin emails exist
SELECT id, email, full_name
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.user_id AND ur.role = 'superadmin'
);

-- Check is_active
SELECT p.id, p.email, p.is_active
FROM profiles p
WHERE p.is_active = true;
```

### Issue: Dashboard Shows No Data

**Possible causes:**
1. User not authenticated
2. User has no location_id
3. No report attempts recorded yet

**Debug:**
```js
// In browser console
const { data: { session } } = await supabase.auth.getSession();
console.log('User:', session?.user?.email);
console.log('Auth token:', !!session?.access_token);

// Check if can query table
const { data, error } = await supabase
  .from('report_send_attempts')
  .select('*')
  .limit(5);
console.log('Query result:', { data, error });
```

## 📚 API References

### log_report_send_attempt() RPC

```sql
-- Call signature
SELECT log_report_send_attempt(
  p_location_id UUID,
  p_report_type TEXT, -- 'test_drive_daily' | 'activity_daily'
  p_recipient_email TEXT,
  p_report_date DATE,
  p_status TEXT, -- 'success' | 'failed' | 'pending'
  p_error_message TEXT,
  p_error_code TEXT
);

-- Returns: attempt_id UUID
```

### get_failed_reports_for_retry() RPC

```sql
-- Call signature
SELECT get_failed_reports_for_retry();

-- Returns array of:
-- {
--   id: UUID,
--   location_id: UUID,
--   report_type: TEXT,
--   recipient_email: TEXT,
--   report_date: DATE,
--   attempt_number: INT,
--   status: TEXT,
--   next_retry_at: TIMESTAMP,
--   error_message: TEXT
-- }
```

### handle-report-retry Edge Function

```typescript
// Endpoint: POST /functions/v1/handle-report-retry
// Request body:
{
  locationId: string (UUID),
  reportType: 'test_drive_daily' | 'activity_daily',
  recipientEmail: string,
  reportDate: string (YYYY-MM-DD)
}

// Response:
{
  success: boolean,
  message: string,
  attemptId?: string,
  error?: string
}
```

## 🔐 Security Notes

- ✅ All edge functions use `SUPABASE_SERVICE_ROLE_KEY` for server-side operations
- ✅ Frontend calls use user's session auth token
- ✅ RLS policies enforce data isolation by location/role
- ✅ Error messages sanitized (no sensitive data in email_logs)
- ✅ Service role key never exposed to frontend

## 📞 Support

For issues or questions:

1. Check the Troubleshooting section above
2. Review Supabase function logs: `supabase functions list --linked`
3. Check database migrations: `supabase migration list`
4. Review RLS policies in Supabase dashboard

## ✨ Next Steps (Optional Enhancements)

- [ ] Add webhook for external notification systems (Slack, Teams)
- [ ] Implement custom retry schedules (business hours only, etc.)
- [ ] Add report content previews in dashboard
- [ ] Email template customization
- [ ] Integration with email service provider (SendGrid, AWS SES) for better delivery tracking
- [ ] Analytics dashboard for delivery success rates over time

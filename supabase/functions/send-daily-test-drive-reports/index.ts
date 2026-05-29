import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestDriveStats {
  scheduled: number
  confirmed: number
  show: number
  no_show: number
  in_progress: number
  completed: number
  cancelled: number
  rescheduled: number
}

interface SalesPersonData {
  id: string
  name: string
  assigned: number
  completed: number
  no_show: number
}

interface SecurityData {
  id: string
  name: string
  checked_in: number
  checked_out: number
}

interface GROData {
  id: string
  name: string
  assigned: number
  completed: number
}

interface ReportData {
  dealer: { id: string; name: string; email: string }
  location: { id: string; name: string }
  reportDate: string
  totalTestDrives: number
  statusBreakdown: TestDriveStats
  salesPeople: SalesPersonData[]
  security: SecurityData[]
  gro: GROData[]
  activitySummary: {
    totalEvents: number
    eventTypes: Record<string, number>
    roleActivity: Record<string, { events: number; sessions: number }>
  }
}

// Generate HTML email template
function generateEmailHTML(report: ReportData): string {
  const dateFormatted = new Date(report.reportDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const statusBarChart = Object.entries(report.statusBreakdown)
    .map(([status, count]) => {
      const width = Math.max((count / report.totalTestDrives) * 100, 5)
      const colors: Record<string, string> = {
        scheduled: '#3b82f6',
        confirmed: '#8b5cf6',
        show: '#10b981',
        no_show: '#ef4444',
        in_progress: '#f59e0b',
        completed: '#06b6d4',
        cancelled: '#6b7280',
        rescheduled: '#ec4899',
      }
      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 13px; font-weight: 500; text-transform: capitalize;">${status.replace(/_/g, ' ')}</span>
            <span style="font-size: 13px; font-weight: 600;">${count}</span>
          </div>
          <div style="height: 24px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${width}%; background: ${colors[status] || '#9ca3af'}; transition: width 0.3s;"></div>
          </div>
        </div>
      `
    })
    .join('')

  const salesPeopleRows = report.salesPeople
    .map(
      (person) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-size: 13px;">${person.name}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${person.assigned}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px; color: #10b981; font-weight: 600;">${person.completed}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px; color: #ef4444;">${person.no_show}</td>
    </tr>
  `
    )
    .join('')

  const securityRows = report.security
    .map(
      (person) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-size: 13px;">${person.name}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${person.checked_in}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${person.checked_out}</td>
    </tr>
  `
    )
    .join('')

  const groRows = report.gro
    .map(
      (person) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-size: 13px;">${person.name}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${person.assigned}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${person.completed}</td>
    </tr>
  `
    )
    .join('')

  const eventTypeRows = Object.entries(report.activitySummary.eventTypes)
    .map(
      ([eventType, count]) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px; font-size: 13px;">${eventType}</td>
      <td style="padding: 8px; text-align: center; font-size: 13px; font-weight: 600;">${count}</td>
    </tr>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; }
    .section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 16px; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px; }
    .stat-box { display: inline-block; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-right: 12px; margin-bottom: 12px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #667eea; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Test Drive Report</h1>
      <p>${report.location.name} | ${dateFormatted}</p>
    </div>

    <!-- Overview Section -->
    <div class="section">
      <div class="section-title">📈 Overview</div>
      <div>
        <div class="stat-box">
          <div class="stat-value">${report.totalTestDrives}</div>
          <div class="stat-label">Total Test Drives</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #10b981;">${report.statusBreakdown.completed}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #ef4444;">${report.statusBreakdown.no_show}</div>
          <div class="stat-label">No Show</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #f59e0b;">${report.statusBreakdown.in_progress}</div>
          <div class="stat-label">In Progress</div>
        </div>
      </div>
    </div>

    <!-- Status Breakdown -->
    <div class="section">
      <div class="section-title">🎯 Test Drive Status Breakdown</div>
      <div>${statusBarChart}</div>
    </div>

    <!-- Sales People Performance -->
    <div class="section">
      <div class="section-title">👥 Sales Person Performance</div>
      ${report.salesPeople.length > 0
      ? `<table>
          <thead><tr>
            <th>Sales Person</th>
            <th>Assigned</th>
            <th>Completed</th>
            <th>No Show</th>
          </tr></thead>
          <tbody>${salesPeopleRows}</tbody>
        </table>`
      : '<p style="color: #6b7280;">No sales person data available for this period.</p>'
    }
    </div>

    <!-- Security Checkpoint -->
    <div class="section">
      <div class="section-title">🔒 Security Checkpoint</div>
      ${report.security.length > 0
      ? `<table>
          <thead><tr>
            <th>Security Officer</th>
            <th>Check-ins</th>
            <th>Check-outs</th>
          </tr></thead>
          <tbody>${securityRows}</tbody>
        </table>`
      : '<p style="color: #6b7280;">No security checkpoint data available for this period.</p>'
    }
    </div>

    <!-- GRO Performance -->
    <div class="section">
      <div class="section-title">📋 GRO Performance</div>
      ${report.gro.length > 0
      ? `<table>
          <thead><tr>
            <th>GRO</th>
            <th>Assigned</th>
            <th>Completed</th>
          </tr></thead>
          <tbody>${groRows}</tbody>
        </table>`
      : '<p style="color: #6b7280;">No GRO data available for this period.</p>'
    }
    </div>

    <!-- Activity Summary -->
    <div class="section">
      <div class="section-title">📊 Staff Activity Summary</div>
      <div style="margin-bottom: 16px;">
        <div class="stat-box">
          <div class="stat-value">${report.activitySummary.totalEvents}</div>
          <div class="stat-label">Total Events Logged</div>
        </div>
      </div>
      <h4 style="margin: 12px 0 8px 0; font-size: 13px; font-weight: 600;">Event Type Breakdown</h4>
      ${eventTypeRows
      ? `<table>
          <thead><tr>
            <th>Event Type</th>
            <th>Count</th>
          </tr></thead>
          <tbody>${eventTypeRows}</tbody>
        </table>`
      : '<p style="color: #6b7280; font-size: 13px;">No activity events recorded.</p>'
    }
    </div>

    <!-- Role Activity -->
    <div class="section">
      <div class="section-title">👨‍💼 Role-wise Activity</div>
      <table>
        <thead><tr>
          <th>Role</th>
          <th>Events</th>
          <th>Active Sessions</th>
        </tr></thead>
        <tbody>
          ${Object.entries(report.activitySummary.roleActivity)
      .map(
        ([role, data]: [string, any]) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px; font-size: 13px; text-transform: uppercase;">${role}</td>
              <td style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600;">${data.events}</td>
              <td style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600;">${data.sessions}</td>
            </tr>
          `
      )
      .join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This is an automated daily report generated by Auto Advant Management System.</p>
      <p>Report generated at ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

async function fetchTestDriveReport(
  supabase: any,
  dealerId: string,
  locationId: string,
  reportDate: string
): Promise<ReportData | null> {
  try {
    // Get dealer info
    const { data: dealerData } = await supabase.from('profiles').select('id, full_name, email').eq('id', dealerId).single()

    // Get location info
    const { data: locationData } = await supabase.from('locations').select('id, name').eq('id', locationId).single()

    if (!dealerData || !locationData) return null

    // Get test drives for the day
    const { data: testDrives } = await supabase
      .from('test_drives')
      .select('*, assigned_sales_person_id, assigned_gro_id')
      .eq('location_id', locationId)
      .eq('scheduled_date', reportDate)

    if (!testDrives || testDrives.length === 0) {
      return null
    }

    // Calculate status breakdown
    const statusBreakdown: TestDriveStats = {
      scheduled: 0,
      confirmed: 0,
      show: 0,
      no_show: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      rescheduled: 0,
    }

    testDrives.forEach((td: any) => {
      statusBreakdown[td.status as keyof TestDriveStats]++
    })

    // Get sales person data
    const { data: salesPersonStats } = await supabase.rpc('get_sales_person_daily_stats', {
      location_id: locationId,
      report_date: reportDate,
    })

    // Get security data
    const { data: securityStats } = await supabase.rpc('get_security_daily_stats', {
      location_id: locationId,
      report_date: reportDate,
    })

    // Get GRO data
    const { data: groStats } = await supabase.rpc('get_gro_daily_stats', {
      location_id: locationId,
      report_date: reportDate,
    })

    // Get activity summary
    const { data: activityData } = await supabase.rpc('get_activity_daily_summary', {
      location_id: locationId,
      report_date: reportDate,
    })

    return {
      dealer: { id: dealerData.id, name: dealerData.full_name, email: dealerData.email },
      location: { id: locationData.id, name: locationData.name },
      reportDate,
      totalTestDrives: testDrives.length,
      statusBreakdown,
      salesPeople: salesPersonStats || [],
      security: securityStats || [],
      gro: groStats || [],
      activitySummary: activityData || { totalEvents: 0, eventTypes: {}, roleActivity: {} },
    }
  } catch (error) {
    console.error('Error fetching test drive report:', error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await req.json()
    const reportDate = body.reportDate || new Date().toISOString().split('T')[0]
    const dealerIds = body.dealerIds // Optional: specific dealers. If not provided, send to all
    const locationIds = body.locationIds // Optional: specific locations
    const recipientEmails = body.recipientEmails // Optional: specific recipient emails (for retries)

    // Get all dealers/locations
    let dealerQuery = supabase.from('profiles').select('id, location_id, email').eq('is_active', true)

    if (dealerIds && Array.isArray(dealerIds)) {
      dealerQuery = dealerQuery.in('id', dealerIds)
    }

    if (locationIds && Array.isArray(locationIds)) {
      dealerQuery = dealerQuery.in('location_id', locationIds)
    }

    const { data: dealers } = await dealerQuery

    if (!dealers || dealers.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No dealers found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sentCount = 0
    let failedCount = 0
    const results = []

    for (const dealer of dealers) {
      if (!dealer.location_id) continue

      // If recipientEmails specified, only send to those specific emails
      if (recipientEmails && !recipientEmails.includes(dealer.email)) {
        continue
      }

      let errorMessage: string | null = null
      let errorCode: string | null = null

      try {
        const reportData = await fetchTestDriveReport(supabase, dealer.id, dealer.location_id, reportDate)

        if (!reportData) {
          console.log(`No test drives found for dealer ${dealer.id} on ${reportDate}`)
          continue
        }

        const emailHTML = generateEmailHTML(reportData)

        // Send email via transactional email function
        let sendEmailResponse: Response
        try {
          sendEmailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              recipientEmail: reportData.dealer.email,
              templateName: 'custom_html',
              templateData: {
                subject: `Daily Test Drive Report - ${reportData.location.name} - ${reportDate}`,
                html: emailHTML,
                previewText: `Daily Report: ${reportData.totalTestDrives} test drives for ${reportDate}`,
              },
            }),
          })
        } catch (fetchError) {
          throw new Error(`Email service unavailable: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
        }

        if (sendEmailResponse.ok) {
          // Store report in database
          await supabase.from('daily_test_drive_reports').insert({
            dealer_id: reportData.dealer.id,
            location_id: reportData.location.id,
            report_date: reportDate,
            total_test_drives: reportData.totalTestDrives,
            status_breakdown: reportData.statusBreakdown,
            sales_person_stats: reportData.salesPeople,
            security_stats: reportData.security,
            gro_stats: reportData.gro,
            activity_summary: reportData.activitySummary,
            email_sent_to: reportData.dealer.email,
            sent_at: new Date().toISOString(),
          })

          // Log successful send attempt
          await supabase.rpc('log_report_send_attempt', {
            p_location_id: reportData.location.id,
            p_report_type: 'test_drive_daily',
            p_recipient_email: reportData.dealer.email,
            p_report_date: reportDate,
            p_status: 'success',
            p_error_message: null,
            p_error_code: null,
          })

          sentCount++
          results.push({ dealer: reportData.dealer.name, status: 'sent', location: reportData.location.name })
          console.log(`Report sent to ${reportData.dealer.email}`)
        } else {
          const errorResponse = await sendEmailResponse.text()
          errorMessage = `HTTP ${sendEmailResponse.status}: ${errorResponse.substring(0, 200)}`
          errorCode = `EMAIL_SEND_ERROR_${sendEmailResponse.status}`

          // Log failed send attempt
          await supabase.rpc('log_report_send_attempt', {
            p_location_id: reportData.location.id,
            p_report_type: 'test_drive_daily',
            p_recipient_email: reportData.dealer.email,
            p_report_date: reportDate,
            p_status: 'failed',
            p_error_message: errorMessage,
            p_error_code: errorCode,
          })

          failedCount++
          results.push({ dealer: reportData.dealer.name, status: 'failed', error: errorMessage })
          console.error(`Failed to send email to ${reportData.dealer.email}: ${errorMessage}`)
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errorCode = 'REPORT_PROCESSING_ERROR'

        // Log processing error
        try {
          await supabase.rpc('log_report_send_attempt', {
            p_location_id: dealer.location_id,
            p_report_type: 'test_drive_daily',
            p_recipient_email: dealer.email,
            p_report_date: reportDate,
            p_status: 'failed',
            p_error_message: errorMessage,
            p_error_code: errorCode,
          })
        } catch (logError) {
          console.error('Failed to log error:', logError)
        }

        failedCount++
        results.push({ dealer: dealer.id, status: 'failed', error: errorMessage })
        console.error(`Error processing dealer ${dealer.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reports processed: ${sentCount} sent, ${failedCount} failed`,
        reportDate,
        results,
        summary: { sent: sentCount, failed: failedCount, total: dealers.length },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in send-daily-test-drive-reports:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

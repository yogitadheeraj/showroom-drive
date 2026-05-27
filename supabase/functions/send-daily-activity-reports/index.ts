import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityReport {
  location: { id: string; name: string }
  reportDate: string
  totalSessions: number
  totalEvents: number
  totalActiveSessions: number
  eventBreakdown: Record<string, number>
  roleActivity: Record<string, { events: number; sessions: number; avgSessionDuration: number }>
  topEvents: Array<{ event_type: string; event_label: string; count: number }>
  staffActivityTimeline: Array<{ name: string; role: string; lastSeen: string; sessionDuration: number }>
}

function generateActivityReportHTML(report: ActivityReport): string {
  const dateFormatted = new Date(report.reportDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const eventBreakdownRows = Object.entries(report.eventBreakdown)
    .map(
      ([eventType, count]) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 13px;">${eventType}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px; font-weight: 600;">${count}</td>
    </tr>
  `
    )
    .join('')

  const roleActivityRows = Object.entries(report.roleActivity)
    .map(
      ([role, data]: [string, any]) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 13px; text-transform: uppercase;">${role}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px;">${data.events}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px;">${data.sessions}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px;">${Math.round(data.avgSessionDuration || 0)} mins</td>
    </tr>
  `
    )
    .join('')

  const topEventsRows = report.topEvents
    .slice(0, 10)
    .map(
      (event) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 13px;">${event.event_type}</td>
      <td style="padding: 10px; font-size: 13px;">${event.event_label || '—'}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px; font-weight: 600;">${event.count}</td>
    </tr>
  `
    )
    .join('')

  const staffTimelineRows = report.staffActivityTimeline
    .slice(0, 15)
    .map(
      (staff) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 13px;">${staff.name}</td>
      <td style="padding: 10px; font-size: 13px; text-transform: uppercase; font-weight: 500;">${staff.role}</td>
      <td style="padding: 10px; font-size: 13px;">${new Date(staff.lastSeen).toLocaleTimeString('en-IN')}</td>
      <td style="padding: 10px; text-align: right; font-size: 13px;">${Math.round(staff.sessionDuration || 0)} mins</td>
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
    .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; }
    .section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 16px; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px; }
    .stat-box { display: inline-block; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-right: 12px; margin-bottom: 12px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #667eea; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 10px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Activity & Staff Report</h1>
      <p>${report.location.name} | ${dateFormatted}</p>
    </div>

    <!-- Overview Statistics -->
    <div class="section">
      <div class="section-title">📈 Activity Overview</div>
      <div>
        <div class="stat-box">
          <div class="stat-value">${report.totalEvents}</div>
          <div class="stat-label">Total Events Logged</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.totalSessions}</div>
          <div class="stat-label">Staff Sessions</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #10b981;">${report.totalActiveSessions}</div>
          <div class="stat-label">Active Sessions</div>
        </div>
      </div>
    </div>

    <!-- Event Type Breakdown -->
    <div class="section">
      <div class="section-title">🎯 Event Type Breakdown</div>
      ${
        eventBreakdownRows
          ? `<table>
        <thead><tr>
          <th>Event Type</th>
          <th>Count</th>
        </tr></thead>
        <tbody>${eventBreakdownRows}</tbody>
      </table>`
          : '<p style="color: #6b7280; font-size: 13px;">No activity events recorded.</p>'
      }
    </div>

    <!-- Role-wise Activity -->
    <div class="section">
      <div class="section-title">👥 Role-wise Activity Summary</div>
      <table>
        <thead><tr>
          <th>Role</th>
          <th>Events</th>
          <th>Sessions</th>
          <th>Avg Duration</th>
        </tr></thead>
        <tbody>${roleActivityRows}</tbody>
      </table>
    </div>

    <!-- Top Events -->
    <div class="section">
      <div class="section-title">⭐ Top 10 Events</div>
      ${
        topEventsRows
          ? `<table>
        <thead><tr>
          <th>Event Type</th>
          <th>Event Label</th>
          <th>Count</th>
        </tr></thead>
        <tbody>${topEventsRows}</tbody>
      </table>`
          : '<p style="color: #6b7280; font-size: 13px;">No event data available.</p>'
      }
    </div>

    <!-- Staff Activity Timeline -->
    <div class="section">
      <div class="section-title">👨‍💼 Staff Activity Timeline (Last 15)</div>
      <table>
        <thead><tr>
          <th>Staff Name</th>
          <th>Role</th>
          <th>Last Seen</th>
          <th>Session Duration</th>
        </tr></thead>
        <tbody>${staffTimelineRows}</tbody>
      </table>
    </div>

    <div class="highlight">
      <strong>📌 Note:</strong> This report captures all staff activities including logins, page views, interactions, and session metrics for the day. Use this to monitor team productivity and system usage patterns.
    </div>

    <div class="footer">
      <p>This is an automated daily activity report generated by Auto Advant Management System.</p>
      <p>Report generated at ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

async function fetchActivityReport(supabase: any, locationId: string, reportDate: string): Promise<ActivityReport | null> {
  try {
    // Get location info
    const { data: locationData } = await supabase.from('locations').select('id, name').eq('id', locationId).single()

    if (!locationData) return null

    // Get total sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('staff_activity_sessions')
      .select('id, active_seconds')
      .eq('location_id', locationId)
      .gte('login_at', `${reportDate}T00:00:00`)
      .lt('login_at', `${reportDate}T23:59:59`)

    const totalSessions = sessionData?.length || 0
    const totalActiveSessions = sessionData?.filter((s: any) => s.active_seconds > 0).length || 0
    const avgSessionDuration = totalSessions > 0 ? sessionData!.reduce((sum: number, s: any) => sum + (s.active_seconds || 0), 0) / totalSessions / 60 : 0

    // Get events
    const { data: eventData } = await supabase
      .from('staff_activity_events')
      .select('*')
      .eq('location_id', locationId)
      .gte('happened_at', `${reportDate}T00:00:00`)
      .lt('happened_at', `${reportDate}T23:59:59`)

    const totalEvents = eventData?.length || 0

    // Event breakdown
    const eventBreakdown: Record<string, number> = {}
    eventData?.forEach((event: any) => {
      eventBreakdown[event.event_type] = (eventBreakdown[event.event_type] || 0) + 1
    })

    // Role-wise activity
    const { data: roleActivityData } = await supabase.rpc('get_activity_daily_summary', {
      location_id: locationId,
      report_date: reportDate,
    })

    const roleActivity: Record<string, { events: number; sessions: number; avgSessionDuration: number }> =
      roleActivityData?.roleActivity || {}
    Object.keys(roleActivity).forEach((role) => {
      roleActivity[role].avgSessionDuration = avgSessionDuration
    })

    // Top events
    const topEvents = Object.entries<number>(eventBreakdown)
      .map(([eventType, count]) => ({
        event_type: eventType,
        event_label: eventType.replace(/_/g, ' '),
        count,
      }))
      .sort((a, b) => b.count - a.count)

    // Staff activity timeline
    const { data: staffTimeline } = await supabase
      .from('staff_activity_sessions')
      .select('id, profile_id, role, last_seen_at, active_seconds')
      .eq('location_id', locationId)
      .gte('login_at', `${reportDate}T00:00:00`)
      .lt('login_at', `${reportDate}T23:59:59`)
      .limit(15)
      .order('last_seen_at', { ascending: false })

    const staffActivityTimeline = (staffTimeline || []).map((session: any) => ({
      name: session.profile_id || 'Unknown',
      role: session.role || 'unknown',
      lastSeen: session.last_seen_at || new Date().toISOString(),
      sessionDuration: (session.active_seconds || 0) / 60,
    }))

    return {
      location: { id: locationData.id, name: locationData.name },
      reportDate,
      totalSessions,
      totalEvents,
      totalActiveSessions,
      eventBreakdown,
      roleActivity: roleActivityData?.roleActivity || {},
      topEvents,
      staffActivityTimeline,
    }
  } catch (error) {
    console.error('Error fetching activity report:', error)
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
    const locationIds = body.locationIds // Optional: specific locations. If not provided, send to all
    const recipientEmails = body.recipientEmails // Optional: specific recipient emails (for retries)

    // Get all locations
    let locationQuery = supabase.from('locations').select('id, name, email')

    if (locationIds && Array.isArray(locationIds)) {
      locationQuery = locationQuery.in('id', locationIds)
    }

    const { data: locations } = await locationQuery

    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No locations found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sentCount = 0
    let failedCount = 0
    const results = []

    for (const location of locations) {
      let errorMessage: string | null = null
      let errorCode: string | null = null

      try {
        const activityReport = await fetchActivityReport(supabase, location.id, reportDate)

        if (!activityReport || activityReport.totalEvents === 0) {
          console.log(`No activity events found for location ${location.id} on ${reportDate}`)
          results.push({ location: location.name, status: 'skipped', reason: 'No activity data' })
          continue
        }

        const emailHTML = generateActivityReportHTML(activityReport)

        // Get superadmin emails to send activity reports
        const { data: admins } = await supabase
          .from('profiles')
          .select('email')
          .eq('location_id', location.id)

        const adminEmails = admins?.map((a: any) => a.email).filter(Boolean) || []

        // If recipientEmails specified, filter to only those
        const targetEmails = recipientEmails ? adminEmails.filter((e: string) => recipientEmails.includes(e)) : adminEmails

        if (targetEmails.length === 0) {
          if (recipientEmails) {
            console.log(`No matching recipient emails for location ${location.id}`)
            continue
          }
          errorMessage = 'No admin email found'
          errorCode = 'NO_RECIPIENTS'

          results.push({ location: location.name, status: 'failed', reason: errorMessage })
          continue
        }

        // Send to all admin emails
        let locationSentCount = 0
        let locationFailedCount = 0

        for (const email of targetEmails) {
          let sendErrorMessage: string | null = null
          let sendErrorCode: string | null = null

          try {
            const sendEmailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                recipientEmail: email,
                templateName: 'custom_html',
                templateData: {
                  subject: `Daily Activity Report - ${location.name} - ${reportDate}`,
                  html: emailHTML,
                  previewText: `${activityReport.totalEvents} staff activities recorded - ${reportDate}`,
                },
              }),
            })

            if (sendEmailResponse.ok) {
              // Store activity report in database
              await supabase.from('activity_report_logs').insert({
                location_id: location.id,
                report_date: reportDate,
                staff_activity_summary: {
                  totalSessions: activityReport.totalSessions,
                  totalEvents: activityReport.totalEvents,
                  totalActiveSessions: activityReport.totalActiveSessions,
                },
                event_breakdown: activityReport.eventBreakdown,
                role_wise_activity: activityReport.roleActivity,
                sent_at: new Date().toISOString(),
              })

              // Log successful send
              await supabase.rpc('log_report_send_attempt', {
                p_location_id: location.id,
                p_report_type: 'activity_daily',
                p_recipient_email: email,
                p_report_date: reportDate,
                p_status: 'success',
                p_error_message: null,
                p_error_code: null,
              })

              locationSentCount++
              sentCount++
              console.log(`Activity report sent to ${email}`)
            } else {
              const errorResponse = await sendEmailResponse.text()
              sendErrorMessage = `HTTP ${sendEmailResponse.status}: ${errorResponse.substring(0, 200)}`
              sendErrorCode = `EMAIL_SEND_ERROR_${sendEmailResponse.status}`

              // Log failed send
              await supabase.rpc('log_report_send_attempt', {
                p_location_id: location.id,
                p_report_type: 'activity_daily',
                p_recipient_email: email,
                p_report_date: reportDate,
                p_status: 'failed',
                p_error_message: sendErrorMessage,
                p_error_code: sendErrorCode,
              })

              locationFailedCount++
              failedCount++
              console.error(`Failed to send activity report to ${email}: ${sendErrorMessage}`)
            }
          } catch (emailError) {
            sendErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown error'
            sendErrorCode = 'EMAIL_SEND_EXCEPTION'

            // Log exception
            try {
              await supabase.rpc('log_report_send_attempt', {
                p_location_id: location.id,
                p_report_type: 'activity_daily',
                p_recipient_email: email,
                p_report_date: reportDate,
                p_status: 'failed',
                p_error_message: sendErrorMessage,
                p_error_code: sendErrorCode,
              })
            } catch (logError) {
              console.error('Failed to log error:', logError)
            }

            locationFailedCount++
            failedCount++
            console.error(`Error sending to ${email}:`, emailError)
          }
        }

        results.push({
          location: location.name,
          status: locationFailedCount === 0 ? 'sent' : locationSentCount > 0 ? 'partial' : 'failed',
          recipients: targetEmails.length,
          sent: locationSentCount,
          failed: locationFailedCount,
        })
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errorCode = 'REPORT_PROCESSING_ERROR'

        // Try to log the error
        try {
          const targetEmails = recipientEmails || []
          for (const email of targetEmails) {
            await supabase.rpc('log_report_send_attempt', {
              p_location_id: location.id,
              p_report_type: 'activity_daily',
              p_recipient_email: email,
              p_report_date: reportDate,
              p_status: 'failed',
              p_error_message: errorMessage,
              p_error_code: errorCode,
            })
          }
        } catch (logError) {
          console.error('Failed to log error:', logError)
        }

        failedCount++
        results.push({ location: location.id, status: 'failed', error: errorMessage })
        console.error(`Error processing location ${location.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Activity reports processed: ${sentCount} sent, ${failedCount} failed`,
        reportDate,
        results,
        summary: { sent: sentCount, failed: failedCount, total: locations.length },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in send-daily-activity-reports:', error)
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

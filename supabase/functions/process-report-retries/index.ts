import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    console.log('Processing failed reports for retry...')

    // Get all failed reports ready for retry
    const { data: failedReports, error: fetchError } = await supabase.rpc('get_failed_reports_for_retry')

    if (fetchError) {
      console.error('Error fetching failed reports:', fetchError)
      throw fetchError
    }

    let retryCount = 0
    let successCount = 0
    let stillFailedCount = 0
    const superadminAlerts = []

    for (const report of failedReports || []) {
      console.log(`Processing retry for ${report.report_type} to ${report.recipient_email}`)

      try {
        // Trigger the appropriate report send function
        const functionName =
          report.report_type === 'test_drive_daily' ? 'send-daily-test-drive-reports' : 'send-daily-activity-reports'

        const reportResponse = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            reportDate: report.report_date,
            locationIds: [report.location_id],
            recipientEmails: [report.recipient_email],
          }),
        })

        if (reportResponse.ok) {
          successCount++
          console.log(`Retry successful for ${report.recipient_email}`)

          // Log success
          await supabase.rpc('log_report_send_attempt', {
            p_location_id: report.location_id,
            p_report_type: report.report_type,
            p_recipient_email: report.recipient_email,
            p_report_date: report.report_date,
            p_status: 'success',
            p_error_message: null,
            p_error_code: null,
          })
        } else {
          stillFailedCount++
          const errorText = await reportResponse.text()
          console.error(`Retry still failing for ${report.recipient_email}: ${errorText}`)

          // Log retry failure
          await supabase.rpc('log_report_send_attempt', {
            p_location_id: report.location_id,
            p_report_type: report.report_type,
            p_recipient_email: report.recipient_email,
            p_report_date: report.report_date,
            p_status: 'failed',
            p_error_message: `Retry attempt ${report.attempt_number}: ${errorText.substring(0, 200)}`,
            p_error_code: 'REPORT_GENERATION_ERROR',
          })

          // If this is the 3rd attempt, add to superadmin alerts
          if (report.attempt_number >= 3) {
            superadminAlerts.push({
              reportType: report.report_type,
              email: report.recipient_email,
              date: report.report_date,
              error: errorText.substring(0, 150),
            })
          }
        }

        retryCount++
      } catch (error) {
        console.error(`Error processing retry:`, error)
        stillFailedCount++
      }

      // Rate limit retries - add delay between attempts
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Send superadmin notification emails if there are alerts
    if (superadminAlerts.length > 0) {
      try {
        console.log(`Sending superadmin alerts for ${superadminAlerts.length} failed reports...`)

        // Get superadmin email(s) - assuming there's a way to fetch them
        const { data: superadmins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'superadmin')

        if (superadmins && superadmins.length > 0) {
          for (const admin of superadmins) {
            const { data: profile } = await supabase.from('profiles').select('email').eq('user_id', admin.user_id).single()

            if (profile?.email) {
              // Send alert email
              await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  recipientEmail: profile.email,
                  templateName: 'custom_html',
                  templateData: {
                    subject: `⚠️ Report Delivery Failed - Requires Attention (${superadminAlerts.length} reports)`,
                    html: generateSuperadminAlertHTML(superadminAlerts),
                    previewText: 'Report delivery failures requiring attention',
                  },
                }),
              })

              console.log(`Alert sent to superadmin: ${profile.email}`)
            }
          }
        }
      } catch (error) {
        console.error('Error sending superadmin alerts:', error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${retryCount} reports: ${successCount} succeeded, ${stillFailedCount} still failed`,
        stats: {
          processed: retryCount,
          succeeded: successCount,
          stillFailed: stillFailedCount,
          superadminAlerts: superadminAlerts.length,
        },
        alerts: superadminAlerts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in process-report-retries:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateSuperadminAlertHTML(alerts: any[]): string {
  const alertRows = alerts
    .map(
      (alert) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-size: 13px;">${alert.date}</td>
      <td style="padding: 12px; font-size: 13px;">${alert.reportType === 'test_drive_daily' ? '📊 Test Drive' : '📋 Activity'}</td>
      <td style="padding: 12px; font-size: 13px;">${alert.email}</td>
      <td style="padding: 12px; font-size: 13px; color: #ef4444;">${alert.error}</td>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section h2 { font-size: 16px; font-weight: 700; color: #1f2937; margin: 0 0 16px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    .alert-box { background: #fee2e2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
    .alert-box p { margin: 0; font-size: 14px; color: #991b1b; }
    .footer { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Report Delivery Failures</h1>
      <p>The following reports failed delivery after 3 retry attempts</p>
    </div>

    <div class="alert-box">
      <p><strong>Urgent Action Required:</strong> ${alerts.length} report(s) failed to deliver after maximum retry attempts. Review and take corrective action.</p>
    </div>

    <div class="section">
      <h2>Failed Reports Details</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Report Type</th>
            <th>Recipient Email</th>
            <th>Error Message</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Recommended Actions</h2>
      <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
        <li>Check email configuration for recipients</li>
        <li>Verify recipient email addresses are valid</li>
        <li>Check email suppression list</li>
        <li>Review Supabase email logs for detailed errors</li>
        <li>Consider rate-limiting or troubleshooting email service</li>
      </ol>
    </div>

    <div class="footer">
      <p>This is an automated alert from Report Delivery Monitor.<br>Generated at ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

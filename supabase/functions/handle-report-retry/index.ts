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
    const body = await req.json()
    const { locationId, reportType, recipientEmail, reportDate } = body

    if (!locationId || !reportType || !recipientEmail || !reportDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: locationId, reportType, recipientEmail, reportDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Retrying report: ${reportType} for ${recipientEmail} on ${reportDate}`)

    // Get failed attempt to verify attempt number
    const { data: failedAttempt, error: fetchError } = await supabase
      .from('report_send_attempts')
      .select('*')
      .eq('location_id', locationId)
      .eq('report_type', reportType)
      .eq('recipient_email', recipientEmail)
      .eq('report_date', reportDate)
      .eq('status', 'failed')
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    if (!failedAttempt) {
      return new Response(
        JSON.stringify({ error: 'No failed attempt found to retry' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (failedAttempt.attempt_number >= 3) {
      return new Response(
        JSON.stringify({ error: 'Maximum retry attempts (3) exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger appropriate report send function based on report type
    const functionName =
      reportType === 'test_drive_daily' ? 'send-daily-test-drive-reports' : 'send-daily-activity-reports'

    const reportResponse = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        reportDate: reportDate,
        locationIds: [locationId],
        recipientEmails: [recipientEmail], // Force send to specific email only
      }),
    })

    if (reportResponse.ok) {
      console.log(`Report retry successful for ${recipientEmail}`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Report retry triggered successfully',
          locationId,
          reportType,
          recipientEmail,
          reportDate,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const errorData = await reportResponse.text()
      console.error(`Report retry failed: ${errorData}`)

      // Log the retry failure attempt
      await supabase.rpc('log_report_send_attempt', {
        p_location_id: locationId,
        p_report_type: reportType,
        p_recipient_email: recipientEmail,
        p_report_date: reportDate,
        p_status: 'failed',
        p_error_message: `Retry attempt failed: ${errorData}`,
        p_error_code: 'REPORT_GENERATION_ERROR',
      })

      return new Response(
        JSON.stringify({ error: 'Failed to trigger report retry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in handle-report-retry:', error)

    // Log system error
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('System error:', errorMsg)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

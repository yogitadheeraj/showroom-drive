import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to get current day name
function getCurrentDayName(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date().getDay()]
}

// Helper to check if current time matches schedule in timezone
function shouldSendNow(scheduleTime: string, timezone: string): boolean {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false })
  const [hours, minutes] = timeStr.split(':').slice(0, 2)
  const currentTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`

  // Allow 5-minute buffer
  const scheduleParts = scheduleTime.split(':')
  const scheduleHours = parseInt(scheduleParts[0])
  const scheduleMinutes = parseInt(scheduleParts[1])
  const scheduleDate = new Date()
  scheduleDate.setHours(scheduleHours, scheduleMinutes, 0)

  const nowDate = new Date()
  const diff = Math.abs(nowDate.getTime() - scheduleDate.getTime())

  return diff < 5 * 60 * 1000 // 5 minutes
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
    // Get current date and day
    const today = new Date().toISOString().split('T')[0]
    const currentDay = getCurrentDayName()

    console.log(`Checking schedules for ${today} (${currentDay})`)

    // Fetch all enabled schedules
    const { data: schedules, error: fetchError } = await supabase
      .from('report_schedule_config')
      .select('*')
      .eq('is_enabled', true)

    if (fetchError) {
      throw fetchError
    }

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No schedules enabled', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processedCount = 0
    const results = []

    for (const schedule of schedules) {
      // Check if today is in the days_of_week
      if (!schedule.days_of_week.includes(currentDay)) {
        console.log(`Skipping ${schedule.report_type} - not scheduled for ${currentDay}`)
        continue
      }

      // Check if current time matches schedule time
      if (!shouldSendNow(schedule.schedule_time, schedule.timezone)) {
        console.log(`Skipping ${schedule.report_type} - time mismatch`)
        continue
      }

      // Check if report was already sent today
      const { data: lastSent } = await supabase
        .from('report_schedule_config')
        .select('last_sent_at')
        .eq('id', schedule.id)
        .single()

      if (lastSent?.last_sent_at) {
        const lastSentDate = new Date(lastSent.last_sent_at).toISOString().split('T')[0]
        if (lastSentDate === today) {
          console.log(`Skipping ${schedule.report_type} - already sent today`)
          continue
        }
      }

      // Get email recipients for this location and report type
      const { data: recipients, error: recipientError } = await supabase
        .from('report_email_config')
        .select('email_address')
        .eq('location_id', schedule.location_id)
        .eq('is_enabled', true)
        .filter(
          'report_type',
          'in',
          `(${schedule.report_type},both)`
        )

      if (recipientError) {
        console.error(`Error fetching recipients for ${schedule.report_type}:`, recipientError)
        continue
      }

      if (!recipients || recipients.length === 0) {
        console.log(`No recipients configured for ${schedule.report_type}`)
        continue
      }

      // Trigger the appropriate report function
      const functionName =
        schedule.report_type === 'test_drive_daily' ? 'send-daily-test-drive-reports' : 'send-daily-activity-reports'

      try {
        const reportResponse = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            reportDate: today,
            locationIds: [schedule.location_id],
          }),
        })

        if (reportResponse.ok) {
          // Update last_sent_at
          await supabase
            .from('report_schedule_config')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('id', schedule.id)

          processedCount++
          results.push({
            scheduleId: schedule.id,
            reportType: schedule.report_type,
            location: schedule.location_id,
            status: 'sent',
            recipients: recipients.length,
          })

          console.log(`Report sent for ${schedule.report_type} to ${recipients.length} recipients`)
        } else {
          const errorData = await reportResponse.text()
          console.error(`Failed to send ${schedule.report_type}:`, errorData)
          results.push({
            scheduleId: schedule.id,
            reportType: schedule.report_type,
            location: schedule.location_id,
            status: 'failed',
            error: 'Report generation failed',
          })
        }
      } catch (error) {
        console.error(`Error triggering ${functionName}:`, error)
        results.push({
          scheduleId: schedule.id,
          reportType: schedule.report_type,
          location: schedule.location_id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed scheduled reports: ${processedCount} sent`,
        date: today,
        day: currentDay,
        processed: processedCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in trigger-scheduled-reports:', error)
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

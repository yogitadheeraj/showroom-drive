import { supabase } from '@/integrations/supabase/client'

export interface ReportTriggerOptions {
  reportTypes?: ('test_drive_daily' | 'activity_daily')[]
  locationIds?: string[]
  reportDate?: string
}

/**
 * Triggers manual sending of test drive reports
 */
export async function triggerTestDriveReports(options: ReportTriggerOptions = {}) {
  try {
    const response = await supabase.functions.invoke('send-daily-test-drive-reports', {
      body: {
        reportDate: options.reportDate || new Date().toISOString().split('T')[0],
        dealerIds: options.locationIds,
      },
    })

    if (response.error) {
      throw response.error
    }

    return response.data
  } catch (error) {
    console.error('Error triggering test drive reports:', error)
    throw error
  }
}

/**
 * Triggers manual sending of activity reports
 */
export async function triggerActivityReports(options: ReportTriggerOptions = {}) {
  try {
    const response = await supabase.functions.invoke('send-daily-activity-reports', {
      body: {
        reportDate: options.reportDate || new Date().toISOString().split('T')[0],
        locationIds: options.locationIds,
      },
    })

    if (response.error) {
      throw response.error
    }

    return response.data
  } catch (error) {
    console.error('Error triggering activity reports:', error)
    throw error
  }
}

/**
 * Triggers the scheduled reports checker
 * This should be called periodically (e.g., every 5-10 minutes) by a cron job
 */
export async function triggerScheduledReportCheck() {
  try {
    const response = await supabase.functions.invoke('trigger-scheduled-reports', {
      body: {},
    })

    if (response.error) {
      throw response.error
    }

    return response.data
  } catch (error) {
    console.error('Error triggering scheduled report check:', error)
    throw error
  }
}

/**
 * Get all report schedules for a location
 */
export async function getReportSchedules(locationId: string) {
  try {
    const { data, error } = await supabase
      .from('report_schedule_config')
      .select('*')
      .eq('location_id', locationId)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching report schedules:', error)
    throw error
  }
}

/**
 * Get all email recipients for a location
 */
export async function getReportEmailRecipients(locationId: string) {
  try {
    const { data, error } = await supabase
      .from('report_email_config')
      .select('*')
      .eq('location_id', locationId)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching email recipients:', error)
    throw error
  }
}

/**
 * Get sent reports for a location
 */
export async function getReportHistory(locationId: string, limit = 30) {
  try {
    const { data, error } = await supabase
      .from('daily_test_drive_reports')
      .select('*')
      .eq('location_id', locationId)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching report history:', error)
    throw error
  }
}

/**
 * Get activity report history
 */
export async function getActivityReportHistory(locationId: string, limit = 30) {
  try {
    const { data, error } = await supabase
      .from('activity_report_logs')
      .select('*')
      .eq('location_id', locationId)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching activity report history:', error)
    throw error
  }
}

import { apiDbQuery } from '@/lib/apiClient'
import {
  sendDailyActivityReports,
  sendDailyTestDriveReports,
  triggerScheduledReports,
} from '@/lib/functionService'

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
    return await sendDailyTestDriveReports({
      reportDate: options.reportDate || new Date().toISOString().split('T')[0],
      locationIds: options.locationIds,
    })
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
    return await sendDailyActivityReports({
      reportDate: options.reportDate || new Date().toISOString().split('T')[0],
      locationIds: options.locationIds,
    })
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
    return await triggerScheduledReports({})
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
    return await apiDbQuery<any[]>({
      table: 'report_schedule_config',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: locationId }],
    })
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
    return await apiDbQuery<any[]>({
      table: 'report_email_config',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: locationId }],
    })
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
    return await apiDbQuery<any[]>({
      table: 'daily_test_drive_reports',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: locationId }],
      order: [{ field: 'sent_at', ascending: false }],
      limit,
    })
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
    return await apiDbQuery<any[]>({
      table: 'activity_report_logs',
      action: 'select',
      select: '*',
      filters: [{ field: 'location_id', op: 'eq', value: locationId }],
      order: [{ field: 'sent_at', ascending: false }],
      limit,
    })
  } catch (error) {
    console.error('Error fetching activity report history:', error)
    throw error
  }
}

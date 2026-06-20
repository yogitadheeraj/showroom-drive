import { getFirebaseIdToken } from '@/integrations/supabase/client'
import { SELECTED_LOCATION_KEY } from '@/hooks/useDealerContext'
import { apiDbQuery, apiDelete, apiGet, apiPost, apiPut } from '@/lib/apiClient'
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

export interface ReportDispatchConfig {
  id: string
  location_id: string
  report_type: 'test_drive_daily' | 'activity_daily'
  enabled: boolean
  send_time_utc: string
  recipient_roles: Array<'dealer_admin' | 'sales'>
  formats: Array<'excel' | 'pdf'>
  last_dispatched_for_date: string | null
  created_at: string
  updated_at: string
}

type DownloadFormat = 'excel' | 'pdf'
export type ReportType = 'test_drive_daily' | 'activity_daily'
export type DateRangeMode = 'today' | 'weekly' | 'custom'

export interface DownloadRangeInput {
  mode: DateRangeMode
  anchorDate?: string
  startDate?: string
  endDate?: string
}

export interface ReportRecipientsPreview {
  location_id: string
  recipient_roles: Array<'dealer_admin' | 'sales'>
  recipients: string[]
  count: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

async function downloadReportFile(params: {
  locationId: string
  reportDate?: string
  format: DownloadFormat
  reportType?: ReportType
}) {
  const token = await getFirebaseIdToken()
  if (!token) throw new Error('Unauthorized')

  const query = new URLSearchParams({
    location_id: params.locationId,
    report_date: params.reportDate || new Date().toISOString().slice(0, 10),
    format: params.format,
    report_type: params.reportType || 'test_drive_daily',
  })

  const selectedLocationId = localStorage.getItem(SELECTED_LOCATION_KEY)
  const response = await fetch(`${API_BASE_URL}/api/reports/download?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(selectedLocationId ? { 'X-Selected-Location-Id': selectedLocationId } : {}),
    },
  })

  if (!response.ok) {
    let message = `Download failed (${response.status})`
    try {
      const body = await response.json()
      message = body?.error?.message || message
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition') || ''
  const match = contentDisposition.match(/filename="?([^\"]+)"?/i)
  const filename = match?.[1] || `report-${params.reportDate || new Date().toISOString().slice(0, 10)}.${params.format === 'pdf' ? 'pdf' : 'xlsx'}`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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

export async function downloadTestDriveReport(options: {
  locationId: string
  reportDate?: string
  format: DownloadFormat
  reportType?: ReportType
}) {
  return downloadReportFile(options)
}

function toIsoDate(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toISOString().slice(0, 10)
}

function datesInRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const out: string[] = []

  for (let d = start; d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    out.push(toIsoDate(d))
  }

  return out
}

export function resolveDownloadDates(input: DownloadRangeInput): string[] {
  if (input.mode === 'today') {
    return [toIsoDate(input.anchorDate || new Date())]
  }

  if (input.mode === 'weekly') {
    const base = new Date(`${(input.anchorDate || toIsoDate(new Date()))}T00:00:00.000Z`)
    const day = base.getUTCDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(base)
    monday.setUTCDate(base.getUTCDate() - diffToMonday)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    return datesInRange(toIsoDate(monday), toIsoDate(sunday))
  }

  if (!input.startDate || !input.endDate) {
    throw new Error('Custom range requires startDate and endDate')
  }
  if (input.startDate > input.endDate) {
    throw new Error('startDate must be less than or equal to endDate')
  }

  return datesInRange(input.startDate, input.endDate)
}

export async function downloadReportRange(options: {
  locationId: string
  format: DownloadFormat
  reportType?: ReportType
  range: DownloadRangeInput
}) {
  const dates = resolveDownloadDates(options.range)
  for (const reportDate of dates) {
    await downloadReportFile({
      locationId: options.locationId,
      reportDate,
      format: options.format,
      reportType: options.reportType,
    })
  }
}

export async function sendReportNow(options: {
  location_id: string
  report_date?: string
  report_type?: 'test_drive_daily' | 'activity_daily'
  recipient_roles?: Array<'dealer_admin' | 'sales'>
  formats?: Array<'excel' | 'pdf'>
}) {
  return apiPost<{ queued: number; recipients: string[] }>('/api/reports/send', options as unknown as Record<string, unknown>)
}

export async function previewReportRecipients(args: {
  locationId: string
  recipientRoles: Array<'dealer_admin' | 'sales'>
}) {
  const roleCsv = args.recipientRoles.join(',')
  const query = new URLSearchParams({
    location_id: args.locationId,
    recipient_roles: roleCsv,
  }).toString()

  return apiGet<ReportRecipientsPreview>(`/api/reports/recipients-preview?${query}`)
}

export async function listDispatchConfigs(locationId?: string) {
  const query = locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''
  return apiGet<ReportDispatchConfig[]>(`/api/reports/dispatch-config${query}`)
}

export async function upsertDispatchConfig(payload: {
  location_id: string
  report_type: 'test_drive_daily' | 'activity_daily'
  enabled: boolean
  send_time_utc: string
  recipient_roles: Array<'dealer_admin' | 'sales'>
  formats: Array<'excel' | 'pdf'>
}) {
  return apiPut<ReportDispatchConfig>('/api/reports/dispatch-config', payload as unknown as Record<string, unknown>)
}

export async function deleteDispatchConfig(locationId: string, reportType: 'test_drive_daily' | 'activity_daily') {
  return apiDelete(`/api/reports/dispatch-config/${encodeURIComponent(locationId)}?report_type=${encodeURIComponent(reportType)}`)
}

export async function getReportAuditHistory(locationIds: string[] | null, limit = 100) {
  return getReportAuditHistoryWithRange({ locationIds, limit })
}

export async function getReportAuditHistoryWithRange(args: {
  locationIds: string[] | null
  limit?: number
  startDate?: string
  endDate?: string
}) {
  const filters: Array<{ field: string; op: 'in' | 'gte' | 'lte'; value: unknown }> = []

  if (Array.isArray(args.locationIds) && args.locationIds.length) {
    filters.push({ field: 'location_id', op: 'in', value: args.locationIds })
  }
  if (args.startDate) {
    filters.push({ field: 'created_at', op: 'gte', value: `${args.startDate}T00:00:00.000Z` })
  }
  if (args.endDate) {
    filters.push({ field: 'created_at', op: 'lte', value: `${args.endDate}T23:59:59.999Z` })
  }

  return apiDbQuery<any[]>({
    table: 'report_audit_logs',
    action: 'select',
    select: '*',
    filters: filters.length ? filters : undefined,
    order: [{ field: 'created_at', ascending: false }],
    limit: args.limit ?? 100,
  })
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

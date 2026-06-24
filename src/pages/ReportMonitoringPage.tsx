import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiDbQuery, apiGet } from '@/lib/apiClient'
import {
  downloadReportRange,
  getReportAuditHistoryWithRange,
  listDispatchConfigs,
  previewReportRecipients,
  resolveDownloadDates,
  sendReportNow,
  type DateRangeMode,
  type ReportDispatchConfig,
  type ReportType,
} from '@/lib/reportService'
import { useDealerContext } from '@/hooks/useDealerContext'
import { toast } from 'sonner'

interface ReportAuditLog {
  id: string
  action: 'download' | 'send_queued' | 'schedule_dispatch'
  status: 'success' | 'failed'
  location_id: string
  report_type: ReportType
  report_date: string
  format: 'excel' | 'pdf' | 'mixed' | null
  recipient_email: string | null
  message: string | null
  created_at: string
}

const REPORT_SECTIONS: Array<{ key: ReportType; label: string; description: string }> = [
  {
    key: 'test_drive_daily',
    label: 'Test Drive Section',
    description: 'Bookings, completion and no-show trends',
  },
  {
    key: 'activity_daily',
    label: 'Activity Section',
    description: 'Staff activity volume and delivery audit activity',
  },
]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const ReportMonitoringPage = () => {
  const { dealerLocations, dealerLocationIds, selectedLocationId } = useDealerContext()

  const [configs, setConfigs] = useState<ReportDispatchConfig[]>([])
  const [logs, setLogs] = useState<ReportAuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [mode, setMode] = useState<DateRangeMode>('today')
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  const [locationId, setLocationId] = useState<string | null>(null)
  const [selectedSections, setSelectedSections] = useState<ReportType[]>(['test_drive_daily', 'activity_daily'])
  const [recipientRoles, setRecipientRoles] = useState<Array<'dealer_admin' | 'sales' | 'sales_person'>>(['dealer_admin'])
  const [recipientPreview, setRecipientPreview] = useState<string[]>([])

  // Activity log UI state
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [logFilterAction, setLogFilterAction] = useState<'all' | 'download' | 'send_queued' | 'schedule_dispatch'>('all')
  const [logFilterStatus, setLogFilterStatus] = useState<'all' | 'success' | 'failed'>('all')
  const [logFilterSection, setLogFilterSection] = useState<'all' | ReportType>('all')
  const [logFilterRecipient, setLogFilterRecipient] = useState('')

  const [stats, setStats] = useState({
    totalTestDrives: 0,
    completedTestDrives: 0,
    noShowTestDrives: 0,
    activityEvents: 0,
    reportDownloads: 0,
    queuedSends: 0,
  })

  const locationChoices = useMemo(() => {
    const byDealer = (dealerLocations || []).map((l) => ({ id: l.id, name: l.name }))
    const fromConfigs = Array.from(new Set((configs || []).map((c) => c.location_id))).map((id) => ({ id, name: id }))
    const map = new Map<string, string>()
    for (const row of [...byDealer, ...fromConfigs]) {
      map.set(row.id, map.get(row.id) || row.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [dealerLocations, configs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logFilterAction !== 'all' && log.action !== logFilterAction) return false
      if (logFilterStatus !== 'all' && log.status !== logFilterStatus) return false
      if (logFilterSection !== 'all' && log.report_type !== logFilterSection) return false
      if (logFilterRecipient && !(log.recipient_email || '').toLowerCase().includes(logFilterRecipient.toLowerCase())) return false
      return true
    })
  }, [logs, logFilterAction, logFilterStatus, logFilterSection, logFilterRecipient])

  const resolvedRange = useMemo(() => {
    try {
      const dates = resolveDownloadDates({
        mode,
        anchorDate,
        startDate,
        endDate,
      })
      return {
        dates,
        start: dates[0],
        end: dates[dates.length - 1],
      }
    } catch {
      return {
        dates: [] as string[],
        start: null as string | null,
        end: null as string | null,
      }
    }
  }, [mode, anchorDate, startDate, endDate])

  const canRunActions = Boolean(locationId && selectedSections.length > 0 && resolvedRange.dates.length > 0)

  // Sync locationId when dealer context loads asynchronously
  useEffect(() => {
    const resolved = selectedLocationId || dealerLocationIds?.[0] || null
    if (resolved && !locationId) {
      setLocationId(resolved)
    }
  }, [selectedLocationId, dealerLocationIds])

  useEffect(() => {
    if (locationId && resolvedRange.start && resolvedRange.end) {
      void loadPageData(locationId, resolvedRange.start, resolvedRange.end)
      void loadRecipientPreview(locationId)
    }
  }, [locationId, mode, anchorDate, startDate, endDate, recipientRoles.join(',')])

  async function loadRecipientPreview(locId: string) {
    try {
      const data = await previewReportRecipients({
        locationId: locId,
        recipientRoles,
      })
      setRecipientPreview(data?.recipients || [])
    } catch (error) {
      console.error('Failed to load recipient preview', error)
      setRecipientPreview([])
    }
  }

  async function loadPageData(locId: string, rangeStart: string, rangeEnd: string) {
    if (!rangeStart || !rangeEnd) return
    const isAllLocations = locId === ''

    try {
      setLoading(true)

      const tdUrl = isAllLocations
        ? `/api/test-drives?date_gte=${encodeURIComponent(rangeStart)}&date_lte=${encodeURIComponent(rangeEnd)}&include_related=false&limit=5000`
        : `/api/test-drives?location_id=${encodeURIComponent(locId)}&date_gte=${encodeURIComponent(rangeStart)}&date_lte=${encodeURIComponent(rangeEnd)}&include_related=false&limit=5000`

      const actFilters: any[] = [
        { field: 'happened_at', op: 'gte', value: `${rangeStart}T00:00:00.000Z` },
        { field: 'happened_at', op: 'lte', value: `${rangeEnd}T23:59:59.999Z` },
      ]
      if (!isAllLocations && locId) actFilters.unshift({ field: 'location_id', op: 'eq', value: locId })

      const [dispatchConfigs, td, activityEvents, auditLogs] = await Promise.all([
        listDispatchConfigs(),
        apiGet<any[]>(tdUrl),
        apiDbQuery<any[]>({
          table: 'staff_activity_events',
          action: 'select',
          select: 'id,event_type,happened_at',
          filters: actFilters,
          limit: 10000,
        }),
        getReportAuditHistoryWithRange({
          locationIds: isAllLocations ? (dealerLocationIds || null) : (locId ? [locId] : null),
          startDate: rangeStart,
          endDate: rangeEnd,
          limit: 500,
        }),
      ])

      const typedLogs = (auditLogs || []) as ReportAuditLog[]
      const drives = (td || []) as any[]

      setConfigs(isAllLocations
        ? (dispatchConfigs || [])
        : (dispatchConfigs || []).filter((c) => c.location_id === locId))
      setLogs(typedLogs)
      setStats({
        totalTestDrives: drives.length,
        completedTestDrives: drives.filter((x: any) => x.status === 'completed').length,
        noShowTestDrives: drives.filter((x: any) => x.status === 'no_show').length,
        activityEvents: (activityEvents || []).length,
        reportDownloads: typedLogs.filter((x) => x.action === 'download').length,
        queuedSends: typedLogs.filter((x) => x.action === 'send_queued').length,
      })
    } catch (error) {
      console.error('Failed to load report hub data', error)
      toast.error('Failed to load reports data')
    } finally {
      setLoading(false)
    }
  }

  function toggleSection(section: ReportType) {
    setSelectedSections((prev) => {
      const exists = prev.includes(section)
      if (exists) return prev.filter((s) => s !== section)
      return [...prev, section]
    })
  }

  function toggleRecipientRole(role: 'dealer_admin' | 'sales' | 'sales_person') {
    setRecipientRoles((prev) => {
      const exists = prev.includes(role)
      const next = exists ? prev.filter((x) => x !== role) : [...prev, role]
      return next.length ? next : ['dealer_admin']
    })
  }

  async function handleDownload(format: 'excel' | 'pdf') {
    if (!locationId) {
      toast.error('Select a location first')
      return
    }
    if (!selectedSections.length) {
      toast.error('Select at least one report section')
      return
    }
    if (!resolvedRange.start || !resolvedRange.end) {
      toast.error('Choose a valid date range')
      return
    }

    try {
      setActionLoading(true)
      for (const section of selectedSections) {
        await downloadReportRange({
          locationId,
          format,
          reportType: section,
          range: {
            mode,
            anchorDate,
            startDate,
            endDate,
          },
        })
      }
      toast.success(`${format.toUpperCase()} download started for selected sections`)
      if (locationId && resolvedRange.start && resolvedRange.end)
        await loadPageData(locationId, resolvedRange.start, resolvedRange.end)
    } catch (error) {
      console.error('Download failed', error)
      toast.error((error as Error).message || 'Download failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSendNow() {
    if (!locationId || !selectedSections.length || !resolvedRange.dates.length) {
      toast.error('Select location, sections and valid dates first')
      return
    }

    try {
      setActionLoading(true)
      for (const d of resolvedRange.dates) {
        for (const section of selectedSections) {
          await sendReportNow({
            location_id: locationId,
            report_type: section,
            report_date: d,
            recipient_roles: recipientRoles,
            formats: ['excel'],
          })
        }
      }
      toast.success('Reports queued for selected range')
      if (locationId && resolvedRange.start && resolvedRange.end)
        await loadPageData(locationId, resolvedRange.start, resolvedRange.end)
    } catch (error) {
      console.error('Failed to queue reports', error)
      toast.error((error as Error).message || 'Failed to queue reports')
    } finally {
      setActionLoading(false)
    }
  }

  async function runPresetThisWeekExcel() {
    if (!locationId) {
      toast.error('Select a location first')
      return
    }

    const today = isoDate(new Date())
    try {
      setActionLoading(true)
      for (const section of REPORT_SECTIONS.map((s) => s.key)) {
        await downloadReportRange({
          locationId,
          format: 'excel',
          reportType: section,
          range: {
            mode: 'weekly',
            anchorDate: today,
          },
        })
      }
      setSelectedSections(REPORT_SECTIONS.map((s) => s.key))
      setMode('weekly')
      setAnchorDate(today)
      toast.success('Preset export started: This week (Excel, all sections)')
      const weekDates = resolveDownloadDates({ mode: 'weekly', anchorDate: today })
      if (locationId && weekDates[0] && weekDates[weekDates.length - 1])
        await loadPageData(locationId, weekDates[0], weekDates[weekDates.length - 1])
    } catch (error) {
      console.error('Preset weekly excel failed', error)
      toast.error((error as Error).message || 'Preset export failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function runPresetLast7DaysPdf() {
    if (!locationId) {
      toast.error('Select a location first')
      return
    }

    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 6)
    const startIso = isoDate(start)
    const endIso = isoDate(end)

    try {
      setActionLoading(true)
      for (const section of REPORT_SECTIONS.map((s) => s.key)) {
        await downloadReportRange({
          locationId,
          format: 'pdf',
          reportType: section,
          range: {
            mode: 'custom',
            startDate: startIso,
            endDate: endIso,
          },
        })
      }
      setSelectedSections(REPORT_SECTIONS.map((s) => s.key))
      setMode('custom')
      setStartDate(startIso)
      setEndDate(endIso)
      toast.success('Preset export started: Last 7 days (PDF, all sections)')
      if (locationId) await loadPageData(locationId, startIso, endIso)
    } catch (error) {
      console.error('Preset last 7 days pdf failed', error)
      toast.error((error as Error).message || 'Preset export failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function runPresetTodaySend() {
    if (!locationId) {
      toast.error('Select a location first')
      return
    }

    const today = isoDate(new Date())
    try {
      setActionLoading(true)
      for (const section of REPORT_SECTIONS.map((s) => s.key)) {
        await sendReportNow({
          location_id: locationId,
          report_type: section,
          report_date: today,
          recipient_roles: recipientRoles,
          formats: ['excel'],
        })
      }
      setSelectedSections(REPORT_SECTIONS.map((s) => s.key))
      setMode('today')
      setAnchorDate(today)
      toast.success('Preset queued: Today + auto-send (Excel, all sections)')
      if (locationId) await loadPageData(locationId, today, today)
    } catch (error) {
      console.error('Preset today send failed', error)
      toast.error((error as Error).message || 'Preset send failed')
    } finally {
      setActionLoading(false)
    }
  }

  const statCards = [
    { label: 'Total Drives', value: stats.totalTestDrives, color: 'text-foreground', icon: '🚗' },
    { label: 'Completed', value: stats.completedTestDrives, color: 'text-emerald-600 dark:text-emerald-400', icon: '✅' },
    { label: 'No Show', value: stats.noShowTestDrives, color: 'text-red-600 dark:text-red-400', icon: '❌' },
    { label: 'Activity Events', value: stats.activityEvents, color: 'text-blue-600 dark:text-blue-400', icon: '📋' },
    { label: 'Downloads', value: stats.reportDownloads, color: 'text-violet-600 dark:text-violet-400', icon: '⬇️' },
    { label: 'Sent', value: stats.queuedSends, color: 'text-amber-600 dark:text-amber-400', icon: '📤' },
  ]

  return (
    <DashboardLayout>
      <div className='space-y-5 pb-10'>

        {/* ── Page Header ── */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-heading font-bold text-foreground flex items-center gap-2'>
              <span className='h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-base'>📊</span>
              Reports Hub
            </h1>
            <p className='text-sm text-muted-foreground mt-0.5'>Configure scope, verify recipients, then export or send.</p>
          </div>
          {loading && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground animate-pulse'>
              <svg className='h-3.5 w-3.5 animate-spin' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg>
              Loading data…
            </div>
          )}
        </div>

        {/* ── Two-column layout on desktop ── */}
        <div className='grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start'>

          {/* ── LEFT: Scope + Stats ── */}
          <div className='space-y-4'>

            {/* Scope card */}
            <Card className='shadow-sm'>
              <CardHeader className='pb-3'>
                <div className='flex items-center gap-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0'>1</span>
                  <div>
                    <CardTitle className='text-base'>Report Scope</CardTitle>
                    <CardDescription>Choose location, date range, and sections.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Location + date row */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div>
                    <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1'>Location</label>
                    <select
                      className='w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:outline-none'
                      value={locationId || ''}
                      onChange={(e) => setLocationId(e.target.value || null)}
                    >
                      <option value='' disabled>Select location…</option>
                      <option value=''>🏢 All Locations</option>
                      {locationChoices.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1'>Date Range</label>
                    <select
                      className='w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary/30 focus:outline-none'
                      value={mode}
                      onChange={(e) => setMode(e.target.value as DateRangeMode)}
                    >
                      <option value='today'>📅 Today</option>
                      <option value='weekly'>📆 This Week</option>
                      <option value='custom'>🗓️ Custom Range</option>
                    </select>
                  </div>
                </div>

                {/* Date inputs */}
                {(mode === 'today' || mode === 'weekly') && (
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1'>
                        {mode === 'weekly' ? 'Anchor Date' : 'Date'}
                      </label>
                      <Input type='date' value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className='rounded-lg' />
                    </div>
                  </div>
                )}
                {mode === 'custom' && (
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1'>Start</label>
                      <Input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} className='rounded-lg' />
                    </div>
                    <div>
                      <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1'>End</label>
                      <Input type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} className='rounded-lg' />
                    </div>
                  </div>
                )}

                {/* Sections */}
                <div>
                  <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2'>Sections to include</label>
                  <div className='flex flex-wrap gap-2'>
                    {REPORT_SECTIONS.map((section) => {
                      const active = selectedSections.includes(section.key)
                      return (
                        <button
                          key={section.key}
                          type='button'
                          onClick={() => toggleSection(section.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {section.key === 'test_drive_daily' ? '🚗' : '📋'} {section.label}
                          {active && <svg className='h-3 w-3 ml-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}><path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' /></svg>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Range resolved */}
                {resolvedRange.start && (
                  <div className='flex items-center gap-2 rounded-lg bg-muted/40 border border-border/60 px-3 py-2 text-xs'>
                    <span className='text-muted-foreground'>Range:</span>
                    <span className='font-semibold text-foreground'>{resolvedRange.start}</span>
                    {resolvedRange.end !== resolvedRange.start && (
                      <>
                        <span className='text-muted-foreground'>→</span>
                        <span className='font-semibold text-foreground'>{resolvedRange.end}</span>
                      </>
                    )}
                    <Badge variant='secondary' className='ml-auto text-[10px]'>{resolvedRange.dates.length}d</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats grid */}
            <div className='grid grid-cols-3 sm:grid-cols-6 gap-2'>
              {statCards.map(({ label, value, color, icon }) => (
                <div key={label} className='rounded-xl border border-border bg-card px-3 py-3 flex flex-col gap-1 shadow-sm'>
                  <span className='text-base leading-none'>{icon}</span>
                  <span className={`text-xl font-bold leading-none mt-1 ${color}`}>{value}</span>
                  <span className='text-[10px] text-muted-foreground leading-tight'>{label}</span>
                </div>
              ))}
            </div>

          </div>

          {/* ── RIGHT: Sticky panel (recipients + actions) ── */}
          <div className='space-y-4 lg:sticky lg:top-4'>

            {/* Recipients */}
            <Card className='shadow-sm'>
              <CardHeader className='pb-3'>
                <div className='flex items-center gap-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0'>2</span>
                  <div>
                    <CardTitle className='text-base'>Recipients</CardTitle>
                    <CardDescription>Verify who will receive emails.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex gap-2'>
                  {(['dealer_admin', 'sales', 'sales_person'] as const).map((r) => (
                    <button
                      key={r}
                      type='button'
                      onClick={() => toggleRecipientRole(r)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        recipientRoles.includes(r)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {r === 'dealer_admin'
                        ? '👔 Dealer Admin'
                        : r === 'sales'
                          ? '🤝 Sales'
                          : '🧑‍💼 Sales Person'
                      }
                    </button>
                  ))}
                </div>

                {recipientPreview.length === 0 ? (
                  <p className='text-xs text-muted-foreground italic'>No recipients found.</p>
                ) : (
                  <div className='rounded-lg bg-muted/30 border border-border/60 p-2 space-y-1 max-h-[120px] overflow-y-auto'>
                    {recipientPreview.map((email) => (
                      <div key={email} className='flex items-center gap-2 text-xs'>
                        <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0' />
                        <span className='text-foreground truncate'>{email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className='shadow-sm'>
              <CardHeader className='pb-3'>
                <div className='flex items-center gap-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0'>3</span>
                  <div>
                    <CardTitle className='text-base'>Run Actions</CardTitle>
                    <CardDescription>{canRunActions ? 'Ready to export or send.' : 'Complete scope to enable.'}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                {!canRunActions && (
                  <div className='flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400'>
                    <svg className='h-3.5 w-3.5 shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z' /></svg>
                    Pick location + date + at least one section first.
                  </div>
                )}

                {/* Primary actions */}
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    className='gap-1.5 text-xs h-9'
                    onClick={() => void handleDownload('excel')}
                    disabled={actionLoading || !canRunActions}
                  >
                    <svg className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' /></svg>
                    Excel
                  </Button>
                  <Button
                    variant='outline'
                    className='gap-1.5 text-xs h-9'
                    onClick={() => void handleDownload('pdf')}
                    disabled={actionLoading || !canRunActions}
                  >
                    <svg className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' /></svg>
                    PDF
                  </Button>
                </div>
                <Button
                  variant='secondary'
                  className='w-full gap-1.5 text-xs h-9'
                  onClick={() => void handleSendNow()}
                  disabled={actionLoading || !canRunActions}
                >
                  <svg className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5' /></svg>
                  {actionLoading ? 'Sending…' : 'Queue Email Send'}
                </Button>

                {/* Presets */}
                <div className='border-t border-border/60 pt-2 space-y-1.5'>
                  <p className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wide'>Quick Presets</p>
                  {[
                    { label: '📅 This Week — Excel', fn: runPresetThisWeekExcel },
                    { label: '🗓️ Last 7 Days — PDF', fn: runPresetLast7DaysPdf },
                    { label: '⚡ Today + Auto Send', fn: runPresetTodaySend },
                  ].map(({ label, fn }) => (
                    <button
                      key={label}
                      type='button'
                      onClick={() => void fn()}
                      disabled={actionLoading || !locationId}
                      className='w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all'
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* ── Activity Log ── */}
        <Card className='shadow-sm'>
          <div
            className='flex items-center justify-between px-6 py-4 cursor-pointer select-none'
            onClick={() => setLogsExpanded((v) => !v)}
          >
            <div className='flex items-center gap-3'>
              <span className='text-base'>📁</span>
              <div>
                <p className='text-sm font-semibold text-foreground'>Recent Report Activity</p>
                <p className='text-xs text-muted-foreground'>
                  {logsExpanded
                    ? `${filteredLogs.length} of ${logs.length} events shown`
                    : `${logs.length} audit events — click to expand and filter`}
                </p>
              </div>
            </div>
            <div className={`h-7 w-7 rounded-full border border-border flex items-center justify-center transition-transform duration-200 ${logsExpanded ? 'rotate-180' : ''}`}>
              <svg className='h-3.5 w-3.5 text-muted-foreground' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
              </svg>
            </div>
          </div>

          {logsExpanded && (
            <CardContent className='border-t border-border/60 pt-4 space-y-3'>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                {[
                  { label: 'Action', value: logFilterAction, onChange: (v: string) => setLogFilterAction(v as any), options: [['all','All Actions'],['download','Download'],['send_queued','Send Queued'],['schedule_dispatch','Schedule Dispatch']] },
                  { label: 'Status', value: logFilterStatus, onChange: (v: string) => setLogFilterStatus(v as any), options: [['all','All Status'],['success','Success'],['failed','Failed']] },
                  { label: 'Section', value: logFilterSection, onChange: (v: string) => setLogFilterSection(v as any), options: [['all','All Sections'],['test_drive_daily','Test Drive'],['activity_daily','Activity']] },
                ].map(({ label, value, onChange, options }) => (
                  <div key={label}>
                    <label className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block'>{label}</label>
                    <select
                      className='w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:ring-2 focus:ring-primary/30 focus:outline-none'
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    >
                      {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block'>Recipient</label>
                  <input
                    type='text'
                    placeholder='Filter email…'
                    className='w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:ring-2 focus:ring-primary/30 focus:outline-none'
                    value={logFilterRecipient}
                    onChange={(e) => setLogFilterRecipient(e.target.value)}
                  />
                </div>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-xs text-muted-foreground'>{filteredLogs.length} result{filteredLogs.length !== 1 ? 's' : ''}</span>
                <button
                  type='button'
                  onClick={() => { setLogFilterAction('all'); setLogFilterStatus('all'); setLogFilterSection('all'); setLogFilterRecipient('') }}
                  className='text-xs text-primary hover:underline'
                >
                  Clear filters
                </button>
              </div>

              {loading ? (
                <div className='text-sm text-muted-foreground py-4 text-center'>Loading…</div>
              ) : filteredLogs.length === 0 ? (
                <div className='text-sm text-muted-foreground py-6 text-center'>No activity matches current filters.</div>
              ) : (
                <div className='overflow-x-auto rounded-lg border border-border/60'>
                  <table className='w-full text-xs'>
                    <thead className='bg-muted/40'>
                      <tr>
                        {['Time','Action','Section','Date','Status','Recipient'].map((h) => (
                          <th key={h} className='text-left py-2 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide whitespace-nowrap'>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.slice(0, 200).map((log, idx) => (
                        <tr key={log.id} className={`border-t border-border/40 hover:bg-muted/10 ${idx % 2 === 1 ? 'bg-muted/5' : ''}`}>
                          <td className='py-2 px-3 text-muted-foreground whitespace-nowrap'>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                          <td className='py-2 px-3'>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              log.action === 'download' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                              : log.action === 'send_queued' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-muted text-muted-foreground border-border'
                            }`}>
                              {log.action === 'download' ? '⬇️' : log.action === 'send_queued' ? '📤' : '⚙️'} {log.action}
                            </span>
                          </td>
                          <td className='py-2 px-3 text-muted-foreground'>{log.report_type === 'test_drive_daily' ? 'Test Drive' : 'Activity'}</td>
                          <td className='py-2 px-3 font-mono text-muted-foreground'>{log.report_date}</td>
                          <td className='py-2 px-3'>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              log.status === 'success'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            }`}>
                              {log.status === 'success' ? '✓' : '✗'} {log.status}
                            </span>
                          </td>
                          <td className='py-2 px-3 text-muted-foreground truncate max-w-[160px]'>{log.recipient_email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredLogs.length > 200 && (
                    <p className='text-xs text-muted-foreground p-3 text-center border-t border-border/40'>Showing 200 of {filteredLogs.length}. Narrow filters to see more.</p>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

      </div>
    </DashboardLayout>
  )
}

export default ReportMonitoringPage

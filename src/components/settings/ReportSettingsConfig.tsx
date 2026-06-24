import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useDealerContext } from '@/hooks/useDealerContext'
import {
  deleteDispatchConfig,
  listDispatchConfigs,
  type ReportDispatchConfig,
  sendReportNow,
  upsertDispatchConfig,
} from '@/lib/reportService'

const REPORT_TYPES: Array<'test_drive_daily' | 'activity_daily'> = ['test_drive_daily', 'activity_daily']

function reportTypeLabel(v: 'test_drive_daily' | 'activity_daily') {
  return v === 'test_drive_daily' ? 'Test Drive Daily' : 'Activity Daily'
}

const ReportSettingsConfig = () => {
  const { profile } = useAuth()
  const { selectedLocationId, dealerLocationIds } = useDealerContext()

  const [configs, setConfigs] = useState<ReportDispatchConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const [sendingFor, setSendingFor] = useState<string | null>(null)

  const effectiveLocationId = useMemo(() => {
    if (selectedLocationId) return selectedLocationId
    if (profile?.location_id) return profile.location_id
    return dealerLocationIds?.[0] || null
  }, [selectedLocationId, profile?.location_id, dealerLocationIds])

  type ReportRecipientRole = 'dealer_admin' | 'sales' | 'sales_person'
  const [form, setForm] = useState<Record<'test_drive_daily' | 'activity_daily', {
    enabled: boolean
    send_time_utc: string
    recipient_roles: Array<ReportRecipientRole>
    formats: Array<'excel' | 'pdf'>
  }>>({
    test_drive_daily: { enabled: true, send_time_utc: '18:00', recipient_roles: ['dealer_admin'], formats: ['excel'] },
    activity_daily: { enabled: false, send_time_utc: '18:00', recipient_roles: ['dealer_admin'], formats: ['excel'] },
  })

  useEffect(() => {
    if (!effectiveLocationId) return
    void load()
  }, [effectiveLocationId])

  async function load() {
    if (!effectiveLocationId) return
    try {
      setLoading(true)
      const data = await listDispatchConfigs(effectiveLocationId)
      setConfigs(data || [])

      const next = { ...form }
      for (const type of REPORT_TYPES) {
        const cfg = (data || []).find((x) => x.location_id === effectiveLocationId && x.report_type === type)
        if (cfg) {
          next[type] = {
            enabled: Boolean(cfg.enabled),
            send_time_utc: cfg.send_time_utc || '18:00',
            recipient_roles: (cfg.recipient_roles?.length ? cfg.recipient_roles : ['dealer_admin']) as Array<ReportRecipientRole>,
            formats: (cfg.formats?.length ? cfg.formats : ['excel']) as Array<'excel' | 'pdf'>,
          }
        }
      }
      setForm(next)
    } catch (error) {
      console.error('Failed to load dispatch config', error)
      toast.error('Failed to load report settings')
    } finally {
      setLoading(false)
    }
  }

  function toggleRole(type: 'test_drive_daily' | 'activity_daily', role: 'dealer_admin' | 'sales' | 'sales_person') {
    const current = form[type].recipient_roles
    const exists = current.includes(role)
    const next = exists ? current.filter((x) => x !== role) : [...current, role]
    setForm((prev) => ({
      ...prev,
      [type]: { ...prev[type], recipient_roles: next.length ? next : ['dealer_admin'] },
    }))
  }

  function toggleFormat(type: 'test_drive_daily' | 'activity_daily', fmt: 'excel' | 'pdf') {
    const current = form[type].formats
    const exists = current.includes(fmt)
    const next = exists ? current.filter((x) => x !== fmt) : [...current, fmt]
    setForm((prev) => ({
      ...prev,
      [type]: { ...prev[type], formats: next.length ? next : ['excel'] },
    }))
  }

  async function save(type: 'test_drive_daily' | 'activity_daily') {
    if (!effectiveLocationId) return
    try {
      setSavingFor(type)
      await upsertDispatchConfig({
        location_id: effectiveLocationId,
        report_type: type,
        enabled: form[type].enabled,
        send_time_utc: form[type].send_time_utc,
        recipient_roles: form[type].recipient_roles,
        formats: form[type].formats,
      })
      toast.success(`${reportTypeLabel(type)} settings saved`)
      await load()
    } catch (error) {
      console.error('Failed to save dispatch config', error)
      toast.error('Failed to save report settings')
    } finally {
      setSavingFor(null)
    }
  }

  async function remove(type: 'test_drive_daily' | 'activity_daily') {
    if (!effectiveLocationId) return
    try {
      await deleteDispatchConfig(effectiveLocationId, type)
      toast.success(`${reportTypeLabel(type)} config removed`)
      await load()
    } catch (error) {
      console.error('Failed to delete dispatch config', error)
      toast.error('Failed to delete config')
    }
  }

  async function sendNow(type: 'test_drive_daily' | 'activity_daily') {
    if (!effectiveLocationId) return
    try {
      setSendingFor(type)
      await sendReportNow({
        location_id: effectiveLocationId,
        report_type: type,
        report_date: new Date().toISOString().slice(0, 10),
        recipient_roles: form[type].recipient_roles,
        formats: form[type].formats,
      })
      toast.success(`${reportTypeLabel(type)} queued`) 
    } catch (error) {
      console.error('Failed to send report now', error)
      toast.error('Failed to send report')
    } finally {
      setSendingFor(null)
    }
  }

  if (!effectiveLocationId) {
    return (
      <Card>
        <CardContent className='pt-6 text-sm text-muted-foreground'>
          Select a location to configure report dispatch.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Report Dispatch Configuration</CardTitle>
          <CardDescription>
            Configure automatic report delivery for this showroom. Recipients are role-based (Dealer Admin / Sales / Sales Person).
          </CardDescription>
        </CardHeader>
        <CardContent className='text-xs text-muted-foreground'>
          Location: <span className='font-medium text-foreground'>{effectiveLocationId}</span>
        </CardContent>
      </Card>

      {REPORT_TYPES.map((type) => {
        const cfg = form[type]
        const existing = configs.find((c) => c.report_type === type && c.location_id === effectiveLocationId)
        return (
          <Card key={type}>
            <CardHeader>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <CardTitle className='text-base'>{reportTypeLabel(type)}</CardTitle>
                  <CardDescription>
                    {existing?.last_dispatched_for_date
                      ? `Last dispatched: ${existing.last_dispatched_for_date}`
                      : 'No dispatch run yet'}
                  </CardDescription>
                </div>
                <Badge variant='outline'>{type}</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Enable schedule</p>
                  <p className='text-xs text-muted-foreground'>When disabled, job will skip this report type.</p>
                </div>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, [type]: { ...prev[type], enabled: v } }))}
                />
              </div>

              <div>
                <label className='text-sm font-medium'>Send Time (UTC)</label>
                <Input
                  type='time'
                  value={cfg.send_time_utc}
                  onChange={(e) => setForm((prev) => ({ ...prev, [type]: { ...prev[type], send_time_utc: e.target.value } }))}
                  className='mt-1 w-full max-w-[220px]'
                />
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>Recipient Roles</p>
                <div className='flex gap-2 flex-wrap'>
                  <Button
                    type='button'
                    variant={cfg.recipient_roles.includes('dealer_admin') ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => toggleRole(type, 'dealer_admin')}
                  >
                    Dealer Admin
                  </Button>
                  <Button
                    type='button'
                    variant={cfg.recipient_roles.includes('sales') ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => toggleRole(type, 'sales')}
                  >
                    Sales
                  </Button>
                  <Button
                    type='button'
                    variant={cfg.recipient_roles.includes('sales_person') ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => toggleRole(type, 'sales_person')}
                  >
                    Sales Person
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>Formats</p>
                <div className='flex gap-2 flex-wrap'>
                  <Button
                    type='button'
                    variant={cfg.formats.includes('excel') ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => toggleFormat(type, 'excel')}
                  >
                    Excel
                  </Button>
                  <Button
                    type='button'
                    variant={cfg.formats.includes('pdf') ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => toggleFormat(type, 'pdf')}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              <div className='flex gap-2 flex-wrap'>
                <Button onClick={() => save(type)} disabled={savingFor === type || loading}>
                  {savingFor === type ? 'Saving...' : 'Save Config'}
                </Button>
                <Button variant='outline' onClick={() => sendNow(type)} disabled={sendingFor === type}>
                  {sendingFor === type ? 'Sending...' : 'Send Now'}
                </Button>
                <Button variant='destructive' onClick={() => remove(type)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default ReportSettingsConfig

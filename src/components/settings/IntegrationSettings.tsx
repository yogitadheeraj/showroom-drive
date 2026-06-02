import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiDelete, apiPost } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Save, Trash2, FlaskConical,
  MessageSquare, Smartphone, Mail, CalendarDays, Calendar, Building2, Car
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationType = 'whatsapp' | 'sms' | 'email' | 'google_calendar' | 'outlook' | 'crm' | 'dms';

const ALL_EVENTS = [
  { value: 'test_drive_booked',      label: 'Booked' },
  { value: 'test_drive_confirmed',   label: 'Confirmed' },
  { value: 'test_drive_cancelled',   label: 'Cancelled' },
  { value: 'test_drive_completed',   label: 'Completed' },
  { value: 'test_drive_no_show',     label: 'No Show' },
  { value: 'test_drive_in_progress', label: 'In Progress' },
  { value: 'test_drive_rescheduled', label: 'Rescheduled' },
  { value: 'walkin_registered',      label: 'Walk-in' },
];

interface Integration {
  id?: string;
  type: IntegrationType;
  is_enabled: boolean;
  events: string[];
  config: Record<string, string>;
}

// ─── Integration metadata ─────────────────────────────────────────────────────

const INTEGRATION_META: Record<IntegrationType, { label: string; description: string; icon: React.ReactNode }> = {
  whatsapp:        { label: 'WhatsApp',          description: 'Send booking notifications via WhatsApp Business API, Twilio, or a custom webhook.', icon: <MessageSquare className="h-5 w-5 text-green-500" /> },
  sms:             { label: 'SMS Gateway',        description: 'Send SMS confirmations and updates via Twilio or a custom SMS gateway.', icon: <Smartphone className="h-5 w-5 text-blue-500" /> },
  email:           { label: 'Email Platform',     description: 'Send transactional emails via SendGrid or your existing SMTP server.', icon: <Mail className="h-5 w-5 text-orange-500" /> },
  google_calendar: { label: 'Google Calendar',    description: 'Automatically add test drive bookings to a Google Calendar.', icon: <CalendarDays className="h-5 w-5 text-red-500" /> },
  outlook:         { label: 'Microsoft Outlook',  description: 'Add bookings to a Microsoft 365 / Outlook calendar via the Graph API.', icon: <Calendar className="h-5 w-5 text-sky-500" /> },
  crm:             { label: 'CRM',                description: 'Push booking data to your CRM system via a webhook.', icon: <Building2 className="h-5 w-5 text-purple-500" /> },
  dms:             { label: 'DMS',                description: 'Push booking data to your Dealer Management System via a webhook.', icon: <Car className="h-5 w-5 text-indigo-500" /> },
};

const ORDERED_TYPES: IntegrationType[] = ['whatsapp', 'sms', 'email', 'google_calendar', 'outlook', 'crm', 'dms'];

// ─── Config forms per type ────────────────────────────────────────────────────

function WhatsAppConfig({ config, onChange }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void }) {
  const provider = config.provider || 'twilio';
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <Label>Provider</Label>
        <Select value={provider} onValueChange={v => onChange({ provider: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="twilio">Twilio</SelectItem>
            <SelectItem value="waba">Meta WhatsApp Business API</SelectItem>
            <SelectItem value="custom">Custom Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {provider === 'twilio' && (<>
        <ConfigField label="Account SID" k="account_sid" config={config} set={set} />
        <ConfigField label="Auth Token" k="auth_token" config={config} set={set} secret />
        <ConfigField label="From Number (whatsapp:+1...)" k="from_number" config={config} set={set} placeholder="+14155238886" />
      </>)}
      {provider === 'waba' && (<>
        <ConfigField label="Phone Number ID" k="phone_number_id" config={config} set={set} />
        <ConfigField label="Access Token" k="token" config={config} set={set} secret />
      </>)}
      {provider === 'custom' && (<>
        <ConfigField label="Webhook URL" k="api_url" config={config} set={set} placeholder="https://your-api.com/whatsapp" />
        <ConfigField label="Bearer Token (optional)" k="token" config={config} set={set} secret />
      </>)}
    </div>
  );
}

function SMSConfig({ config, onChange }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void }) {
  const provider = config.provider || 'twilio';
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <Label>Provider</Label>
        <Select value={provider} onValueChange={v => onChange({ provider: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="twilio">Twilio</SelectItem>
            <SelectItem value="custom">Custom Gateway</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {provider === 'twilio' && (<>
        <ConfigField label="Account SID" k="account_sid" config={config} set={set} />
        <ConfigField label="Auth Token" k="auth_token" config={config} set={set} secret />
        <ConfigField label="From Number" k="from_number" config={config} set={set} placeholder="+14155238886" />
      </>)}
      {provider === 'custom' && (<>
        <ConfigField label="Gateway URL" k="api_url" config={config} set={set} placeholder="https://sms-gateway.example.com/send" />
        <ConfigField label="API Key (optional)" k="api_key" config={config} set={set} secret />
        <ConfigField label="From (Sender ID)" k="from" config={config} set={set} />
      </>)}
    </div>
  );
}

function EmailConfig({ config, onChange }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void }) {
  const provider = config.provider || 'smtp';
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <Label>Provider</Label>
        <Select value={provider} onValueChange={v => onChange({ provider: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="smtp">SMTP (existing mail server)</SelectItem>
            <SelectItem value="sendgrid">SendGrid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {provider === 'smtp' && (
        <p className="text-sm text-muted-foreground">Uses the SMTP server configured in the API environment variables. No additional configuration needed.</p>
      )}
      {provider === 'sendgrid' && (<>
        <ConfigField label="API Key" k="api_key" config={config} set={set} secret />
        <ConfigField label="From Email" k="from_email" config={config} set={set} placeholder="noreply@yourshowroom.com" />
        <ConfigField label="From Name" k="from_name" config={config} set={set} placeholder="Your Showroom" />
      </>)}
    </div>
  );
}

function CalendarConfig({ config, onChange, onOAuthSuccess }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void; onOAuthSuccess?: () => void }) {
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  const isConnected = !!config.refresh_token;

  const handleConnect = () => {
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
    const w = window.open(`${apiBase}/api/integrations/oauth/google/start`, '_blank', 'width=600,height=700,left=200,top=100');
    const listener = (e: MessageEvent) => {
      if (e.data?.type !== 'oauth_callback') return;
      window.removeEventListener('message', listener);
      if (e.data.success) onOAuthSuccess?.();
    };
    window.addEventListener('message', listener);
    // Cleanup if popup closed without posting message
    const t = setInterval(() => { if (w?.closed) { clearInterval(t); window.removeEventListener('message', listener); } }, 500);
  };

  return (
    <div className="space-y-4">
      {/* OAuth connect button */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isConnected ? '✅ Google Calendar connected via OAuth' : 'Connect via OAuth (recommended)'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isConnected
              ? 'Tokens are stored. The access token is refreshed automatically.'
              : 'Click Connect — you will be redirected to Google to authorize access.'}
          </p>
        </div>
        <Button type="button" variant={isConnected ? 'outline' : 'default'} size="sm" onClick={handleConnect}>
          {isConnected ? 'Reconnect' : '🔗 Connect with Google'}
        </Button>
      </div>

      {/* Manual fallback */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">Manual token entry (advanced)</summary>
        <div className="mt-3 space-y-3 pl-2">
          <ConfigField label="Client ID" k="client_id" config={config} set={set} />
          <ConfigField label="Client Secret" k="client_secret" config={config} set={set} secret />
          <ConfigField label="Refresh Token" k="refresh_token" config={config} set={set} secret />
          <ConfigField label="Calendar ID" k="calendar_id" config={config} set={set} placeholder="primary" />
        </div>
      </details>
    </div>
  );
}

function OutlookConfig({ config, onChange, onOAuthSuccess }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void; onOAuthSuccess?: () => void }) {
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  const isConnected = !!config.refresh_token;

  const handleConnect = () => {
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
    const w = window.open(`${apiBase}/api/integrations/oauth/outlook/start`, '_blank', 'width=600,height=700,left=200,top=100');
    const listener = (e: MessageEvent) => {
      if (e.data?.type !== 'oauth_callback') return;
      window.removeEventListener('message', listener);
      if (e.data.success) onOAuthSuccess?.();
    };
    window.addEventListener('message', listener);
    const t = setInterval(() => { if (w?.closed) { clearInterval(t); window.removeEventListener('message', listener); } }, 500);
  };

  return (
    <div className="space-y-4">
      {/* OAuth connect button */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isConnected ? '✅ Microsoft Outlook connected via OAuth' : 'Connect via OAuth (recommended)'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isConnected
              ? 'Tokens are stored. The access token is refreshed automatically.'
              : 'Click Connect — you will be redirected to Microsoft to authorize access.'}
          </p>
        </div>
        <Button type="button" variant={isConnected ? 'outline' : 'default'} size="sm" onClick={handleConnect}>
          {isConnected ? 'Reconnect' : '🔗 Connect with Microsoft'}
        </Button>
      </div>

      {/* Manual fallback */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">Manual token entry (advanced)</summary>
        <div className="mt-3 space-y-3 pl-2">
          <ConfigField label="Client ID (Application ID)" k="client_id" config={config} set={set} />
          <ConfigField label="Client Secret" k="client_secret" config={config} set={set} secret />
          <ConfigField label="Refresh Token" k="refresh_token" config={config} set={set} secret />
          <ConfigField label="Tenant ID (optional, default: common)" k="tenant_id" config={config} set={set} placeholder="common" />
          <ConfigField label="Calendar ID (optional)" k="calendar_id" config={config} set={set} placeholder="Leave blank for default calendar" />
        </div>
      </details>
    </div>
  );
}

function WebhookConfig({ config, onChange, label }: { config: Record<string, string>; onChange: (c: Record<string, string>) => void; label: string }) {
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });
  return (
    <div className="space-y-3">
      <ConfigField label="Webhook URL" k="webhook_url" config={config} set={set} placeholder={`https://your-${label.toLowerCase()}.com/webhook`} />
      <ConfigField label="API Key / Bearer Token (optional)" k="api_key" config={config} set={set} secret />
      <ConfigField label="Custom Secret Header Name (optional)" k="secret_header" config={config} set={set} placeholder="X-My-Secret" />
      <ConfigField label="Custom Secret Header Value (optional)" k="secret_value" config={config} set={set} secret />
    </div>
  );
}

// ─── Shared config field ──────────────────────────────────────────────────────

function ConfigField({
  label, k, config, set, placeholder, secret,
}: {
  label: string; k: string; config: Record<string, string>;
  set: (k: string, v: string) => void; placeholder?: string; secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isMasked = config[k] === '***';
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <div className="relative flex gap-2">
        <Input
          type={secret && !show && !isMasked ? 'password' : 'text'}
          value={config[k] ?? ''}
          onChange={e => set(k, e.target.value)}
          placeholder={isMasked ? '(saved — clear to replace)' : placeholder}
          className="flex-1"
        />
        {secret && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShow(s => !s)}>
            {show ? 'Hide' : 'Show'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Per-integration card ─────────────────────────────────────────────────────

function IntegrationCard({
  type,
  initial,
  onSaved,
  onReload,
}: {
  type: IntegrationType;
  initial: Integration | null;
  onSaved: (i: Integration) => void;
  onReload: () => void;
}) {
  const meta = INTEGRATION_META[type];
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(initial?.is_enabled ?? false);
  const [config, setConfig] = useState<Record<string, string>>((initial?.config ?? {}) as Record<string, string>);
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  // Sync when parent reloads
  useEffect(() => {
    setEnabled(initial?.is_enabled ?? false);
    setConfig((initial?.config ?? {}) as Record<string, string>);
    setEvents(initial?.events ?? []);
  }, [initial]);

  const toggleEvent = (ev: string) => {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await apiPut<{ data: Integration; error: null }>('/api/integrations/' + type, {
        type,
        is_enabled: enabled,
        events,
        config,
      });
      onSaved(result.data);
      toast({ title: 'Saved', description: `${meta.label} integration updated.` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await apiPost<{success: boolean; error?: string}>('/api/integrations/' + type + '/test', {
        config,
        test_email: testEmail || undefined,
        test_phone: testPhone || undefined,
      });
      console.log('Test result', result);
      if (result.success) {
        toast({ title: 'Test passed', description: `${meta.label} test dispatch succeeded.` });
      } else {
        toast({ title: 'Test failed', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!initial?.id) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/integrations/${type}`);
      onSaved({ type, is_enabled: false, events: [], config: {} });
      toast({ title: 'Removed', description: `${meta.label} integration removed.` });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {meta.icon}
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <CardDescription className="mt-0.5 text-sm">{meta.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {initial?.id && (
              <Badge variant={enabled ? 'default' : 'secondary'}>
                {enabled ? 'Active' : 'Inactive'}
              </Badge>
            )}
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={`Enable ${meta.label}`}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Config form */}
        {type === 'whatsapp'        && <WhatsAppConfig config={config} onChange={setConfig} />}
        {type === 'sms'             && <SMSConfig config={config} onChange={setConfig} />}
        {type === 'email'           && <EmailConfig config={config} onChange={setConfig} />}
        {type === 'google_calendar' && <CalendarConfig config={config} onChange={setConfig} onOAuthSuccess={onReload} />}
        {type === 'outlook'         && <OutlookConfig config={config} onChange={setConfig} onOAuthSuccess={onReload} />}
        {type === 'crm'             && <WebhookConfig config={config} onChange={setConfig} label="CRM" />}
        {type === 'dms'             && <WebhookConfig config={config} onChange={setConfig} label="DMS" />}

        {/* Events selection */}
        <div>
          <Label className="mb-2 block text-sm font-medium">Trigger on events <span className="text-muted-foreground font-normal">(empty = all events)</span></Label>
          <div className="flex flex-wrap gap-3">
            {ALL_EVENTS.map(ev => (
              <label key={ev.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox
                  checked={events.includes(ev.value)}
                  onCheckedChange={() => toggleEvent(ev.value)}
                />
                <span className="text-sm">{ev.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Test inputs */}
        {(type === 'whatsapp' || type === 'sms') && (
          <div>
            <Label className="mb-1 block text-sm">Test phone number</Label>
            <Input
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="+919876543210"
              className="max-w-xs"
            />
          </div>
        )}
        {type === 'email' && (
          <div>
            <Label className="mb-1 block text-sm">Test recipient email</Label>
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              className="max-w-xs"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing} size="sm">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            Test Connection
          </Button>
          {initial?.id && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive ml-auto">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const IntegrationSettings = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Record<IntegrationType, Integration | null>>({
    whatsapp: null, sms: null, email: null, google_calendar: null, outlook: null, crm: null, dms: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Integration[] }>('/api/integrations');
      const map: Record<string, Integration | null> = {
        whatsapp: null, sms: null, email: null, google_calendar: null, outlook: null, crm: null, dms: null,
      };
      for (const item of res.data ?? []) {
        map[item.type] = item;
      }
      setIntegrations(map as any);
    } catch (err: any) {
      toast({ title: 'Failed to load integrations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (type: IntegrationType) => (updated: Integration) => {
    setIntegrations(prev => ({ ...prev, [type]: updated.id ? updated : null }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">External Integrations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your showroom to external platforms. Enabled integrations receive booking events automatically.
        </p>
      </div>
      {ORDERED_TYPES.map(type => (
        <IntegrationCard
          key={type}
          type={type}
          initial={integrations[type]}
          onSaved={handleSaved(type)}
          onReload={load}
        />
      ))}
    </div>
  );
};

export default IntegrationSettings;

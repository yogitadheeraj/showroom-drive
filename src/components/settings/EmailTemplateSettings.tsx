import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { apiGet, apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Eye, Pencil, Save, X, Building2, RotateCcw, Code, AlignLeft } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';

// All template keys from the backend registry
const TEMPLATE_META: Array<{ key: string; label: string; audience: 'customer' | 'staff'; category: string }> = [
  { key: 'booking-confirmation',          label: 'Booking Confirmation',             audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-completed',          label: 'Test Drive Completed',             audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-rescheduled',        label: 'Test Drive Rescheduled',           audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-cancelled',          label: 'Test Drive Cancelled',             audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-journey',            label: 'Journey Summary',                  audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-thank-you',          label: 'Post Drive Thank You',             audience: 'customer', category: 'Test Drive' },
  { key: 'test-drive-reminder-24h',       label: 'Reminder — 24 Hours',             audience: 'customer', category: 'Reminders' },
  { key: 'test-drive-reminder-4h',        label: 'Reminder — 4 Hours',              audience: 'customer', category: 'Reminders' },
  { key: 'test-drive-no-show-reengagement', label: 'No-Show Re-engagement',           audience: 'customer', category: 'Re-engagement' },
  { key: 'test-drive-feedback-thank-you', label: 'Feedback Thank You (Customer)',    audience: 'customer', category: 'Feedback' },
  { key: 'test-drive-feedback-received',  label: 'Feedback Received (Staff)',        audience: 'staff',    category: 'Feedback' },
  { key: 'sales-follow-up',               label: 'Sales Follow-Up',                 audience: 'customer', category: 'Follow-Up' },
  { key: 'sales-assignment',              label: 'Sales Assignment (Staff)',         audience: 'staff',    category: 'Staff' },
  { key: 'staff-welcome',                 label: 'Staff Welcome / Verify Account',   audience: 'staff',    category: 'Staff' },
  { key: 'vehicle-change-notification',   label: 'Vehicle Change Notification',      audience: 'customer', category: 'Test Drive' },
  { key: 'demo-request-confirmation',     label: 'Demo Request Confirmation',        audience: 'customer', category: 'System' },
];

// Sample data for preview rendering
const PREVIEW_DATA: Record<string, Record<string, string>> = {
  default: {
    customerName: 'Rahul Sharma',
    vehicleName: 'Hyundai Creta',
    locationName: 'Autozone Delhi',
    scheduledDate: 'June 20, 2026',
    scheduledTime: '11:00 AM',
    salesPersonName: 'Priya Kapoor',
    salesPersonPhone: '+91 98765 43210',
    newDate: 'June 22, 2026',
    newTime: '2:00 PM',
    durationMinutes: '45',
    totalDurationMinutes: '45',
    rating: '4',
    feedbackText: 'Great experience, very professional team!',
    fullName: 'Priya Kapoor',
    roleLabel: 'Sales Person',
    followUpNote: 'Just checking in on your test drive experience!',
    oldVehicle: 'Maruti Swift',
    newVehicle: 'Hyundai Creta',
    contactName: 'Manager',
    wouldRecommend: 'true',
    currentStatus: 'completed',
    feedbackLink: '#',
    bookingUrl: '#',
    manageUrl: '#',
    verificationLink: '#',
    loginUrl: '#',
  },
};

interface DealerInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

interface EmailCustomization {
  id?: string;
  dealer_id: string;
  template_key: string;
  subject_override?: string;
  body_override?: string;
  is_enabled: boolean;
}

interface TemplateDefaults {
  subject: string;
  html: string;
}

const EmailTemplateSettings = () => {
  const { role } = useAuth();
  const { dealerId, dealerLocations } = useDealerContext();
  const { toast } = useToast();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;

  const [dealers, setDealers] = useState<DealerInfo[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [dealerInfo, setDealerInfo] = useState<DealerInfo | null>(null);

  const [customizations, setCustomizations] = useState<Record<string, EmailCustomization>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'subject' | 'body'>('subject');
  const [subjectDraft, setSubjectDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [defaults, setDefaults] = useState<Record<string, TemplateDefaults>>({});
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeDealerId = isSuperAdmin ? selectedDealerId : (dealerId || '');

  // Load dealers list for superadmin
  useEffect(() => {
    if (!isSuperAdmin) return;
    apiDbQuery<DealerInfo[]>({
      table: 'dealers',
      action: 'select',
      select: 'id, name, logo_url',
      filters: [{ field: 'is_active', op: 'eq', value: true }],
      order: [{ field: 'name', ascending: true }],
    }).then(data => {
      setDealers(data || []);
      if (data?.length) setSelectedDealerId(data[0].id);
    });
  }, [isSuperAdmin]);

  // Load dealer info for non-superadmin (already have dealer context)
  useEffect(() => {
    if (isSuperAdmin || !dealerId) return;
    apiDbQuery<DealerInfo[]>({
      table: 'dealers',
      action: 'select',
      select: 'id, name, logo_url',
      filters: [{ field: 'id', op: 'eq', value: dealerId }],
      limit: 1,
    }).then(data => setDealerInfo(data?.[0] || null));
  }, [dealerId, isSuperAdmin]);

  // Update dealerInfo when superadmin changes selection
  useEffect(() => {
    if (!isSuperAdmin || !selectedDealerId) return;
    const found = dealers.find(d => d.id === selectedDealerId);
    setDealerInfo(found || null);
  }, [selectedDealerId, dealers, isSuperAdmin]);

  // Load customizations for the active dealer
  useEffect(() => {
    if (!activeDealerId) return;
    apiDbQuery<EmailCustomization[]>({
      table: 'email_template_customizations',
      action: 'select',
      select: '*',
      filters: [{ field: 'dealer_id', op: 'eq', value: activeDealerId }],
      limit: 100,
    }).then(data => {
      const map: Record<string, EmailCustomization> = {};
      (data || []).forEach(c => { map[c.template_key] = c; });
      setCustomizations(map);
    });
  }, [activeDealerId]);

  const fetchPreview = async (templateKey: string): Promise<{ html: string; subject: string; defaultHtml: string; defaultSubject: string } | null> => {
    if (!activeDealerId && !dealerInfo) return null;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ template: templateKey, dealer_id: activeDealerId });
      const result = await apiGet<{ html: string; subject: string; defaultHtml: string; defaultSubject: string }>(
        `/api/email-templates/preview?${params}`
      );
      if (result) {
        setPreviewHtml(result.html || '');
        // Cache the defaults
        setDefaults(prev => ({
          ...prev,
          [templateKey]: { subject: result.defaultSubject || result.subject, html: result.defaultHtml || result.html },
        }));
      }
      return result;
    } catch {
      setPreviewHtml('<p style="color:#71717a;padding:20px">Preview unavailable — server is required to render with dealer branding.</p>');
      return null;
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePreview = async (key: string) => {
    if (previewKey === key) {
      setPreviewKey(null);
      setPreviewHtml('');
      return;
    }
    setPreviewKey(key);
    await fetchPreview(key);
  };

  const handleEdit = async (key: string) => {
    const existing = customizations[key];
    // Use cached defaults or fetch them now
    let templateDefaults = defaults[key];
    if (!templateDefaults) {
      setLoadingDefaults(true);
      try {
        const params = new URLSearchParams({ template: key, dealer_id: activeDealerId });
        const result = await apiGet<{ html: string; subject: string; defaultHtml: string; defaultSubject: string }>(
          `/api/email-templates/preview?${params}`
        );
        if (result) {
          templateDefaults = { subject: result.defaultSubject || result.subject, html: result.defaultHtml || result.html };
          setDefaults(prev => ({ ...prev, [key]: templateDefaults }));
        }
      } catch { /* best-effort */ } finally {
        setLoadingDefaults(false);
      }
    }
    // Pre-populate: saved override first, then default
    setSubjectDraft(existing?.subject_override || templateDefaults?.subject || '');
    setBodyDraft(existing?.body_override || templateDefaults?.html || '');
    setEditTab('subject');
    setEditingKey(key);
  };

  const handleSave = async (key: string) => {
    if (!activeDealerId) return;
    setSaving(true);
    try {
      const existing = customizations[key];
      const subjectOverride = subjectDraft.trim() || null;
      // Only save body_override if it differs from the default
      const defaultBody = defaults[key]?.html || '';
      const bodyOverride = bodyDraft.trim() && bodyDraft.trim() !== defaultBody.trim() ? bodyDraft.trim() : null;
      const isEnabled = existing?.is_enabled !== false;

      if (existing?.id) {
        await apiDbQuery({
          table: 'email_template_customizations',
          action: 'update',
          payload: { subject_override: subjectOverride, body_override: bodyOverride, is_enabled: isEnabled },
          filters: [{ field: 'id', op: 'eq', value: existing.id }],
        });
        setCustomizations(prev => ({
          ...prev,
          [key]: { ...prev[key], subject_override: subjectOverride || undefined, body_override: bodyOverride || undefined },
        }));
      } else {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await apiDbQuery({
          table: 'email_template_customizations',
          action: 'insert',
          values: {
            id: newId,
            dealer_id: activeDealerId,
            template_key: key,
            subject_override: subjectOverride,
            body_override: bodyOverride,
            is_enabled: isEnabled,
          },
        });
        setCustomizations(prev => ({
          ...prev,
          [key]: { id: newId, dealer_id: activeDealerId, template_key: key, subject_override: subjectOverride || undefined, body_override: bodyOverride || undefined, is_enabled: isEnabled },
        }));
      }

      // Refresh preview if it's open
      if (previewKey === key) await fetchPreview(key);

      toast({ title: 'Template saved' });
      setEditingKey(null);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (key: string, enabled: boolean) => {
    if (!activeDealerId) return;
    const existing = customizations[key];
    try {
      if (existing?.id) {
        await apiDbQuery({
          table: 'email_template_customizations',
          action: 'update',
          payload: { is_enabled: enabled },
          filters: [{ field: 'id', op: 'eq', value: existing.id }],
        });
        setCustomizations(prev => ({ ...prev, [key]: { ...prev[key], is_enabled: enabled } }));
      } else {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await apiDbQuery({
          table: 'email_template_customizations',
          action: 'insert',
          values: {
            id: newId,
            dealer_id: activeDealerId,
            template_key: key,
            is_enabled: enabled,
            subject_override: existing?.subject_override || null,
            body_override: existing?.body_override || null,
          },
        });
        setCustomizations(prev => ({
          ...prev,
          [key]: { id: newId, dealer_id: activeDealerId, template_key: key, is_enabled: enabled },
        }));
      }
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    }
  };

  // Group templates by category
  const grouped = TEMPLATE_META.reduce<Record<string, typeof TEMPLATE_META>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Email Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preview all templates with dealer branding. Optionally override the subject line per template.
          Dealer name and logo are pulled from <strong>Dealership Profile</strong>.
        </p>
      </div>

      {/* Dealer selector (superadmin only) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Select Entity / Dealer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a dealer..." />
              </SelectTrigger>
              <SelectContent>
                {dealers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Dealer branding preview */}
      {dealerInfo && (
        <Card className="border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-4">
              {dealerInfo.logo_url ? (
                <img src={dealerInfo.logo_url} alt={dealerInfo.name} className="h-10 object-contain rounded border border-border p-1 bg-white" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="font-medium text-sm">{dealerInfo.name}</p>
                <p className="text-xs text-muted-foreground">This branding will appear in all outgoing emails</p>
              </div>
              <Badge variant="secondary" className="ml-auto text-xs">Powered by AutoAdvant.com</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates by category */}
      {Object.entries(grouped).map(([category, templates]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {templates.map(t => {
                const custom = customizations[t.key];
                const isEnabled = custom?.is_enabled !== false;
                const isEditing = editingKey === t.key;
                const isPreviewing = previewKey === t.key;

                return (
                  <div key={t.key} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.key}</p>
                          {custom?.subject_override && (
                            <p className="text-xs text-primary mt-0.5 truncate">✏️ Subject: {custom.subject_override}</p>
                          )}
                          {custom?.body_override && (
                            <p className="text-xs text-orange-600 mt-0.5">✏️ Body customized</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] h-5 ${t.audience === 'customer' ? 'border-blue-200 text-blue-700' : 'border-purple-200 text-purple-700'}`}
                        >
                          {t.audience}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Enable/Disable toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(t.key, !isEnabled)}
                          className={`h-7 px-2 text-xs rounded border transition-colors ${
                            isEnabled
                              ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {isEnabled ? 'On' : 'Off'}
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handlePreview(t.key)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isPreviewing ? 'Hide' : 'Preview'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleEdit(t.key)}
                          disabled={loadingDefaults && editingKey !== t.key}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                    </div>

                    {/* Subject + Body editor */}
                    {isEditing && (
                      <div className="mt-3 bg-muted/40 rounded-lg border border-border overflow-hidden">
                        {/* Tab bar */}
                        <div className="flex border-b border-border">
                          <button
                            type="button"
                            onClick={() => setEditTab('subject')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                              editTab === 'subject'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <AlignLeft className="h-3.5 w-3.5" /> Subject Line
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTab('body')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                              editTab === 'body'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Code className="h-3.5 w-3.5" /> HTML Body
                          </button>
                          <div className="ml-auto flex items-center gap-1 px-3">
                            {editTab === 'body' && defaults[t.key]?.html && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 gap-1 text-[11px] text-muted-foreground"
                                title="Reset to default"
                                onClick={() => setBodyDraft(defaults[t.key]?.html || '')}
                              >
                                <RotateCcw className="h-3 w-3" /> Reset
                              </Button>
                            )}
                            {editTab === 'subject' && defaults[t.key]?.subject && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 gap-1 text-[11px] text-muted-foreground"
                                title="Reset to default"
                                onClick={() => setSubjectDraft(defaults[t.key]?.subject || '')}
                              >
                                <RotateCcw className="h-3 w-3" /> Reset
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          {editTab === 'subject' && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                Subject line — edit or leave as default
                              </Label>
                              <Input
                                className="h-9 text-sm font-medium"
                                value={subjectDraft}
                                onChange={e => setSubjectDraft(e.target.value)}
                                placeholder="Email subject..."
                                autoFocus
                              />
                              {defaults[t.key]?.subject && subjectDraft !== defaults[t.key].subject && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Default: <span className="italic">{defaults[t.key].subject}</span>
                                </p>
                              )}
                            </div>
                          )}

                          {editTab === 'body' && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs text-muted-foreground">
                                  HTML body — edit the raw HTML. Variables like <code className="bg-muted rounded px-1 py-0.5 text-[11px]">${'{customerName}'}</code> are supported.
                                </Label>
                                {bodyDraft && (
                                  <span className="text-[10px] text-muted-foreground">{bodyDraft.length.toLocaleString()} chars</span>
                                )}
                              </div>
                              <Textarea
                                className="font-mono text-xs leading-relaxed resize-y min-h-[320px]"
                                value={bodyDraft}
                                onChange={e => setBodyDraft(e.target.value)}
                                spellCheck={false}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" className="h-8 gap-1.5" onClick={() => handleSave(t.key)} disabled={saving}>
                              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingKey(null)}>
                              <X className="h-3.5 w-3.5" /> Cancel
                            </Button>
                            {editTab === 'body' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 ml-auto text-xs"
                                onClick={async () => {
                                  // Live preview of current body draft
                                  setPreviewHtml(bodyDraft);
                                  setPreviewKey(t.key);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" /> Preview Draft
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preview iframe */}
                    {isPreviewing && (
                      <div className="mt-3 border border-border rounded-lg overflow-hidden">
                        {loadingPreview ? (
                          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
                            Loading preview...
                          </div>
                        ) : previewHtml ? (
                          <iframe
                            ref={iframeRef}
                            srcDoc={previewHtml}
                            title={`Preview: ${t.label}`}
                            className="w-full border-0"
                            style={{ height: '520px' }}
                            sandbox="allow-same-origin"
                          />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
                            No preview available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EmailTemplateSettings;

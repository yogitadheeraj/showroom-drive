import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery, apiPatch } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Settings2, Loader2, Save } from 'lucide-react';

const DEFAULT_OPTIONS = {
  insurance_providers: ['AXA', 'Allianz', 'MetLife', 'Bupa'],
  finance_providers: ['Emirates NBD', 'ADCB', 'Mashreq', 'Other'],
  financing_plans: ['24 months', '36 months', '48 months', '60 months'],
  deal_statuses: ['proposal', 'finance_review', 'approved', 'won', 'lost'],
};

const FIELD_META = {
  insurance_providers: { label: 'Insurance providers', description: 'Options shown for insurance coverage in the deal quote form.' },
  finance_providers: { label: 'Finance providers', description: 'Options shown for lender selection on the quote.' },
  financing_plans: { label: 'Financing plans', description: 'Available loan/term values for customer financing packages.' },
  deal_statuses: { label: 'Deal statuses', description: 'Pipeline states that appear in the lead center quote workflow.' },
} as const;

const DealOptionsSettings = ({ dealerIdOverride }: { dealerIdOverride?: string } = {}) => {
  const { role } = useAuth();
  const { dealerId: contextDealerId } = useDealerContext();
  const { toast } = useToast();
  const dealerId = dealerIdOverride || contextDealerId || null;
  const isAllowed = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN || role === APP_ROLE.SUPERADMIN;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    insurance_providers: DEFAULT_OPTIONS.insurance_providers.join(', '),
    finance_providers: DEFAULT_OPTIONS.finance_providers.join(', '),
    financing_plans: DEFAULT_OPTIONS.financing_plans.join(', '),
    deal_statuses: DEFAULT_OPTIONS.deal_statuses.join(', '),
  });

  useEffect(() => {
    if (!isAllowed || !dealerId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const rows = await apiDbQuery<any[]>({
          table: 'dealer_settings',
          action: 'select',
          select: 'id, key, value, dealer_id',
          filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
          order: [{ field: 'updated_at', ascending: false }],
        });

        const settings = (rows || []).reduce<Record<string, string>>((acc, row) => {
          if (row?.key && typeof row.value !== 'undefined') {
            acc[row.key] = Array.isArray(row.value) ? row.value.join(', ') : String(row.value);
          }
          return acc;
        }, {});

        setValues({
          insurance_providers: settings.insurance_providers || DEFAULT_OPTIONS.insurance_providers.join(', '),
          finance_providers: settings.finance_providers || DEFAULT_OPTIONS.finance_providers.join(', '),
          financing_plans: settings.financing_plans || DEFAULT_OPTIONS.financing_plans.join(', '),
          deal_statuses: settings.deal_statuses || DEFAULT_OPTIONS.deal_statuses.join(', '),
        });
      } catch {
        setValues({
          insurance_providers: DEFAULT_OPTIONS.insurance_providers.join(', '),
          finance_providers: DEFAULT_OPTIONS.finance_providers.join(', '),
          financing_plans: DEFAULT_OPTIONS.financing_plans.join(', '),
          deal_statuses: DEFAULT_OPTIONS.deal_statuses.join(', '),
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dealerId, isAllowed]);

  const fields = useMemo(() => Object.entries(FIELD_META) as Array<[keyof typeof FIELD_META, typeof FIELD_META[keyof typeof FIELD_META]]>, []);

  const handleSave = async () => {
    if (!dealerId || !isAllowed) return;

    setSaving(true);
    try {
      const tasks = Object.entries(values).map(([key, rawValue]) => {
        const list = rawValue
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

        return apiDbQuery({
          table: 'dealer_settings',
          action: 'upsert',
          values: [{
            dealer_id: dealerId,
            key,
            value: list,
          }],
          options: { onConflict: 'dealer_id,key' },
        });
      });

      await Promise.all(tasks);
      toast({ title: 'Deal options saved', description: 'Quote dropdowns have been updated for this dealership.' });
    } catch (error: any) {
      toast({ title: 'Unable to save', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Deal options</CardTitle>
          <CardDescription>Only sales administrators can manage quote defaults.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Deal options</CardTitle>
        <CardDescription>Define the dropdown values used in the lead-center quote form for insurance, financing, and deal status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading options…</div>
        ) : (
          <>
            {fields.map(([key, meta]) => (
              <div key={key} className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-sm font-medium">{meta.label}</Label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <Textarea
                  value={values[key] ?? ''}
                  onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder="Comma separated values"
                  className="min-h-24"
                />
              </div>
            ))}

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={saving || !dealerId}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save options</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DealOptionsSettings;

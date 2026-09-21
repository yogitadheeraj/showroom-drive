import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { APP_ROLE } from '@/constants/roles';
import {
  getCarBookingPaymentConfig,
  upsertCarBookingPaymentConfig,
  type CarBookingPaymentConfig,
} from '@/lib/carBookingPaymentConfigService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CreditCard } from 'lucide-react';

const CarBookingPaymentSettings = () => {
  const { role, profile } = useAuth();
  const { dealerLocationIds } = useDealerContext();
  const { toast } = useToast();

  const isAllowedRole = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN || role === APP_ROLE.SUPERADMIN;
  const locationId = profile?.location_id || (dealerLocationIds && dealerLocationIds[0]) || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CarBookingPaymentConfig | null>(null);

  useEffect(() => {
    if (!isAllowedRole || !locationId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const row = await getCarBookingPaymentConfig(locationId);
        setForm(row);
      } catch (error: any) {
        toast({
          title: 'Failed to load payment settings',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isAllowedRole, locationId, toast]);

  const handleSave = async () => {
    if (!form || !locationId || !isAllowedRole) return;

    setSaving(true);
    try {
      const payload = {
        location_id: locationId,
        payment_module_enabled: form.payment_module_enabled,
        allow_deposit: form.allow_deposit,
        allow_full_payment: form.allow_full_payment,
        default_collection_mode: form.default_collection_mode,
        deposit_type: form.deposit_type,
        deposit_value: Number(form.deposit_value || 0),
        provider_name: String(form.provider_name || 'manual'),
        payment_link_base_url: form.payment_link_base_url?.trim() || null,
        enable_upi: form.enable_upi,
        enable_card: form.enable_card,
        enable_net_banking: form.enable_net_banking,
        enable_wallet: form.enable_wallet,
      };

      const saved = await upsertCarBookingPaymentConfig(payload);
      if (saved) setForm(saved);
      toast({ title: 'Payment settings saved' });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowedRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Car Booking Payments
          </CardTitle>
          <CardDescription>Only Organization Admin and Branch Admin can enable or disable payment settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Car Booking Payments
          </CardTitle>
          <CardDescription>Loading payment settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Car Booking Payment Configuration
        </CardTitle>
        <CardDescription>
          Configure payment-link collection for car bookings and control which collection methods are enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Enable payment module</Label>
            <p className="text-xs text-muted-foreground">When disabled, payment links cannot be generated for car bookings.</p>
          </div>
          <Switch
            checked={form.payment_module_enabled}
            onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, payment_module_enabled: checked } : prev)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider name</Label>
            <Input
              value={form.provider_name || ''}
              onChange={(e) => setForm((prev) => prev ? { ...prev, provider_name: e.target.value } : prev)}
              placeholder="manual / razorpay / stripe"
            />
          </div>
          <div className="space-y-2">
            <Label>Payment link base URL</Label>
            <Input
              value={form.payment_link_base_url || ''}
              onChange={(e) => setForm((prev) => prev ? { ...prev, payment_link_base_url: e.target.value } : prev)}
              placeholder="https://payments.example.com/collect"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default collection mode</Label>
            <Select
              value={form.default_collection_mode}
              onValueChange={(value: 'deposit' | 'full') => setForm((prev) => prev ? { ...prev, default_collection_mode: value } : prev)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="full">Full amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Deposit type</Label>
            <Select
              value={form.deposit_type}
              onValueChange={(value: 'fixed' | 'percentage') => setForm((prev) => prev ? { ...prev, deposit_type: value } : prev)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 max-w-sm">
          <Label>{form.deposit_type === 'percentage' ? 'Deposit percentage (%)' : 'Deposit fixed amount'}</Label>
          <Input
            type="number"
            min={0}
            max={form.deposit_type === 'percentage' ? 100 : undefined}
            value={form.deposit_value}
            onChange={(e) => setForm((prev) => prev ? { ...prev, deposit_value: Number(e.target.value) || 0 } : prev)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Allow deposit links</Label>
            <Switch
              checked={form.allow_deposit}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, allow_deposit: checked } : prev)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Allow full amount links</Label>
            <Switch
              checked={form.allow_full_payment}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, allow_full_payment: checked } : prev)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Enable UPI</Label>
            <Switch
              checked={form.enable_upi}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, enable_upi: checked } : prev)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Enable Card</Label>
            <Switch
              checked={form.enable_card}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, enable_card: checked } : prev)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Enable Net Banking</Label>
            <Switch
              checked={form.enable_net_banking}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, enable_net_banking: checked } : prev)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Enable Wallet</Label>
            <Switch
              checked={form.enable_wallet}
              onCheckedChange={(checked) => setForm((prev) => prev ? { ...prev, enable_wallet: checked } : prev)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Payment Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CarBookingPaymentSettings;

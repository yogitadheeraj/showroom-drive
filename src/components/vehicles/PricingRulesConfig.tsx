import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { DollarSign, Plus, Tag, Percent, Edit2, Trash2 } from 'lucide-react';

const RULE_TYPE_LABELS: Record<string, string> = {
  base: 'Base Price',
  variant: 'Variant Adjustment',
  dynamic: 'Dynamic',
  seasonal: 'Seasonal',
};

const PricingRulesConfig = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    brand: '', model: '', variant: '', rule_type: 'base',
    base_price: '', adjusted_price: '', adjustment_percent: '',
    season_name: '', valid_from: '', valid_until: '', priority: '0',
  });
  const [discountForm, setDiscountForm] = useState({
    name: '', code: '', discount_type: 'percentage',
    discount_value: '', max_discount_amount: '',
    applicable_brands: '', applicable_models: '',
    min_base_price: '', usage_limit: '',
    valid_from: '', valid_until: '',
  });
  const { toast } = useToast();
  const { dealerId } = useDealerContext();

  useEffect(() => { fetchRules(); fetchDiscounts(); }, [dealerId]);

  const fetchRules = async () => {
    const data = await apiDbQuery<any[]>({
      table: 'pricing_rules',
      action: 'select',
      select: '*',
      order: [{ field: 'priority', ascending: false }],
    });
    setRules(data || []);
  };

  const fetchDiscounts = async () => {
    const data = await apiDbQuery<any[]>({
      table: 'pricing_discounts',
      action: 'select',
      select: '*',
      order: [{ field: 'created_at', ascending: false }],
    });
    setDiscounts(data || []);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.brand || !ruleForm.base_price) {
      toast({ title: 'Brand and base price are required', variant: 'destructive' });
      return;
    }
    const payload = {
      dealer_id: dealerId,
      brand: ruleForm.brand,
      model: ruleForm.model || null,
      variant: ruleForm.variant || null,
      rule_type: ruleForm.rule_type,
      base_price: parseFloat(ruleForm.base_price) || 0,
      adjusted_price: ruleForm.adjusted_price ? parseFloat(ruleForm.adjusted_price) : null,
      adjustment_percent: ruleForm.adjustment_percent ? parseFloat(ruleForm.adjustment_percent) : null,
      season_name: ruleForm.season_name || null,
      valid_from: ruleForm.valid_from || null,
      valid_until: ruleForm.valid_until || null,
      priority: parseInt(ruleForm.priority) || 0,
    };

    if (editingRuleId) {
      await apiDbQuery({
        table: 'pricing_rules',
        action: 'update',
        payload,
        filters: [{ field: 'id', op: 'eq', value: editingRuleId }],
      });
      toast({ title: 'Pricing rule updated' });
    } else {
      await apiDbQuery({
        table: 'pricing_rules',
        action: 'insert',
        payload,
      });
      toast({ title: 'Pricing rule created' });
    }
    setShowRuleDialog(false);
    setEditingRuleId(null);
    fetchRules();
  };

  const handleSaveDiscount = async () => {
    if (!discountForm.name || !discountForm.discount_value) {
      toast({ title: 'Name and discount value are required', variant: 'destructive' });
      return;
    }
    const payload = {
      dealer_id: dealerId,
      name: discountForm.name,
      code: discountForm.code || null,
      discount_type: discountForm.discount_type,
      discount_value: parseFloat(discountForm.discount_value) || 0,
      max_discount_amount: discountForm.max_discount_amount ? parseFloat(discountForm.max_discount_amount) : null,
      applicable_brands: discountForm.applicable_brands ? discountForm.applicable_brands.split(',').map(s => s.trim()) : null,
      applicable_models: discountForm.applicable_models ? discountForm.applicable_models.split(',').map(s => s.trim()) : null,
      min_base_price: discountForm.min_base_price ? parseFloat(discountForm.min_base_price) : 0,
      usage_limit: discountForm.usage_limit ? parseInt(discountForm.usage_limit) : null,
      valid_from: discountForm.valid_from || null,
      valid_until: discountForm.valid_until || null,
    };

    if (editingDiscountId) {
      await apiDbQuery({
        table: 'pricing_discounts',
        action: 'update',
        payload,
        filters: [{ field: 'id', op: 'eq', value: editingDiscountId }],
      });
      toast({ title: 'Discount updated' });
    } else {
      await apiDbQuery({
        table: 'pricing_discounts',
        action: 'insert',
        payload,
      });
      toast({ title: 'Discount created' });
    }
    setShowDiscountDialog(false);
    setEditingDiscountId(null);
    fetchDiscounts();
  };

  const openEditRule = (r: any) => {
    setEditingRuleId(r.id);
    setRuleForm({
      brand: r.brand || '', model: r.model || '', variant: r.variant || '',
      rule_type: r.rule_type, base_price: String(r.base_price),
      adjusted_price: r.adjusted_price ? String(r.adjusted_price) : '',
      adjustment_percent: r.adjustment_percent ? String(r.adjustment_percent) : '',
      season_name: r.season_name || '', valid_from: r.valid_from || '',
      valid_until: r.valid_until || '', priority: String(r.priority),
    });
    setShowRuleDialog(true);
  };

  const openEditDiscount = (d: any) => {
    setEditingDiscountId(d.id);
    setDiscountForm({
      name: d.name, code: d.code || '', discount_type: d.discount_type,
      discount_value: String(d.discount_value),
      max_discount_amount: d.max_discount_amount ? String(d.max_discount_amount) : '',
      applicable_brands: d.applicable_brands?.join(', ') || '',
      applicable_models: d.applicable_models?.join(', ') || '',
      min_base_price: d.min_base_price ? String(d.min_base_price) : '',
      usage_limit: d.usage_limit ? String(d.usage_limit) : '',
      valid_from: d.valid_from || '', valid_until: d.valid_until || '',
    });
    setShowDiscountDialog(true);
  };

  const toggleRuleActive = async (id: string, current: boolean) => {
    await apiDbQuery({
      table: 'pricing_rules',
      action: 'update',
      payload: { is_active: !current },
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    fetchRules();
  };

  const toggleDiscountActive = async (id: string, current: boolean) => {
    await apiDbQuery({
      table: 'pricing_discounts',
      action: 'update',
      payload: { is_active: !current },
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    fetchDiscounts();
  };

  const deleteRule = async (id: string) => {
    await apiDbQuery({
      table: 'pricing_rules',
      action: 'delete',
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    toast({ title: 'Pricing rule deleted' });
    fetchRules();
  };

  const deleteDiscount = async (id: string) => {
    await apiDbQuery({
      table: 'pricing_discounts',
      action: 'delete',
      filters: [{ field: 'id', op: 'eq', value: id }],
    });
    toast({ title: 'Discount deleted' });
    fetchDiscounts();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Pricing Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rules">
          <TabsList className="mb-4">
            <TabsTrigger value="rules">Pricing Rules</TabsTrigger>
            <TabsTrigger value="discounts">Discounts & Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingRuleId(null); setRuleForm({ brand: '', model: '', variant: '', rule_type: 'base', base_price: '', adjusted_price: '', adjustment_percent: '', season_name: '', valid_from: '', valid_until: '', priority: '0' }); setShowRuleDialog(true); }} className="bg-success text-success-foreground hover:bg-success/90">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Adjusted</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pricing rules configured</TableCell></TableRow>
                  )}
                  {rules.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.brand} {r.model || ''} {r.variant || ''}</TableCell>
                      <TableCell><Badge variant="outline">{RULE_TYPE_LABELS[r.rule_type]}</Badge></TableCell>
                      <TableCell>₹{Number(r.base_price).toLocaleString()}</TableCell>
                      <TableCell>
                        {r.adjusted_price ? `₹${Number(r.adjusted_price).toLocaleString()}` : r.adjustment_percent ? `${r.adjustment_percent}%` : '—'}
                      </TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell><Switch checked={r.is_active} onCheckedChange={() => toggleRuleActive(r.id, r.is_active)} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditRule(r)}><Edit2 className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRule(r.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="discounts" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingDiscountId(null); setDiscountForm({ name: '', code: '', discount_type: 'percentage', discount_value: '', max_discount_amount: '', applicable_brands: '', applicable_models: '', min_base_price: '', usage_limit: '', valid_from: '', valid_until: '' }); setShowDiscountDialog(true); }} className="bg-success text-success-foreground hover:bg-success/90">
                <Plus className="h-4 w-4 mr-2" /> Add Discount
              </Button>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No discounts configured</TableCell></TableRow>
                  )}
                  {discounts.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell><Badge variant="secondary"><Tag className="h-3 w-3 mr-1" />{d.code || '—'}</Badge></TableCell>
                      <TableCell>{d.discount_type}</TableCell>
                      <TableCell>
                        {d.discount_type === 'percentage' ? `${d.discount_value}%` : `₹${Number(d.discount_value).toLocaleString()}`}
                      </TableCell>
                      <TableCell>{d.used_count}{d.usage_limit ? `/${d.usage_limit}` : ''}</TableCell>
                      <TableCell><Switch checked={d.is_active} onCheckedChange={() => toggleDiscountActive(d.id, d.is_active)} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDiscount(d)}><Edit2 className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDiscount(d.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Pricing Rule Dialog */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingRuleId ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Brand *</Label><Input value={ruleForm.brand} onChange={e => setRuleForm(p => ({ ...p, brand: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Model</Label><Input value={ruleForm.model} onChange={e => setRuleForm(p => ({ ...p, model: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Variant</Label><Input value={ruleForm.variant} onChange={e => setRuleForm(p => ({ ...p, variant: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select value={ruleForm.rule_type} onValueChange={v => setRuleForm(p => ({ ...p, rule_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base Price</SelectItem>
                      <SelectItem value="variant">Variant Adjustment</SelectItem>
                      <SelectItem value="dynamic">Dynamic</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Base Price (₹) *</Label><Input type="number" value={ruleForm.base_price} onChange={e => setRuleForm(p => ({ ...p, base_price: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Adjusted Price (₹)</Label><Input type="number" value={ruleForm.adjusted_price} onChange={e => setRuleForm(p => ({ ...p, adjusted_price: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Adjustment %</Label><Input type="number" value={ruleForm.adjustment_percent} onChange={e => setRuleForm(p => ({ ...p, adjustment_percent: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Priority</Label><Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: e.target.value }))} /></div>
              </div>
              {(ruleForm.rule_type === 'seasonal' || ruleForm.rule_type === 'dynamic') && (
                <>
                  <div className="space-y-2"><Label>Season / Rule Name</Label><Input value={ruleForm.season_name} onChange={e => setRuleForm(p => ({ ...p, season_name: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Valid From</Label><Input type="date" value={ruleForm.valid_from} onChange={e => setRuleForm(p => ({ ...p, valid_from: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={ruleForm.valid_until} onChange={e => setRuleForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
                  </div>
                </>
              )}
              <Button onClick={handleSaveRule} className="w-full bg-primary text-primary-foreground">{editingRuleId ? 'Update Rule' : 'Create Rule'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingDiscountId ? 'Edit Discount' : 'Add Discount'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={discountForm.name} onChange={e => setDiscountForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Promo Code</Label><Input value={discountForm.code} onChange={e => setDiscountForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. SUMMER25" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountForm.discount_type} onValueChange={v => setDiscountForm(p => ({ ...p, discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                      <SelectItem value="cashback">Cashback (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Discount Value *</Label><Input type="number" value={discountForm.discount_value} onChange={e => setDiscountForm(p => ({ ...p, discount_value: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Max Discount (₹)</Label><Input type="number" value={discountForm.max_discount_amount} onChange={e => setDiscountForm(p => ({ ...p, max_discount_amount: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={discountForm.usage_limit} onChange={e => setDiscountForm(p => ({ ...p, usage_limit: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Applicable Brands</Label><Input value={discountForm.applicable_brands} onChange={e => setDiscountForm(p => ({ ...p, applicable_brands: e.target.value }))} placeholder="comma separated" /></div>
                <div className="space-y-2"><Label>Applicable Models</Label><Input value={discountForm.applicable_models} onChange={e => setDiscountForm(p => ({ ...p, applicable_models: e.target.value }))} placeholder="comma separated" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valid From</Label><Input type="date" value={discountForm.valid_from} onChange={e => setDiscountForm(p => ({ ...p, valid_from: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={discountForm.valid_until} onChange={e => setDiscountForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSaveDiscount} className="w-full bg-primary text-primary-foreground">{editingDiscountId ? 'Update Discount' : 'Create Discount'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PricingRulesConfig;

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Car, Edit2, MapPin, Palette, FileSpreadsheet, CalendarCheck, DollarSign } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import BulkVehicleImport from '@/components/vehicles/BulkVehicleImport';
import VehicleReservations from '@/components/vehicles/VehicleReservations';
import PricingRulesConfig from '@/components/vehicles/PricingRulesConfig';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStep, setFormStep] = useState(1);
  const [createDemoForNew, setCreateDemoForNew] = useState(false);
  const [demoFormData, setDemoFormData] = useState({
    variant: 'Demo', year: new Date().getFullYear().toString(), color: '', registration_number: '', image_url: '',
    total_units: '1', available_units: '1',
  });
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [formData, setFormData] = useState({
    brand: '', model: '', grade: '', trim: '', variant: '', year: new Date().getFullYear().toString(),
    color: '', registration_number: '', location_id: '', image_url: '',
    total_units: '1', available_units: '1',
    engine_type: 'petrol', vehicle_segment: 'four_wheeler' as 'four_wheeler' | 'two_wheeler',
    set_price: '', vehicle_time_days: '', vehicle_condition: 'new' as 'new' | 'used' | 'demo', demo_for_vehicle_id: '',
    showWheelSegment: true,
  });
  const { toast } = useToast();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const isAdmin = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN;
  const showDemoSetupStep = !editingId && formData.vehicle_condition === 'new' && createDemoForNew;
  const totalSteps = showDemoSetupStep ? 3 : 2;
  const associatedNewVariantOptions = vehicles.filter((v) => {
    if (v.is_demo) return false;
    if (!v.is_new || v.is_used) return false;
    if (!formData.location_id) return false;
    if (v.location_id !== formData.location_id) return false;
    if (editingId && v.id === editingId) return false;
    return true;
  });

  useEffect(() => {
    if (!dealerLoading) {
      if (isSuperAdmin) {
        supabase.from('dealers').select('id, name').eq('is_active', true).order('name').then(({ data }) => setDealers(data || []));
      }
      fetchVehicles();
      let query = supabase.from('locations').select('*').eq('is_active', true);
      if (dealerId) query = query.eq('dealer_id', dealerId);
      query.then(({ data }) => setLocations(data || []));

      let brandsQuery = supabase.from('brands').select('id, name, dealer_id').order('name');
      if (dealerId) brandsQuery = brandsQuery.eq('dealer_id', dealerId);
      brandsQuery.then(({ data }) => setBrands(data || []));
    }
  }, [dealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (!dealerLoading) fetchVehicles();
  }, [selectedDealer, dealerLoading]);

  const fetchVehicles = async () => {
    let query = supabase.from('vehicles').select('*, locations(name, dealer_id)').eq('is_active', true).order('brand');
    const { data } = await query;
    let filtered = data || [];
    if (isSuperAdmin && selectedDealer !== 'all') {
      filtered = filtered.filter(v => v.locations?.dealer_id === selectedDealer);
    } else if (!isSuperAdmin && dealerId) {
      filtered = filtered.filter(v => v.locations?.dealer_id === dealerId);
    }
    setVehicles(filtered);
  };

  const openEdit = (v: any) => {
    setEditingId(v.id);
    setFormStep(1);
    setCreateDemoForNew(false);
    setFormData({
      brand: v.brand, model: v.model, grade: v.grade || '', trim: v.trim || '', variant: v.variant || '', year: String(v.year),
      color: v.color || '', registration_number: v.registration_number || '',
      location_id: v.location_id, image_url: v.image_url || '',
      total_units: String(v.total_units || 1), available_units: String(v.available_units || 1),
      engine_type: v.engine_type || 'petrol', vehicle_segment: v.vehicle_segment || 'four_wheeler',
      set_price: v.set_price != null ? String(v.set_price) : '',
      vehicle_time_days: v.vehicle_time_days != null ? String(v.vehicle_time_days) : '',
      vehicle_condition: v.is_demo ? 'demo' : v.is_used ? 'used' : 'new',
      demo_for_vehicle_id: v.demo_for_vehicle_id || '',
      showWheelSegment: typeof v.showWheelSegment === 'boolean' ? v.showWheelSegment : true,
    });
    setDemoFormData({
      variant: 'Demo', year: String(v.year || new Date().getFullYear()), color: '', registration_number: '', image_url: '',
      total_units: '1', available_units: '1',
    });
    setShowDialog(true);
  };

  const openNew = () => {
    setEditingId(null);
    setFormStep(1);
    setCreateDemoForNew(false);
    setFormData({
      brand: '', model: '', grade: '', trim: '', variant: '', year: new Date().getFullYear().toString(),
      color: '', registration_number: '', location_id: '', image_url: '',
      total_units: '1', available_units: '1', engine_type: 'petrol', vehicle_segment: 'four_wheeler', set_price: '', vehicle_time_days: '', vehicle_condition: 'new', demo_for_vehicle_id: '',
      showWheelSegment: true,
    });
    setDemoFormData({
      variant: 'Demo', year: new Date().getFullYear().toString(), color: '', registration_number: '', image_url: '',
      total_units: '1', available_units: '1',
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.location_id) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    if (formData.vehicle_condition === 'demo' && !formData.demo_for_vehicle_id) {
      toast({ title: 'Demo association required', description: 'Select which New variant this demo vehicle is for.', variant: 'destructive' });
      return;
    }
    const payload = {
      brand: formData.brand, model: formData.model,
      grade: formData.grade || null,
      trim: formData.trim || null,
      variant: formData.variant || null, year: parseInt(formData.year),
      color: formData.color || null, registration_number: formData.registration_number || null,
      location_id: formData.location_id, image_url: formData.image_url || null,
      total_units: parseInt(formData.total_units) || 1,
      available_units: parseInt(formData.available_units) || 1,
      engine_type: formData.engine_type || null,
      vehicle_segment: formData.vehicle_segment,
      set_price: formData.vehicle_condition === 'demo' ? null : (formData.set_price ? Number(formData.set_price) : null),
      vehicle_time_days: formData.vehicle_condition === 'demo' ? null : (formData.vehicle_time_days ? parseInt(formData.vehicle_time_days) : null),
      is_demo: formData.vehicle_condition === 'demo',
      is_new: formData.vehicle_condition === 'new' || formData.vehicle_condition === 'demo',
      is_used: formData.vehicle_condition === 'used',
      demo_for_vehicle_id: formData.vehicle_condition === 'demo' ? formData.demo_for_vehicle_id : null,
    };

    if (editingId) {
      await supabase.from('vehicles').update(payload).eq('id', editingId);
      toast({ title: 'Vehicle updated' });
    } else {
      const { data: createdVehicle, error: createError } = await supabase.from('vehicles').insert(payload).select('id').single();
      if (createError) throw createError;

      if (showDemoSetupStep && createdVehicle?.id) {
        const demoPayload = {
          brand: formData.brand,
          model: formData.model,
          grade: formData.grade || null,
          trim: formData.trim || null,
          variant: demoFormData.variant || 'Demo',
          year: parseInt(demoFormData.year) || parseInt(formData.year),
          color: demoFormData.color || null,
          registration_number: demoFormData.registration_number || null,
          location_id: formData.location_id,
          image_url: demoFormData.image_url || null,
          total_units: parseInt(demoFormData.total_units) || 1,
          available_units: parseInt(demoFormData.available_units) || 1,
          engine_type: formData.engine_type || null,
          vehicle_segment: formData.vehicle_segment,
          set_price: null,
          vehicle_time_days: null,
          is_demo: true,
          is_new: true,
          is_used: false,
          demo_for_vehicle_id: createdVehicle.id,
        };

        const { error: demoError } = await supabase.from('vehicles').insert(demoPayload);
        if (demoError) throw demoError;
        toast({ title: 'Vehicle and Demo added', description: 'New vehicle and its associated demo vehicle were created.' });
      } else {
        toast({ title: 'Vehicle added' });
      }
    }
    setShowDialog(false);
    fetchVehicles();
  };

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Vehicle Management</h1>
          <Button onClick={openNew} className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Vehicle
          </Button>
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="inventory" className="flex items-center gap-1.5">
              <Car className="h-4 w-4" /> Inventory
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Bulk Import
            </TabsTrigger>
            <TabsTrigger value="reservations" className="flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4" /> Reservations
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="pricing" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Pricing
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="inventory" className="space-y-4 mt-4">
            {isSuperAdmin && (
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <Label className="text-sm text-muted-foreground mb-2 block">Filter by Dealer</Label>
                  <Select value={selectedDealer} onValueChange={setSelectedDealer}>
                    <SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers</SelectItem>
                      {dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {vehicles.map(v => (
                <Card key={v.id} className="shadow-card hover:shadow-elevated transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <Car className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold text-sm sm:text-base text-foreground">{v.brand} {v.model}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">{[v.grade, v.trim, v.variant].filter(Boolean).join(' / ') || 'Standard'} {v.year}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{v.is_demo ? 'Demo' : v.is_used ? 'Used' : 'New'}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{v.vehicle_segment === 'two_wheeler' ? 'Two Wheeler' : 'Four Wheeler'}</Badge>
                            {v.engine_type && <Badge variant="secondary" className="text-[10px] uppercase">{v.engine_type}</Badge>}
                            {!v.is_demo && v.set_price != null && <Badge variant="secondary" className="text-[10px]">Price: Rs {Number(v.set_price).toLocaleString()}</Badge>}
                            {!v.is_demo && v.vehicle_time_days != null && <Badge variant="secondary" className="text-[10px]">Vehicle Time: {v.vehicle_time_days} day(s)</Badge>}
                            {v.is_demo && v.demo_for_vehicle_id && (
                              <Badge variant="secondary" className="text-[10px]">
                                For: {(() => {
                                  const target = vehicles.find((item) => item.id === v.demo_for_vehicle_id);
                                  return target ? `${target.brand} ${target.model} ${target.variant || ''}`.trim() : 'Linked variant';
                                })()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className={`text-xs ${v.available_units > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {v.available_units}/{v.total_units}
                        </Badge>
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 w-7 p-0" onClick={() => openEdit(v)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2.5 text-xs sm:text-sm text-muted-foreground space-y-1">
                      {v.color && <p className="flex items-center gap-1"><Palette className="h-3 w-3" /> {v.color}</p>}
                      {v.registration_number && <p>Reg: {v.registration_number}</p>}
                      <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.locations?.name}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <BulkVehicleImport locations={locations.map(l => ({ id: l.id, name: l.name }))} onImportComplete={fetchVehicles} />
          </TabsContent>

          <TabsContent value="reservations" className="mt-4">
            <VehicleReservations />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="pricing" className="mt-4">
              <PricingRulesConfig />
            </TabsContent>
          )}
        </Tabs>


        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Stepper Indicator */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1, 2].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-24 rounded-full transition-colors duration-200 ${formStep === step ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
              {/* Step 1: Brand/Model/Specs + Category/Segment */}
              {formStep === 1 && (
                <Card className="shadow-card border-primary border-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Vehicle Category *</Label>
                        <Select value={formData.vehicle_condition} onValueChange={(v: 'new' | 'used' | 'demo') => setFormData(p => ({ ...p, vehicle_condition: v, demo_for_vehicle_id: v === 'demo' ? p.demo_for_vehicle_id : '', brand: '', year: new Date().getFullYear().toString() }))}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Car</SelectItem>
                            <SelectItem value="used">Used Car</SelectItem>
                            <SelectItem value="demo">Demo Vehicle (Test Drive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${!formData.vehicle_condition ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                        <div className="space-y-2">
                          <Label>Brand *</Label>
                          <Select value={formData.brand} onValueChange={v => setFormData(p => ({ ...p, brand: v }))} disabled={!formData.vehicle_condition}>
                            <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                            <SelectContent>
                              {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                              {formData.brand && !brands.some(b => b.name === formData.brand) && (
                                <SelectItem value={formData.brand}>{formData.brand}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Year</Label>
                          <Select value={formData.year} onValueChange={v => setFormData(p => ({ ...p, year: v }))} disabled={!formData.vehicle_condition}>
                            <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const currentYear = new Date().getFullYear();
                                let years: number[] = [];
                                if (formData.vehicle_condition === 'used') {
                                  for (let y = currentYear; y >= currentYear - 20; y--) years.push(y);
                                } else if (formData.vehicle_condition === 'demo') {
                                  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
                                } else if (formData.vehicle_condition === 'new') {
                                  years = [currentYear, currentYear + 1];
                                }
                                return years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>);
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Model *</Label>
                        <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} disabled={!formData.vehicle_condition} />
                      </div>
                      <div className="space-y-2">
                        <Label>Grade</Label>
                        <Input value={formData.grade} onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))} placeholder="e.g. Premium" disabled={!formData.vehicle_condition} />
                      </div>
                      <div className="space-y-2">
                        <Label>Trim</Label>
                        <Input value={formData.trim} onChange={e => setFormData(p => ({ ...p, trim: e.target.value }))} placeholder="e.g. Sport" disabled={!formData.vehicle_condition} />
                      </div>
                      <div className="space-y-2">
                        <Label>Variant</Label>
                        <Input value={formData.variant} onChange={e => setFormData(p => ({ ...p, variant: e.target.value }))} disabled={!formData.vehicle_condition} />
                      </div>
                      {formData.vehicle_condition && (
                        <div className={`grid gap-3 sm:gap-4 ${formData.showWheelSegment === false ? '' : 'grid-cols-2'}`}>
                          {formData.showWheelSegment !== false && (
                            <div className="space-y-2">
                              <Label>Wheel Segment</Label>
                              <Select value={formData.vehicle_segment} onValueChange={(v: 'four_wheeler' | 'two_wheeler') => setFormData(p => ({ ...p, vehicle_segment: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                                  <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Step 2: All other fields */}
              {formStep === 2 && (
                <Card className="shadow-card border-primary border-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label>Powertrain</Label>
                        <Select value={formData.engine_type} onValueChange={v => setFormData(p => ({ ...p, engine_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="electric">Electric</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                            <SelectItem value="petrol">Petrol</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="cng">CNG</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.vehicle_condition !== 'demo' && (
                        <div className="space-y-2">
                          <Label>Set Price (Rs)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.set_price}
                            onChange={e => setFormData(p => ({ ...p, set_price: e.target.value }))}
                            placeholder="e.g. 1450000"
                          />
                        </div>
                      )}
                    </div>
                    {formData.vehicle_condition !== 'demo' && (
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label>Color (Hex Code)</Label>
                          <Input
                            value={formData.color}
                            onChange={e => {
                              const val = e.target.value;
                              if (/^#([0-9a-fA-F]{0,6})$/.test(val) || val === '') {
                                setFormData(p => ({ ...p, color: val }));
                              }
                            }}
                            pattern="#([0-9a-fA-F]{6})"
                            placeholder="#RRGGBB"
                            maxLength={7}
                          />
                          {formData.color && !/^#([0-9a-fA-F]{6})$/.test(formData.color) && (
                            <div className="text-xs text-destructive">Enter a valid hex color code (e.g. #AABBCC)</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Vehicle Time (days)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.vehicle_time_days}
                            onChange={e => setFormData(p => ({ ...p, vehicle_time_days: e.target.value }))}
                            placeholder="e.g. 7"
                          />
                        </div>
                      </div>
                    )}
                    {formData.vehicle_condition === 'demo' && (
                      <div className="space-y-2">
                        <Label>Associated New Variant *</Label>
                        <Select value={formData.demo_for_vehicle_id} onValueChange={v => setFormData(p => ({ ...p, demo_for_vehicle_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select brand/model/variant" /></SelectTrigger>
                          <SelectContent>
                            {associatedNewVariantOptions.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.variant || 'Standard'} ({v.year})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Demo vehicles are linked to a New variant and used for New-car test drives.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2"><Label>Units</Label><Input type="number" min="1" value={formData.total_units} onChange={e => setFormData(p => ({ ...p, total_units: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Available</Label><Input type="number" min="0" value={formData.available_units} onChange={e => setFormData(p => ({ ...p, available_units: e.target.value }))} /></div>
                    </div>
                    {(formData.vehicle_condition === 'used' || formData.vehicle_condition === 'demo') && (
                      <div className="space-y-2">
                        <Label>VIN</Label>
                        <Input value={formData.registration_number} onChange={e => setFormData(p => ({ ...p, registration_number: e.target.value }))} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Location *</Label>
                      <Select value={formData.location_id} onValueChange={v => setFormData(p => ({ ...p, location_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                        <SelectContent>
                          {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Image URL</Label><Input value={formData.image_url} onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." /></div>
                  </CardContent>
                </Card>
              )}
              {/* Stepper Controls */}
              <div className="flex gap-2 mt-4">
                {formStep > 1 && (
                  <Button variant="outline" onClick={() => setFormStep(s => Math.max(s - 1, 1))} className="flex-1">Back</Button>
                )}
                {formStep < 2 && (
                  <Button onClick={() => setFormStep(s => Math.min(s + 1, 2))} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">Next</Button>
                )}
                {formStep === 2 && (
                  <Button onClick={handleSubmit} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{editingId ? 'Update Vehicle' : 'Add Vehicle'}</Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default VehiclesPage;

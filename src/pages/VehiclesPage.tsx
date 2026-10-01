import { useEffect, useMemo, useState } from 'react';
import { demoAutofillData } from '@/lib/demoAutofillData';
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingState from '@/components/common/LoadingState';
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
import { Plus, Car, Edit2, MapPin, Palette, FileSpreadsheet, CalendarCheck, DollarSign, Zap, AlertCircle, Truck, PowerOff, Save, FilePlus2, NotebookPen, LayoutGrid, Tag, Clock3, SlidersHorizontal, Search, FilterX } from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BulkVehicleImport from '@/components/vehicles/BulkVehicleImport';
import VehicleReservations from '@/components/vehicles/VehicleReservations';
import PricingRulesConfig from '@/components/vehicles/PricingRulesConfig';
import VehicleImage from '@/components/common/VehicleImage';

type VehicleCompareSpecsDraft = {
  horsepower: string;
  torque: string;
  top_speed: string;
  acceleration: string;
  fuel_type: string;
  drive_type: string;
  transmission: string;
  mileage: string;
  battery_capacity: string;
  range_km: string;
  seating_capacity: string;
};

const emptyCompareSpecsDraft = (): VehicleCompareSpecsDraft => ({
  horsepower: '',
  torque: '',
  top_speed: '',
  acceleration: '',
  fuel_type: '',
  drive_type: '',
  transmission: '',
  mileage: '',
  battery_capacity: '',
  range_km: '',
  seating_capacity: '',
});

const FUEL_TYPE_OPTIONS = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG'] as const;
const DRIVE_TYPE_OPTIONS = ['FWD', 'RWD', 'AWD', '4WD', '2WD'] as const;
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT', 'DCT', 'AMT'] as const;

const toCompareSpecsDraft = (vehicle?: any): VehicleCompareSpecsDraft => ({
  horsepower: vehicle?.horsepower != null ? String(vehicle.horsepower) : '',
  torque: vehicle?.torque != null ? String(vehicle.torque) : '',
  top_speed: vehicle?.top_speed != null ? String(vehicle.top_speed) : '',
  acceleration: vehicle?.acceleration != null ? String(vehicle.acceleration) : '',
  fuel_type: vehicle?.fuel_type != null ? String(vehicle.fuel_type) : '',
  drive_type: vehicle?.drive_type != null ? String(vehicle.drive_type) : '',
  transmission: vehicle?.transmission != null ? String(vehicle.transmission) : '',
  mileage: vehicle?.mileage != null ? String(vehicle.mileage) : '',
  battery_capacity: vehicle?.battery_capacity != null ? String(vehicle.battery_capacity) : '',
  range_km: vehicle?.range_km != null ? String(vehicle.range_km) : '',
  seating_capacity: vehicle?.seating_capacity != null ? String(vehicle.seating_capacity) : '',
});

const CONDITION_LABEL: Record<string, string> = { new: 'New', used: 'Used', demo: 'Demo' };
const CONDITION_CLASS: Record<string, string> = {
  new:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  used: 'bg-amber-100 text-amber-700 border-amber-200',
  demo: 'bg-violet-100 text-violet-700 border-violet-200',
};

type VehicleWorkflowStatus = 'shipped' | 'in_stock' | 'sold' | 'returned';

const VEHICLE_WORKFLOW_LABELS: Record<VehicleWorkflowStatus, string> = {
  shipped: 'Shipped',
  in_stock: 'In Stock',
  sold: 'Sold',
  returned: 'Returned',
};

const getWorkflowStatus = (value?: string | null): VehicleWorkflowStatus => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'in_stock') return 'in_stock';
  if (normalized === 'sold') return 'sold';
  if (normalized === 'returned') return 'returned';
  return 'shipped';
};

const normalizeIdList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((id) => String(id || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
};

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStep, setFormStep] = useState(1);
  const [createDemoForNew, setCreateDemoForNew] = useState(false);
  const [specPromptVehicle, setSpecPromptVehicle] = useState<{ id: string; name: string } | null>(null);
  const [specDraft, setSpecDraft] = useState<VehicleCompareSpecsDraft>(emptyCompareSpecsDraft());
  const [demoFormData, setDemoFormData] = useState({
    variant: 'Demo', year: new Date().getFullYear().toString(), color: '', registration_number: '', image_url: '',
    total_units: '1', available_units: '1',
  });
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [formData, setFormData] = useState({
    brand: '', brand_id: '', model: '', grade: '', trim: '', variant: '', year: new Date().getFullYear().toString(),
    color: '', registration_number: '', location_id: '', image_url: '',
    total_units: '1', available_units: '1',
    engine_type: 'petrol', vehicle_segment: 'four_wheeler' as 'four_wheeler' | 'two_wheeler',
    set_price: '', vehicle_time_days: '', vehicle_condition: 'new' as 'new' | 'used' | 'demo', demo_for_vehicle_id: '',
    workflow_status: 'shipped' as VehicleWorkflowStatus,
    showWheelSegment: true, is_shared: false, shared_location_ids: [] as string[],
  });
  const { toast } = useToast();
  const { dealerId, loading: dealerLoading } = useDealerContext();
  const { role, profile } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const isAdmin = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN;
  // Can manage full vehicle CRUD (add / delete / pricing)
  const canManageVehicles = isAdmin || role === APP_ROLE.BRAND_ADMIN || role === APP_ROLE.SALES_ADMIN;
  // Can update available stock count (all operational roles)
  const canUpdateStock = canManageVehicles || role === APP_ROLE.SALES;
  const canDeactivate = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN;
  const shouldRestrictToAssignments = !isSuperAdmin;
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [workflowActionTarget, setWorkflowActionTarget] = useState<{ vehicle: any; nextStatus: VehicleWorkflowStatus } | null>(null);
  const [workflowActionQuantity, setWorkflowActionQuantity] = useState('1');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sold' | 'unavailable' | 'deactivated'>('all');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'new' | 'used' | 'demo'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<'all' | VehicleWorkflowStatus>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'bulk' | 'reservations' | 'pricing'>('inventory');
  const [inventoryFiltersOpen, setInventoryFiltersOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const showDemoSetupStep = !editingId && formData.vehicle_condition === 'new' && createDemoForNew;
  const totalSteps = showDemoSetupStep ? 3 : 2;

  // Only new, non-demo vehicles at the selected location can be the parent of a demo
  const associatedNewVariantOptions = vehicles.filter((v) => {
    if (v.is_demo) return false;
    if (!v.is_new || v.is_used) return false;
    if (!formData.location_id) return false;
    if (v.location_id !== formData.location_id) return false;
    if (editingId && v.id === editingId) return false;
    return true;
  });

  const getVehicleCondition = (vehicle: any) => (
    vehicle.vehicle_condition || (vehicle.is_demo ? 'demo' : vehicle.is_used ? 'used' : 'new')
  );

  const hasVehicleStock = (vehicle: any) => Number(vehicle.available_units || 0) > 0;
  const isVehicleSold = (vehicle: any) => vehicle.is_active && !hasVehicleStock(vehicle);
  const isVehicleAvailable = (vehicle: any) => vehicle.is_active && hasVehicleStock(vehicle);
  const isVehicleUnavailable = (vehicle: any) => false;
  const isVehicleDeactivated = (vehicle: any) => !vehicle.is_active;

  const vehicleMetrics = useMemo(() => {
    const active = vehicles.filter((vehicle) => isVehicleAvailable(vehicle)).length;
    const sold = vehicles.filter((vehicle) => isVehicleSold(vehicle)).length;
    const reserved = vehicles.filter((vehicle) => getWorkflowStatus(vehicle.status) === 'returned' || getWorkflowStatus(vehicle.status) === 'shipped').length;
    return [
      { label: 'Inventory', value: vehicles.length, hint: 'All vehicles', icon: LayoutGrid },
      { label: 'Active', value: active, hint: 'Available now', icon: Car },
      { label: 'Pricing', value: 'Rules', hint: 'Manage offers', icon: DollarSign },
      { label: 'Reservations', value: reserved, hint: 'Open journeys', icon: Clock3 },
    ];
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();

    return vehicles
      .filter((v) => {
        if (statusFilter === 'active') return isVehicleAvailable(v);
        if (statusFilter === 'sold') return v.is_active && isVehicleSold(v);
        if (statusFilter === 'unavailable') return isVehicleUnavailable(v);
        if (statusFilter === 'deactivated') return isVehicleDeactivated(v);
        return true;
      })
      .filter((v) => {
        if (conditionFilter === 'all') return true;
        return getVehicleCondition(v) === conditionFilter;
      })
      .filter((v) => {
        if (workflowFilter === 'all') return true;
        return getWorkflowStatus(v.status) === workflowFilter;
      })
      .filter((v) => {
        if (!query) return true;
        const searchable = [v.brand, v.model, v.grade, v.trim, v.variant, v.registration_number, v.color, v.locations?.name, v.current_location_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      });
  }, [vehicles, statusFilter, conditionFilter, workflowFilter, inventorySearch]);

  const clearInventoryFilters = () => {
    setInventorySearch('');
    setStatusFilter('all');
    setConditionFilter('all');
    setWorkflowFilter('all');
    if (isSuperAdmin) setSelectedDealer('all');
  };

  const assignedBrandIds = useMemo(() => {
    return normalizeIdList(profile?.brand_ids);
  }, [profile?.brand_ids]);

  const assignedLocationIds = useMemo(() => {
    const ids = new Set<string>();
    if (profile?.location_id) ids.add(String(profile.location_id));
    normalizeIdList(profile?.location_ids).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [profile?.location_id, profile?.location_ids]);

  const assignableBrands = useMemo(() => {
    if (!shouldRestrictToAssignments) return brands;
    if (assignedBrandIds.length === 0) return [];
    const allowed = new Set(assignedBrandIds);
    return brands.filter((brand: any) => allowed.has(String(brand.id)));
  }, [brands, shouldRestrictToAssignments, assignedBrandIds]);

  const brandOptions = assignableBrands.length > 0 ? assignableBrands : brands;

  const assignableLocations = useMemo(() => {
    if (!shouldRestrictToAssignments) return locations;
    if (assignedLocationIds.length === 0) return [];
    const allowed = new Set(assignedLocationIds);
    return locations.filter((location: any) => allowed.has(String(location.id)));
  }, [locations, shouldRestrictToAssignments, assignedLocationIds]);

  // In Add Vehicle dialog, auto-select defaults when there is exactly one allowed option.
  useEffect(() => {
    if (!showDialog || !!editingId) return;

    setFormData((prev) => {
      let next = { ...prev };

      if (!next.location_id && assignableLocations.length === 1) {
        next.location_id = assignableLocations[0].id;
      }

      if (!next.brand_id && brandOptions.length === 1) {
        next.brand_id = brandOptions[0].id;
        next.brand = brandOptions[0].name || next.brand;
      }

      return next;
    });
  }, [showDialog, editingId, assignableLocations, brandOptions]);

  useEffect(() => {
    if (!showDialog || !formData.brand || formData.brand_id || brandOptions.length === 0) return;
    const matchedBrand = brandOptions.find((brand) => String(brand.name).toLowerCase() === String(formData.brand).toLowerCase());
    if (matchedBrand) {
      setFormData((prev) => ({ ...prev, brand_id: matchedBrand.id }));
    }
  }, [showDialog, formData.brand, formData.brand_id, brandOptions]);

  // Map: new vehicle id → demo vehicles linked to it
  const demosForVehicle = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of vehicles) {
      if (v.is_demo && v.demo_for_vehicle_id) {
        if (!map.has(v.demo_for_vehicle_id)) map.set(v.demo_for_vehicle_id, []);
        map.get(v.demo_for_vehicle_id)!.push(v);
      }
    }
    return map;
  }, [vehicles]);

  // ── Initial data load ───────────────────────────────────────
  useEffect(() => {
    if (dealerLoading) return;

    if (isSuperAdmin) {
      apiGet<any[]>('/api/dealers?is_active=true')
        .then((data) => setDealers(data || []));
    }

    const locationParams = new URLSearchParams({ is_active: 'true' });
    apiGet<any[]>(`/api/locations?${locationParams}`)
      .then((data) => setLocations(data || []));

    apiGet<any[]>('/api/brands')
      .then((data) => setBrands((data || []).sort((a: any, b: any) => a.name.localeCompare(b.name))));

    fetchVehicles();
  }, [dealerId, dealerLoading, isSuperAdmin]);

  useEffect(() => {
    if (!dealerLoading) fetchVehicles();
  }, [selectedDealer, dealerLoading]);

  // ── When demo_for_vehicle_id changes: auto-fill brand/model/grade/trim/year ──
  useEffect(() => {
    if (formData.vehicle_condition !== 'demo' || !formData.demo_for_vehicle_id) return;
    const parent = vehicles.find((v) => v.id === formData.demo_for_vehicle_id);
    if (!parent) return;
    setFormData((p) => ({
      ...p,
      brand_id: parent.brandId || p.brand_id,
      brand: parent.brand,
      model: parent.model,
      grade: parent.grade || '',
      trim: parent.trim || '',
      year: String(parent.year),
    }));
  }, [formData.demo_for_vehicle_id]);

  const handleDeactivate = async (vehicleId: string) => {
    try {
      await apiPatch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { is_active: false });
      toast({ title: 'Vehicle deactivated', description: 'The vehicle has been deactivated and will no longer appear in booking flows.' });
      if (profile?.user_id) {
        const v = vehicles.find(x => x.id === vehicleId);
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile?.location_id, role: role as any,
          eventType: 'vehicle_deactivated',
          label: `Deactivated vehicle: ${v?.brand ?? ''} ${v?.model ?? ''} ${v?.registration_number ? `(${v.registration_number})` : ''}`.trim(),
          route: '/vehicles',
          metadata: { vehicleId, vehicleName: `${v?.brand ?? ''} ${v?.model ?? ''}`.trim() || null },
        });
      }
      setDeactivateTarget(null);
      fetchVehicles();
    } catch (err: any) {
      toast({ title: 'Failed to deactivate', description: err.message, variant: 'destructive' });
    }
  };

  const handleReactivate = async (vehicleId: string) => {
    try {
      await apiPatch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, { is_active: true });
      toast({ title: 'Vehicle reactivated', description: 'The vehicle is now active and available in booking flows.' });
      if (profile?.user_id) {
        const v = vehicles.find(x => x.id === vehicleId);
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile?.location_id, role: role as any,
          eventType: 'vehicle_reactivated',
          label: `Reactivated vehicle: ${v?.brand ?? ''} ${v?.model ?? ''} ${v?.registration_number ? `(${v.registration_number})` : ''}`.trim(),
          route: '/vehicles',
          metadata: { vehicleId, vehicleName: `${v?.brand ?? ''} ${v?.model ?? ''}`.trim() || null },
        });
      }
      fetchVehicles();
    } catch (err: any) {
      toast({ title: 'Failed to reactivate', description: err.message, variant: 'destructive' });
    }
  };

  // ── Fetch vehicles ──────────────────────────────────────────
  const fetchVehicles = async () => {
    try {
      const rows = await apiGet<any[]>(`/api/vehicles`);

      // Hydrate location name
      let locList = locations;
      if (!locList.length) {
        locList = await apiGet<any[]>('/api/locations') || [];
      }
      const locationMap = (locList || []).reduce((acc: Record<string, any>, loc: any) => {
        acc[loc.id] = loc;
        return acc;
      }, {});

      const hydrated = (rows || []).map((v: any) => ({
        ...v,
        locations: locationMap[v.location_id]
          ? { name: locationMap[v.location_id].name, dealer_id: locationMap[v.location_id].dealer_id }
          : null,
        current_location_name: v.current_location_id && locationMap[v.current_location_id]
          ? locationMap[v.current_location_id].name
          : null,
      }));

      let filtered = hydrated;
      if (isSuperAdmin && selectedDealer !== 'all') {
        filtered = filtered.filter((v: any) => v.locations?.dealer_id === selectedDealer);
      }

      filtered.sort((a: any, b: any) => String(a.brand || '').localeCompare(String(b.brand || '')));
      setVehicles(filtered);
    } catch (error) {
      console.error('Failed to fetch vehicles', error);
      toast({ title: 'Error', description: 'Failed to load vehicles list', variant: 'destructive' });
      setVehicles([]);
    }
  };

  // ── Open edit ───────────────────────────────────────────────
  const openEdit = (v: any) => {
    setEditingId(v.id);
    setFormStep(1);
    setCreateDemoForNew(false);
    setSpecPromptVehicle(null);
    setSpecDraft(toCompareSpecsDraft(v));
    setFormData({
      brand: v.brand, brand_id: v.brandId || '', model: v.model, grade: v.grade || '', trim: v.trim || '', variant: v.variant || '', year: String(v.year),
      color: v.color || '', registration_number: v.registration_number || '',
      location_id: v.location_id, image_url: v.image_url || '',
      total_units: String(v.total_units || 1), available_units: String(v.available_units || 1),
      engine_type: v.engine_type || 'petrol', vehicle_segment: v.vehicle_segment || 'four_wheeler',
      set_price: v.set_price != null ? String(v.set_price) : '',
      vehicle_time_days: v.vehicle_time_days != null ? String(v.vehicle_time_days) : '',
      vehicle_condition: v.vehicle_condition || (v.is_demo ? 'demo' : v.is_used ? 'used' : 'new'),
      demo_for_vehicle_id: v.demo_for_vehicle_id || '',
      workflow_status: getWorkflowStatus(v.status),
      showWheelSegment: true, is_shared: !!v.is_shared, shared_location_ids: (v.shared_location_ids as string[]) || [],
    });
    setDemoFormData({
      variant: 'Demo', year: String(v.year || new Date().getFullYear()), color: '', registration_number: '', image_url: '',
      total_units: '1', available_units: '1',
    });
    setShowDialog(true);
  };

  const openVehicleSpecsPrompt = (vehicle: any) => {
    setEditingId(null);
    setFormStep(1);
    setCreateDemoForNew(false);
    setShowDialog(false);
    setSpecPromptVehicle({ id: vehicle.id, name: `${vehicle.brand} ${vehicle.model}`.trim() });
    setSpecDraft(toCompareSpecsDraft(vehicle));
  };

  // ── Open new ────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setFormStep(1);
    setCreateDemoForNew(false);
    setSpecPromptVehicle(null);
    setSpecDraft(emptyCompareSpecsDraft());
    setFormData({
      brand: '', brand_id: '', model: '', grade: '', trim: '', variant: '', year: new Date().getFullYear().toString(),
      color: '', registration_number: '', location_id: '', image_url: '',
      total_units: '1', available_units: '1', engine_type: 'petrol', vehicle_segment: 'four_wheeler',
      set_price: '', vehicle_time_days: '', vehicle_condition: 'new', demo_for_vehicle_id: '',
      workflow_status: 'shipped',
      showWheelSegment: true, is_shared: false, shared_location_ids: [] as string[],
    });
    setDemoFormData({
      variant: 'Demo', year: new Date().getFullYear().toString(), color: '', registration_number: '', image_url: '',
      total_units: '1', available_units: '1',
    });
    setShowDialog(true);
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.location_id) {
      toast({ title: 'Missing fields', description: 'Brand, model and location are required.', variant: 'destructive' });
      return;
    }
    if (formData.vehicle_condition === 'demo' && !formData.demo_for_vehicle_id) {
      toast({ title: 'Demo association required', description: 'Select which New variant this demo vehicle is for.', variant: 'destructive' });
      return;
    }

    const condition = formData.vehicle_condition;
    const payload: Record<string, unknown> = {
      brand: formData.brand,
      brandId: formData.brand_id || null,
      model: formData.model,
      grade: formData.grade || null,
      trim: formData.trim || null,
      variant: formData.variant || null,
      year: parseInt(formData.year),
      color: formData.color || null,
      registration_number: formData.registration_number || null,
      location_id: formData.location_id,
      current_location_id: formData.location_id,
      image_url: formData.image_url || null,
      total_units: parseInt(formData.total_units) || 1,
      available_units: parseInt(formData.available_units) || 1,
      engine_type: formData.engine_type || null,
      vehicle_segment: formData.vehicle_segment,
      vehicle_condition: condition,
      // Flags derived from condition
      is_new:  condition === 'new' || condition === 'demo',
      is_used: condition === 'used',
      is_demo: condition === 'demo',
      // Price / time only for non-demo
      set_price:         condition === 'demo' ? null : (formData.set_price ? Number(formData.set_price) : null),
      vehicle_time_days: condition === 'demo' ? null : (formData.vehicle_time_days ? parseInt(formData.vehicle_time_days) : null),
      // Demo link
      demo_for_vehicle_id: condition === 'demo' ? formData.demo_for_vehicle_id : null,
      // Ship-to-sale lifecycle
      status: formData.workflow_status,
      is_available: formData.workflow_status !== 'sold',
      transit_status: formData.workflow_status === 'shipped' ? 'in_transit' : 'at_location',
      transit_to_location_id: formData.workflow_status === 'shipped' ? formData.location_id || null : null,
      // Shared fleet flag — only meaningful for demo vehicles
      is_shared: formData.is_shared,
      // empty = all locations; non-empty = specific location IDs only
      shared_location_ids: formData.is_shared ? formData.shared_location_ids : [],
    };

    try {
      if (editingId) {
        await apiPatch(`/api/vehicles/${encodeURIComponent(editingId)}`, payload);
        toast({ title: 'Vehicle updated' });
        if (profile?.user_id) {
          void logStaffActivity({
            userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
            eventType: 'vehicle_updated',
            label: `Updated vehicle: ${formData.brand} ${formData.model}`,
            route: '/vehicles',
            metadata: { vehicleId: editingId, brand: formData.brand, model: formData.model, condition: formData.vehicle_condition, registrationNumber: formData.registration_number || null },
          });
        }

        setSpecPromptVehicle({ id: editingId, name: `${formData.brand} ${formData.model}`.trim() });
        const currentVehicle = vehicles.find((vehicle) => vehicle.id === editingId);
        setSpecDraft(toCompareSpecsDraft({ ...currentVehicle, ...payload }));
      } else {
        const created = await apiPost<any>('/api/vehicles', payload);
        const createdId: string = Array.isArray(created) ? created[0]?.id : created?.id;

        // Optionally create linked demo vehicle for a new car
        if (showDemoSetupStep && createdId) {
          const demoPayload: Record<string, unknown> = {
            brand: formData.brand,
            brandId: formData.brand_id || null,
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
            vehicle_condition: 'demo',
            is_new: true, is_used: false, is_demo: true,
            set_price: null, vehicle_time_days: null,
            demo_for_vehicle_id: createdId,
          };
          await apiPost('/api/vehicles', demoPayload);
          toast({ title: 'Vehicle + Demo added', description: 'New vehicle and linked demo vehicle created.' });
          if (profile?.user_id) {
            void logStaffActivity({
              userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
              eventType: 'vehicle_created',
              label: `Created vehicle + demo: ${formData.brand} ${formData.model}`,
              route: '/vehicles',
              metadata: { vehicleId: createdId, brand: formData.brand, model: formData.model, condition: 'new', withDemo: true },
            });
          }
        } else {
          toast({ title: 'Vehicle added' });
          if (profile?.user_id) {
            void logStaffActivity({
              userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
              eventType: 'vehicle_created',
              label: `Created vehicle: ${formData.brand} ${formData.model}`,
              route: '/vehicles',
              metadata: { vehicleId: createdId, brand: formData.brand, model: formData.model, condition: formData.vehicle_condition },
            });
          }
        }

        if (createdId) {
          setSpecPromptVehicle({ id: createdId, name: `${formData.brand} ${formData.model}`.trim() });
          setSpecDraft(emptyCompareSpecsDraft());
        }
      }

      setShowDialog(false);
      fetchVehicles();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleSaveCompareSpecs = async () => {
    if (!specPromptVehicle) return;

    const payload: Record<string, unknown> = {};
    const assignNumber = (key: keyof VehicleCompareSpecsDraft, target: 'horsepower' | 'range_km' | 'seating_capacity') => {
      const value = specDraft[key].trim();
      if (value !== '') payload[target] = Number(value);
    };
    const assignText = (key: keyof VehicleCompareSpecsDraft, target: 'torque' | 'top_speed' | 'acceleration' | 'fuel_type' | 'drive_type' | 'transmission' | 'mileage' | 'battery_capacity') => {
      const value = specDraft[key].trim();
      if (value !== '') payload[target] = value;
    };

    assignNumber('horsepower', 'horsepower');
    assignText('torque', 'torque');
    assignText('top_speed', 'top_speed');
    assignText('acceleration', 'acceleration');
    assignText('fuel_type', 'fuel_type');
    assignText('drive_type', 'drive_type');
    assignText('transmission', 'transmission');
    assignText('mileage', 'mileage');
    assignText('battery_capacity', 'battery_capacity');
    assignNumber('range_km', 'range_km');
    assignNumber('seating_capacity', 'seating_capacity');

    try {
      if (Object.keys(payload).length > 0) {
        await apiPatch(`/api/vehicles/${encodeURIComponent(specPromptVehicle.id)}`, payload);
        toast({ title: 'Compare specs saved', description: 'The new vehicle is now ready for richer compare cards.' });
        fetchVehicles();
      }
      setSpecPromptVehicle(null);
      setSpecDraft(emptyCompareSpecsDraft());
    } catch (err: any) {
      toast({ title: 'Specs save failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleSkipCompareSpecs = () => {
    setSpecPromptVehicle(null);
    setSpecDraft(emptyCompareSpecsDraft());
  };

  const handleStartWorkflowAction = (vehicle: any, nextStatus: VehicleWorkflowStatus) => {
    const currentAvailable = Number(vehicle.available_units || 0);
    const totalUnits = Number(vehicle.total_units || 0);
    let defaultQuantity = 1;

    if (nextStatus === 'sold' || nextStatus === 'shipped') {
      defaultQuantity = currentAvailable > 0 ? currentAvailable : 1;
    } else if (nextStatus === 'in_stock') {
      const diff = totalUnits - currentAvailable;
      defaultQuantity = diff > 0 ? diff : 1;
    }

    setWorkflowActionQuantity(String(defaultQuantity));
    setWorkflowActionTarget({ vehicle, nextStatus });
  };

  const handleConfirmWorkflowAction = async () => {
    if (!workflowActionTarget) return;
    const { vehicle, nextStatus } = workflowActionTarget;
    const currentAvailable = Number(vehicle.available_units || 0);
    const totalUnits = Number(vehicle.total_units || 0);
    const quantity = Math.max(0, Math.floor(Number(workflowActionQuantity) || 0));

    if (quantity <= 0) {
      toast({ title: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }

    if (nextStatus !== 'in_stock' && quantity > currentAvailable) {
      toast({ title: 'Quantity exceeds available units', description: `Max available: ${currentAvailable}`, variant: 'destructive' });
      return;
    }

    const updatedAvailable = nextStatus === 'in_stock'
      ? Math.min(totalUnits, currentAvailable + quantity)
      : Math.max(0, currentAvailable - quantity);

    try {
      await apiPatch(`/api/vehicles/${encodeURIComponent(vehicle.id)}`, {
        status: nextStatus,
        available_units: updatedAvailable,
        is_available: nextStatus !== 'sold' && updatedAvailable > 0,
        transit_status: nextStatus === 'shipped' ? 'in_transit' : 'at_location',
        transit_to_location_id: nextStatus === 'shipped' ? vehicle.location_id : null,
      });
      toast({ title: 'Vehicle updated', description: `${quantity} unit${quantity !== 1 ? 's' : ''} ${VEHICLE_WORKFLOW_LABELS[nextStatus].toLowerCase()} saved.` });
      setWorkflowActionTarget(null);
      fetchVehicles();
    } catch (err: any) {
      toast({ title: 'Status update failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading vehicles..." className="py-16" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Tag className="h-3.5 w-3.5" /> Vehicle Management
              </div>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-3xl font-heading font-bold text-foreground">Inventory, pricing, and reservations in one flow</h1>
                <p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
                  Keep vehicles, price rules, and reservations in a clean workspace that is easy to scan, quick to edit, and flexible for daily operations.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" style={{ display: canManageVehicles ? undefined : 'none' }}>
                <Plus className="h-4 w-4 mr-2" /> Add Vehicle
              </Button>
            </div>
          </div>
          <div className="grid gap-3 border-t border-border/60 bg-background/60 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {vehicleMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                      <p className="mt-1 text-2xl font-heading font-semibold text-foreground">{metric.value}</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{metric.hint}</p>
                </div>
              );
            })}
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'inventory' | 'bulk' | 'reservations' | 'pricing')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1 sm:grid-cols-4">
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

          {/* ── Inventory tab ───────────────────────── */}
          <TabsContent value="inventory" id="inventory" className="space-y-4 mt-4 scroll-mt-24">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Inventory cards</p>
                    <p className="text-xs text-muted-foreground">Showing {filteredVehicles.length} of {vehicles.length} vehicles</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="gap-2 border-primary/20" onClick={() => setInventoryFiltersOpen(true)}>
                      <SlidersHorizontal className="h-4 w-4" /> Filters
                    </Button>
                    <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={clearInventoryFilters}>
                      <FilterX className="h-4 w-4" /> Clear
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {selectedDealer !== 'all' && <Badge variant="secondary" className="rounded-full">Dealer: {dealers.find((d: any) => d.id === selectedDealer)?.name || 'Selected'}</Badge>}
                  {statusFilter !== 'all' && <Badge variant="secondary" className="rounded-full">Status: {statusFilter}</Badge>}
                  {conditionFilter !== 'all' && <Badge variant="secondary" className="rounded-full">Condition: {conditionFilter}</Badge>}
                  {workflowFilter !== 'all' && <Badge variant="secondary" className="rounded-full">Workflow: {VEHICLE_WORKFLOW_LABELS[workflowFilter]}</Badge>}
                  {inventorySearch && <Badge variant="secondary" className="rounded-full">Search: {inventorySearch}</Badge>}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredVehicles.map((v) => {
                const linkedDemos = demosForVehicle.get(v.id) || [];
                const demoAvail = linkedDemos.reduce((s: number, d: any) => s + (d.available_units || 0), 0);
                const demoTotal = linkedDemos.reduce((s: number, d: any) => s + (d.total_units || 0), 0);
                const cond: string = v.vehicle_condition || (v.is_demo ? 'demo' : v.is_used ? 'used' : 'new');

                return (
                  <Card key={v.id} className={`shadow-card hover:shadow-elevated transition-shadow border-l-4 ${
                    !v.is_active
                      ? 'border-l-muted-foreground/30 opacity-60'
                      : isVehicleSold(v)
                      ? 'border-l-primary-400'
                      : isVehicleUnavailable(v)
                      ? 'border-l-amber-400'
                      : cond === 'demo' ? 'border-l-violet-400' : cond === 'used' ? 'border-l-amber-400' : 'border-l-emerald-400'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <VehicleImage
                            imageUrl={v.image_url}
                            brand={v.brand}
                            model={v.model}
                            className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="font-heading font-semibold text-sm text-foreground truncate">{v.brand} {v.model}</h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {[v.grade, v.trim, v.variant].filter(Boolean).join(' · ') || 'Standard'} · {v.year}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={`text-[10px] border ${CONDITION_CLASS[cond] ?? 'bg-muted text-muted-foreground'}`}>
                            {CONDITION_LABEL[cond] ?? cond}
                          </Badge>
                          {!v.is_active ? (
                            <Badge className="text-[10px] bg-destructive/10 text-destructive border border-destructive/30">
                              ● Deactivated
                            </Badge>
                          ) : isVehicleSold(v) ? (
                            <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/30">
                              ● Sold
                            </Badge>
                          ) : isVehicleAvailable(v) ? (
                            <Badge className="text-[10px] bg-success/10 text-success border border-success/30">
                              ● Active
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                              ● Unavailable
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0 border-primary/20"
                              title="Add or update specs"
                              onClick={() => openVehicleSpecsPrompt(v)}
                            >
                              <NotebookPen className="h-3 w-3" />
                            </Button>
                            {canManageVehicles && (
                              <Button size="sm" className="h-6 w-6 p-0 border border-primary/20" title="Edit vehicle" onClick={() => openEdit(v)}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            {canUpdateStock && !canManageVehicles && (
                              <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1 border-primary/20" title="Update stock" onClick={() => openEdit(v)}>
                                <Edit2 className="h-2.5 w-2.5" /> Stock
                              </Button>
                            )}
                            {canDeactivate && v.is_active && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive border border-destructive/20" title="Deactivate vehicle"
                                onClick={() => setDeactivateTarget({ id: v.id, name: `${v.brand} ${v.model}${v.variant ? ' ' + v.variant : ''}` })}>
                                <PowerOff className="h-3 w-3" />
                              </Button>
                            )}
                            {canDeactivate && !v.is_active && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-success hover:bg-success  hover:text-white border border-success/20" title="Reactivate vehicle"
                                onClick={() => handleReactivate(v.id)}>
                                <PowerOff className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges row */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">{v.vehicle_segment === 'two_wheeler' ? '2W' : '4W'}</Badge>
                        {v.engine_type && <Badge variant="secondary" className="text-[10px] uppercase">{v.engine_type}</Badge>}
                        {cond !== 'demo' && v.set_price != null && (
                          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">₹{Number(v.set_price).toLocaleString()}</Badge>
                        )}
                        {cond !== 'demo' && v.vehicle_time_days != null && (
                          <Badge variant="secondary" className="text-[10px]">{v.vehicle_time_days}d slot</Badge>
                        )}
                        {/* Demo: show parent vehicle */}
                        {cond === 'demo' && v.demo_for_vehicle_id && (
                          <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-700">
                            For: {(() => {
                              const p = vehicles.find((x) => x.id === v.demo_for_vehicle_id);
                              return p ? `${p.brand} ${p.model}${p.variant ? ' ' + p.variant : ''}` : 'Linked';
                            })()}
                          </Badge>
                        )}
                        {v.is_shared && (
                          <Badge className="text-[10px] bg-info/10 text-info border border-info/30 gap-1">
                            <Truck className="h-2.5 w-2.5" />
                            {v.shared_location_ids?.length
                              ? `${v.shared_location_ids.length} loc${v.shared_location_ids.length > 1 ? 's' : ''}`
                              : 'All Locations'}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          {VEHICLE_WORKFLOW_LABELS[isVehicleAvailable(v) ? 'in_stock' : getWorkflowStatus(v.status)]}
                        </Badge>
                      </div>

                      {/* Availability row */}
                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${v.available_units > 0 ? 'text-success' : 'text-destructive'}`}>
                            {v.available_units}/{v.total_units} avail
                          </span>
                          {/* New vehicle: show linked demo availability */}
                          {cond === 'new' && linkedDemos.length > 0 && (
                            <span className={`flex items-center gap-0.5 ${demoAvail > 0 ? 'text-violet-600' : 'text-rose-500'}`}>
                              <Zap className="h-3 w-3" />
                              Demo {demoAvail}/{demoTotal}
                            </span>
                          )}
                          {cond === 'new' && linkedDemos.length === 0 && (
                            <span className="flex items-center gap-0.5 text-muted-foreground">
                              <AlertCircle className="h-3 w-3" /> No demo
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground flex flex-col items-end gap-0.5">
                          {v.color && <span className="flex items-center gap-1"><Palette className="h-3 w-3" />{v.color}</span>}
                          {v.registration_number && <span>VIN: {v.registration_number}</span>}
                          {v.current_location_id && v.current_location_id !== v.location_id ? (
                            <span className="flex items-center gap-1 text-info">
                              <MapPin className="h-3 w-3" />
                              {v.current_location_name ?? v.current_location_id}
                              <span className="text-[9px] text-muted-foreground">(currently)</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{v.locations?.name}</span>
                          )}
                        </div>
                      </div>
                      <div className={ `${v.condition === 'new' ? '' : 'hidden'} mt-3 flex items-center gap-2 flex-wrap`}>
                        
                        {canManageVehicles && (
                          <>
                            {getWorkflowStatus(v.status) !== 'in_stock' && (
                              <Button size="sm" variant="outline" onClick={() => handleStartWorkflowAction(v, 'in_stock')}>
                                Receive to Branch
                              </Button>
                            )}
                            {isVehicleAvailable(v) ? (
                              <Button size="sm" variant="default" onClick={() => handleStartWorkflowAction(v, 'sold')}>
                                Mark Sold
                              </Button>
                            ) : null}
                            {getWorkflowStatus(v.status) !== 'shipped' && (
                              <Button size="sm" variant="secondary" onClick={() => handleStartWorkflowAction(v, 'shipped')}>
                                Mark Shipped
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <BulkVehicleImport locations={locations.map((l: any) => ({ id: l.id, name: l.name }))} onImportComplete={fetchVehicles} />
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

        <Dialog open={inventoryFiltersOpen} onOpenChange={setInventoryFiltersOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Inventory Filters</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Search cards</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Brand, model, variant, VIN, location..."
                    className="pl-9"
                  />
                </div>
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Filter by dealer</Label>
                  <Select value={selectedDealer} onValueChange={setSelectedDealer}>
                    <SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers</SelectItem>
                      {dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Inventory status</Label>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'sold' | 'unavailable' | 'deactivated')}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({vehicles.length})</SelectItem>
                      <SelectItem value="active">Available ({vehicles.filter(v => isVehicleAvailable(v)).length})</SelectItem>
                      <SelectItem value="sold">Sold ({vehicles.filter(v => isVehicleSold(v) && v.is_active).length})</SelectItem>
                      <SelectItem value="unavailable">Unavailable ({vehicles.filter(v => isVehicleUnavailable(v)).length})</SelectItem>
                      <SelectItem value="deactivated">Deactivated ({vehicles.filter(v => !v.is_active).length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Condition</Label>
                  <Select value={conditionFilter} onValueChange={(value) => setConditionFilter(value as 'all' | 'new' | 'used' | 'demo')}>
                    <SelectTrigger><SelectValue placeholder="All conditions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({vehicles.length})</SelectItem>
                      <SelectItem value="new">New ({vehicles.filter(v => getVehicleCondition(v) === 'new').length})</SelectItem>
                      <SelectItem value="used">Used ({vehicles.filter(v => getVehicleCondition(v) === 'used').length})</SelectItem>
                      <SelectItem value="demo">Demo ({vehicles.filter(v => getVehicleCondition(v) === 'demo').length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Workflow</Label>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'shipped', 'in_stock', 'sold', 'returned'] as const).map((stage) => {
                    const count = stage === 'all'
                      ? vehicles.length
                      : vehicles.filter((v) => getWorkflowStatus(v.status) === stage).length;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setWorkflowFilter(stage)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          workflowFilter === stage
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {stage === 'all' ? 'All stages' : VEHICLE_WORKFLOW_LABELS[stage]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button variant="outline" onClick={clearInventoryFilters} className="gap-2">
                  <FilterX className="h-4 w-4" /> Clear filters
                </Button>
                <Button onClick={() => setInventoryFiltersOpen(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Add / Edit Dialog ───────────────────── */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
                {/* Stepper indicator */}
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                  <div key={step} className={`h-1.5 w-20 rounded-full transition-colors ${formStep >= step ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              {/* ── Step 1: Identity ── */}
              {formStep === 1 && (
                <Card className="border-2 border-primary">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={formData.vehicle_condition}
                          onValueChange={(v: 'new' | 'used' | 'demo') =>
                            setFormData((p) => ({
                              ...p, vehicle_condition: v,
                              demo_for_vehicle_id: v === 'demo' ? p.demo_for_vehicle_id : '',
                              brand: v === 'demo' ? '' : p.brand,
                              model: v === 'demo' ? '' : p.model,
                              grade: v === 'demo' ? '' : p.grade,
                              trim: v === 'demo' ? '' : p.trim,
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">🆕 New Vehicle</SelectItem>
                            <SelectItem value="used">🔄 Used Vehicle</SelectItem>
                            <SelectItem value="demo">⚡ Demo Vehicle (Test Drive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Wheel Segment</Label>
                        <Select value={formData.vehicle_segment} onValueChange={(v: 'four_wheeler' | 'two_wheeler') => setFormData((p) => ({ ...p, vehicle_segment: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                            <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Demo: link to parent new vehicle first, then brand/model auto-fills */}
                    {formData.vehicle_condition === 'demo' && (
                      <div className="space-y-2">
                        <Label>Location *</Label>
                        <Select value={formData.location_id} onValueChange={(v) => setFormData((p) => ({ ...p, location_id: v, demo_for_vehicle_id: '' }))}>
                          <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                          <SelectContent>
                            {assignableLocations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Label>Associated New Vehicle *</Label>
                        <Select
                          value={formData.demo_for_vehicle_id}
                          onValueChange={(v) => setFormData((p) => ({ ...p, demo_for_vehicle_id: v }))}
                          disabled={!formData.location_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!formData.location_id ? 'Select location first' : 'Link to new variant'} />
                          </SelectTrigger>
                          <SelectContent>
                            {associatedNewVariantOptions.map((v: any) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.brand} {v.model} {[v.grade, v.trim, v.variant].filter(Boolean).join(' / ')} ({v.year})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.demo_for_vehicle_id && (
                          <p className="text-xs text-violet-600">✓ Brand / model auto-filled from parent vehicle</p>
                        )}
                      </div>
                    )}

                    <div className={`grid grid-cols-2 gap-3 ${!formData.vehicle_condition ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="space-y-2">
                        <Label>Brand *</Label>
                        <Select
                          value={formData.brand_id}
                          onValueChange={(v) => {
                            const selected = brandOptions.find((b: any) => b.id === v);
                            setFormData((p) => ({ ...p, brand_id: v, brand: selected?.name || p.brand }));
                          }}
                          disabled={formData.vehicle_condition === 'demo' && !!formData.demo_for_vehicle_id}
                        >
                          <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                          <SelectContent>
                            {brandOptions.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Select
                          value={formData.year}
                          onValueChange={(v) => setFormData((p) => ({ ...p, year: v }))}
                          disabled={formData.vehicle_condition === 'demo' && !!formData.demo_for_vehicle_id}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const cy = new Date().getFullYear();
                              const years: number[] = formData.vehicle_condition === 'used'
                                ? Array.from({ length: 21 }, (_, i) => cy - i)
                                : formData.vehicle_condition === 'demo'
                                  ? Array.from({ length: 6 }, (_, i) => cy - i)
                                  : [cy, cy + 1];
                              return years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>);
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Model *</Label>
                      <Input
                        value={formData.model}
                        onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))}
                        disabled={formData.vehicle_condition === 'demo' && !!formData.demo_for_vehicle_id}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Grade</Label>
                        <Input
                          value={formData.grade}
                          onChange={(e) => setFormData((p) => ({ ...p, grade: e.target.value }))}
                          placeholder="e.g. Premium"
                          disabled={formData.vehicle_condition === 'demo' && !!formData.demo_for_vehicle_id}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trim</Label>
                        <Input
                          value={formData.trim}
                          onChange={(e) => setFormData((p) => ({ ...p, trim: e.target.value }))}
                          placeholder="e.g. Sport"
                          disabled={formData.vehicle_condition === 'demo' && !!formData.demo_for_vehicle_id}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Variant / Colour Label</Label>
                      <Input value={formData.variant} onChange={(e) => setFormData((p) => ({ ...p, variant: e.target.value }))} placeholder="e.g. Red Pearl" />
                    </div>
                    {/* For new vehicle: option to also create demo */}
                    {!editingId && formData.vehicle_condition === 'new' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={createDemoForNew} onChange={(e) => setCreateDemoForNew(e.target.checked)} className="rounded" />
                        <span className="text-sm text-muted-foreground">Also create a Demo vehicle for this new car</span>
                      </label>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Step 2: Specs & Availability ── */}
              {formStep === 2 && (
                <Card className="border-2 border-primary">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Powertrain</Label>
                        <Select value={formData.engine_type} onValueChange={(v) => setFormData((p) => ({ ...p, engine_type: v }))}>
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
                          <Label>Set Price (₹)</Label>
                          <Input type="number" min="0" value={formData.set_price} onChange={(e) => setFormData((p) => ({ ...p, set_price: e.target.value }))} placeholder="e.g. 1450000" />
                        </div>
                      )}
                    </div>

                    {formData.vehicle_condition !== 'demo' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Color (Hex)</Label>
                          <Input
                            value={formData.color}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^#([0-9a-fA-F]{0,6})$/.test(val) || val === '') setFormData((p) => ({ ...p, color: val }));
                            }}
                            placeholder="#RRGGBB" maxLength={7}
                          />
                          {formData.color && !/^#([0-9a-fA-F]{6})$/.test(formData.color) && (
                            <p className="text-xs text-destructive">Valid format: #AABBCC</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Vehicle Time (days)</Label>
                          <Input type="number" min="0" value={formData.vehicle_time_days} onChange={(e) => setFormData((p) => ({ ...p, vehicle_time_days: e.target.value }))} placeholder="e.g. 7" />
                        </div>
                      </div>
                    )}

                    {/* Location (non-demo only, demo sets location in step 1) */}
                    {formData.vehicle_condition !== 'demo' && (
                      <div className="space-y-2">
                        <Label>Branch / Showroom *</Label>
                        <Select value={formData.location_id} onValueChange={(v) => setFormData((p) => ({ ...p, location_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                          <SelectContent>
                            {assignableLocations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">This branch will receive the vehicle and track the ship-to-sale journey.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Initial Journey Status</Label>
                      <Select value={formData.workflow_status} onValueChange={(v) => setFormData((p) => ({ ...p, workflow_status: v as VehicleWorkflowStatus }))}>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {(['shipped', 'in_stock', 'sold', 'returned'] as VehicleWorkflowStatus[]).map((status) => (
                            <SelectItem key={status} value={status}>{VEHICLE_WORKFLOW_LABELS[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Total Units</Label>
                        <Input type="number" min="1" value={formData.total_units} onChange={(e) => setFormData((p) => ({ ...p, total_units: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Available Units</Label>
                        <Input type="number" min="0" value={formData.available_units} onChange={(e) => setFormData((p) => ({ ...p, available_units: e.target.value }))} />
                      </div>
                    </div>

                    {/* Shared fleet toggle */}
                    {formData.vehicle_condition === 'demo' && (
                      <div className="space-y-2">
                        {/* Main toggle row */}
                        <div
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.is_shared ? 'border-info/50 bg-info/5' : 'border-border bg-muted/20'
                          }`}
                          onClick={() => setFormData((p) => ({ ...p, is_shared: !p.is_shared, shared_location_ids: [] }))}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              formData.is_shared ? 'bg-info/15' : 'bg-muted'
                            }`}>
                              <Truck className={`h-4 w-4 ${formData.is_shared ? 'text-info' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${formData.is_shared ? 'text-info' : 'text-foreground'}`}>Shared Fleet Vehicle</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formData.is_shared
                                  ? formData.shared_location_ids.length === 0
                                    ? 'Available at all locations'
                                    : `Available at ${formData.shared_location_ids.length} selected location${formData.shared_location_ids.length > 1 ? 's' : ''}`
                                  : 'Available for booking at all locations with transit time shown'}
                              </p>
                            </div>
                          </div>
                          <div className={`h-5 w-9 rounded-full transition-colors flex items-center px-0.5 ${
                            formData.is_shared ? 'bg-info' : 'bg-muted-foreground/30'
                          }`}>
                            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              formData.is_shared ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>

                        {/* Location scope selector (only when shared is on) */}
                        {formData.is_shared && assignableLocations.length > 0 && (
                          <div className="rounded-lg border border-info/20 bg-info/3 p-3 space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Available At</p>
                            {/* "All Locations" pill */}
                            <button
                              type="button"
                              onClick={() => setFormData((p) => ({ ...p, shared_location_ids: [] }))}
                              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
                                formData.shared_location_ids.length === 0
                                  ? 'border-info bg-info/10 text-info font-medium'
                                  : 'border-border text-muted-foreground hover:border-info/40 hover:bg-info/5'
                              }`}
                            >
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                formData.shared_location_ids.length === 0 ? 'border-info bg-info' : 'border-muted-foreground'
                              }`}>
                                {formData.shared_location_ids.length === 0 && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                              All Locations
                              <span className="ml-auto text-[10px] text-muted-foreground">{assignableLocations.length} locations</span>
                            </button>
                            {/* Individual location checkboxes */}
                            {assignableLocations
                              .filter((loc) => loc.id !== formData.location_id) // home location is always implicit
                              .map((loc) => {
                                const checked = formData.shared_location_ids.includes(loc.id);
                                const toggle = () =>
                                  setFormData((p) => ({
                                    ...p,
                                    shared_location_ids: checked
                                      ? p.shared_location_ids.filter((id) => id !== loc.id)
                                      : [...p.shared_location_ids, loc.id],
                                  }));
                                return (
                                  <button
                                    key={loc.id}
                                    type="button"
                                    onClick={toggle}
                                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
                                      checked
                                        ? 'border-info/50 bg-info/8 text-foreground'
                                        : 'border-border text-muted-foreground hover:border-info/30 hover:bg-info/4'
                                    }`}
                                  >
                                    <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      checked ? 'border-info bg-info' : 'border-muted-foreground'
                                    }`}>
                                      {checked && (
                                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8">
                                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="flex-1 truncate">{loc.name}</span>
                                    {loc.city && <span className="text-[10px] text-muted-foreground shrink-0">{loc.city}</span>}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {(formData.vehicle_condition === 'used' || formData.vehicle_condition === 'demo') && (
                      <div className="space-y-2">
                        <Label>VIN / Registration Number</Label>
                        <Input value={formData.registration_number} onChange={(e) => setFormData((p) => ({ ...p, registration_number: e.target.value }))} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input value={formData.image_url} onChange={(e) => setFormData((p) => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 3: Demo setup (optional) ── */}
              {formStep === 3 && showDemoSetupStep && (
                <Card className="border-2 border-violet-400">
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm font-medium text-violet-700">⚡ Demo vehicle details (linked to new car above)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Demo Variant Label</Label>
                        <Input value={demoFormData.variant} onChange={(e) => setDemoFormData((p) => ({ ...p, variant: e.target.value }))} placeholder="Demo" />
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input value={demoFormData.year} onChange={(e) => setDemoFormData((p) => ({ ...p, year: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Color (Hex)</Label>
                        <Input value={demoFormData.color} onChange={(e) => setDemoFormData((p) => ({ ...p, color: e.target.value }))} placeholder="#RRGGBB" />
                      </div>
                      <div className="space-y-2">
                        <Label>VIN / Reg No</Label>
                        <Input value={demoFormData.registration_number} onChange={(e) => setDemoFormData((p) => ({ ...p, registration_number: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Total Units</Label><Input type="number" min="1" value={demoFormData.total_units} onChange={(e) => setDemoFormData((p) => ({ ...p, total_units: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Available Units</Label><Input type="number" min="0" value={demoFormData.available_units} onChange={(e) => setDemoFormData((p) => ({ ...p, available_units: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input value={demoFormData.image_url} onChange={(e) => setDemoFormData((p) => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stepper controls */}
              <div className="flex gap-2">
                {formStep > 1 && <Button variant="outline" onClick={() => setFormStep((s) => Math.max(s - 1, 1))} className="flex-1">Back</Button>}
                {formStep < totalSteps && (
                  <Button onClick={() => setFormStep((s) => Math.min(s + 1, totalSteps))} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    {formStep === 2 && showDemoSetupStep ? 'Configure Demo →' : 'Next →'}
                  </Button>
                )}
                {formStep === totalSteps && (
                  <Button onClick={handleSubmit} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    {editingId ? 'Update Vehicle' : 'Add Vehicle'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!specPromptVehicle} onOpenChange={(open) => { if (!open) handleSkipCompareSpecs(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Update Compare Specs' : 'Add Compare Specs'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">{specPromptVehicle?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {editingId
                    ? 'Review and update the compare specs now so the vehicle stays useful in compare views.'
                    : 'Add key specs now so this vehicle shows richer details on the compare page.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Horsepower</Label>
                  <Input type="number" min="0" value={specDraft.horsepower} onChange={(e) => setSpecDraft((prev) => ({ ...prev, horsepower: e.target.value }))} placeholder="e.g. 150" />
                </div>
                <div className="space-y-2">
                  <Label>Range (km)</Label>
                  <Input type="number" min="0" value={specDraft.range_km} onChange={(e) => setSpecDraft((prev) => ({ ...prev, range_km: e.target.value }))} placeholder="e.g. 420" />
                </div>
                <div className="space-y-2">
                  <Label>Seating Capacity</Label>
                  <Input type="number" min="1" value={specDraft.seating_capacity} onChange={(e) => setSpecDraft((prev) => ({ ...prev, seating_capacity: e.target.value }))} placeholder="e.g. 5" />
                </div>
                <div className="space-y-2">
                  <Label>Fuel Type</Label>
                  <Select value={specDraft.fuel_type} onValueChange={(value) => setSpecDraft((prev) => ({ ...prev, fuel_type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Drive Type</Label>
                  <Select value={specDraft.drive_type} onValueChange={(value) => setSpecDraft((prev) => ({ ...prev, drive_type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drive type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRIVE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transmission</Label>
                  <Select value={specDraft.transmission} onValueChange={(value) => setSpecDraft((prev) => ({ ...prev, transmission: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select transmission" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSMISSION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Torque</Label>
                  <Input value={specDraft.torque} onChange={(e) => setSpecDraft((prev) => ({ ...prev, torque: e.target.value }))} placeholder="e.g. 250 Nm" />
                </div>
                <div className="space-y-2">
                  <Label>0-100 km/h</Label>
                  <Input value={specDraft.acceleration} onChange={(e) => setSpecDraft((prev) => ({ ...prev, acceleration: e.target.value }))} placeholder="e.g. 7.8s" />
                </div>
                <div className="space-y-2">
                  <Label>Top Speed</Label>
                  <Input value={specDraft.top_speed} onChange={(e) => setSpecDraft((prev) => ({ ...prev, top_speed: e.target.value }))} placeholder="e.g. 180 km/h" />
                </div>
                <div className="space-y-2">
                  <Label>Mileage</Label>
                  <Input value={specDraft.mileage} onChange={(e) => setSpecDraft((prev) => ({ ...prev, mileage: e.target.value }))} placeholder="e.g. 18 km/l" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Battery Capacity</Label>
                  <Input value={specDraft.battery_capacity} onChange={(e) => setSpecDraft((prev) => ({ ...prev, battery_capacity: e.target.value }))} placeholder="e.g. 72.6 kWh" />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="outline" className="gap-2" onClick={handleSkipCompareSpecs}>
                  <FilePlus2 className="h-4 w-4" />
                  Extra Info Later
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleSkipCompareSpecs}>
                  <FilePlus2 className="h-4 w-4" />
                  Skip
                </Button>
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void handleSaveCompareSpecs()}>
                  <Save className="h-4 w-4" />
                  {editingId ? 'Update Specs' : 'Save Specs'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Workflow action confirmation */}
        <Dialog open={!!workflowActionTarget} onOpenChange={(open) => { if (!open) setWorkflowActionTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Confirm {workflowActionTarget ? VEHICLE_WORKFLOW_LABELS[workflowActionTarget.nextStatus] : 'Action'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {workflowActionTarget && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Update <span className="font-medium">{workflowActionTarget.vehicle.brand} {workflowActionTarget.vehicle.model}</span>
                    {workflowActionTarget.vehicle.variant ? ` ${workflowActionTarget.vehicle.variant}` : ''} to <span className="font-medium">{VEHICLE_WORKFLOW_LABELS[workflowActionTarget.nextStatus]}</span>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {workflowActionTarget.nextStatus === 'in_stock'
                      ? 'Receive to Branch means adding the entered quantity back into available stock for this branch.'
                      : workflowActionTarget.nextStatus === 'sold'
                        ? 'Mark Sold reduces the current available count by the entered quantity.'
                        : 'Mark Shipped moves the entered quantity out of available stock.'}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={workflowActionQuantity}
                        onChange={(e) => setWorkflowActionQuantity(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Current available: {workflowActionTarget.vehicle.available_units || 0} / {workflowActionTarget.vehicle.total_units || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWorkflowActionTarget(null)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleConfirmWorkflowAction}>
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deactivate confirmation */}
        <AlertDialog open={!!deactivateTarget} onOpenChange={open => { if (!open) setDeactivateTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate Vehicle</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deactivate <strong>{deactivateTarget?.name}</strong>?
                It will be hidden from all booking flows and vehicle lists. You can reactivate it later from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deactivateTarget && handleDeactivate(deactivateTarget.id)}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default VehiclesPage;

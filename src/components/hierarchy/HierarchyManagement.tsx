import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, MapPin, Warehouse, CarFront, Compass } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hierarchyGet, hierarchyPatch, hierarchyPost } from './hierarchyApi';

interface BusinessUnit {
  _id: string;
  name: string;
  code: string;
  businessType: 'BRAND_DEALER' | 'USED_CAR_MARKETPLACE';
  isActive: boolean;
}

interface SalesOffice {
  _id: string;
  name: string;
  salesOfficeCode: string;
  orgId: string;
  businessUnitId: string;
  country: string;
  city: string;
}

interface Plant {
  _id: string;
  name: string;
  plantCode: string;
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  plantType: 'SHOWROOM' | 'STOCKYARD' | 'WORKSHOP' | 'BRANCH';
  country: string;
  city: string;
}

interface LocationNode {
  _id: string;
  name: string;
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  plantId: string;
  locationCode: string;
  locationType: 'SHOWROOM' | 'TEST_DRIVE_AREA' | 'STOCK_AREA' | 'DELIVERY_AREA' | 'SERVICE_AREA';
  address: string;
}

interface Brand {
  _id: string;
  name: string;
  code: string;
}

interface BusinessUnitBrandMapping {
  _id: string;
  brandId: Brand;
  allowedConditions: Array<'NEW' | 'USED'>;
}

interface Vehicle {
  _id: string;
  businessUnitId?: string;
  model: string;
  variant: string;
  year: number;
  color: string;
  condition: 'NEW' | 'USED';
  stockType: 'NEW_STOCK' | 'PRE_OWNED' | 'DEMO' | 'CERTIFIED_PRE_OWNED';
  price: number;
  currency?: string;
  brandId?: Brand | string;
  locationId?: string | null;
  plantId?: string | null;
  salesOfficeId?: string | null;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRefId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    const id = (value as { _id?: unknown })._id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <div>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </div>
      {action}
    </div>
  );
}

export const BusinessUnitManager: React.FC<{
  orgId: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}> = ({ orgId, selectedId, onSelect }) => {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', businessType: 'BRAND_DEALER' as BusinessUnit['businessType'] });
  const { toast } = useToast();

  useEffect(() => {
    if (orgId) void fetchBusinessUnits();
  }, [orgId]);

  const fetchBusinessUnits = async () => {
    try {
      const data = await hierarchyGet<BusinessUnit[]>(`/api/v1/business-units?orgId=${encodeURIComponent(orgId)}`);
      const next = sortByName(data || []);
      setBusinessUnits(next);
      if (!selectedId && next[0]?._id) onSelect?.(next[0]._id);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch business units', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const created = await hierarchyPost<BusinessUnit>('/api/v1/business-units', { ...formData, orgId });
      toast({ title: 'Success', description: 'Business unit created' });
      setIsDialogOpen(false);
      setFormData({ name: '', code: '', businessType: 'BRAND_DEALER' });
      await fetchBusinessUnits();
      if (created?._id) onSelect?.(created._id);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create business unit', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <SectionHeader
          icon={<Building2 className="w-5 h-5" />}
          title="Business Units"
          description="Organize dealerships or marketplaces under the selected organization"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Business Unit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Toyota UAE" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Code</label>
                    <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g., TOYOTA" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <select
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessUnit['businessType'] })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="BRAND_DEALER">BRAND_DEALER</option>
                      <option value="USED_CAR_MARKETPLACE">USED_CAR_MARKETPLACE</option>
                    </select>
                  </div>
                  <Button onClick={handleSave} className="w-full">Create Business Unit</Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {businessUnits.map((unit) => (
            <button
              key={unit._id}
              type="button"
              onClick={() => onSelect?.(unit._id)}
              className={`w-full text-left p-3 border rounded-lg transition ${selectedId === unit._id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40 hover:border-slate-300'}`}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-medium">{unit.name}</p>
                  <p className="text-sm text-muted-foreground">{unit.code}</p>
                </div>
                <Badge variant="outline">{unit.businessType === 'BRAND_DEALER' ? 'Dealer' : 'Marketplace'}</Badge>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const SalesOfficeManager: React.FC<{
  orgId: string;
  businessUnitId: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}> = ({ orgId, businessUnitId, selectedId, onSelect }) => {
  const [salesOffices, setSalesOffices] = useState<SalesOffice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({ name: '', country: 'AE', city: '', externalSalesOfficeId: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (businessUnitId) void fetchSalesOffices();
  }, [businessUnitId]);

  const fetchSalesOffices = async () => {
    try {
      const data = await hierarchyGet<SalesOffice[]>('/api/v1/sales-offices');
      const next = sortByName((data || []).filter((office) => readRefId((office as { businessUnitId?: unknown }).businessUnitId) === businessUnitId));
      setSalesOffices(next);
      if (!selectedId && next[0]?._id) onSelect?.(next[0]._id);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch sales offices', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        orgId,
        businessUnitId,
        externalSalesOfficeId: formData.externalSalesOfficeId || null,
      };

      let saved: SalesOffice;
      if (editingId) {
        saved = await hierarchyPatch<SalesOffice>(`/api/v1/sales-offices/${editingId}`, payload);
        toast({ title: 'Success', description: 'Sales office updated' });
      } else {
        saved = await hierarchyPost<SalesOffice>('/api/v1/sales-offices', payload);
        toast({ title: 'Success', description: 'Sales office created' });
      }

      setIsDialogOpen(false);
      setEditingId('');
      setFormData({ name: '', country: 'AE', city: '', externalSalesOfficeId: '' });
      await fetchSalesOffices();
      if (saved?._id) onSelect?.(saved._id);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save sales office', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <SectionHeader
          icon={<MapPin className="w-5 h-5" />}
          title="Sales Offices"
          description="Regional offices created under the selected business unit"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId('');
                    setFormData({ name: '', country: 'AE', city: '', externalSalesOfficeId: '' });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Sales Office</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Dubai Regional Office" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Country</label>
                      <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })} placeholder="AE" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">City</label>
                      <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Dubai" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">External ID</label>
                    <Input value={formData.externalSalesOfficeId} onChange={(e) => setFormData({ ...formData, externalSalesOfficeId: e.target.value })} placeholder="Optional external office ID" />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingId ? 'Update Sales Office' : 'Create Sales Office'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {salesOffices.map((office) => (
            <div key={office._id} className={`w-full p-3 border rounded-lg transition ${selectedId === office._id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40 hover:border-slate-300'}`}>
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onSelect?.(office._id)} className="text-left flex-1">
                  <p className="font-medium">{office.name}</p>
                  <p className="text-sm text-muted-foreground">{office.city}, {office.country}</p>
                  <p className="text-xs text-muted-foreground mt-1">{office.salesOfficeCode}</p>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(office._id);
                    setFormData({
                      name: office.name,
                      country: office.country,
                      city: office.city,
                      externalSalesOfficeId: '',
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const PlantManager: React.FC<{
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}> = ({ orgId, businessUnitId, salesOfficeId, selectedId, onSelect }) => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({ name: '', plantType: 'SHOWROOM' as Plant['plantType'], country: 'AE', city: '', externalPlantId: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (salesOfficeId) void fetchPlants();
  }, [salesOfficeId]);

  const fetchPlants = async () => {
    try {
      const data = await hierarchyGet<Plant[]>('/api/v1/plants');
      const next = sortByName((data || []).filter((plant) => readRefId((plant as { salesOfficeId?: unknown }).salesOfficeId) === salesOfficeId));
      setPlants(next);
      if (!selectedId && next[0]?._id) onSelect?.(next[0]._id);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch plants', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        orgId,
        businessUnitId,
        salesOfficeId,
        externalPlantId: formData.externalPlantId || null,
      };

      let saved: Plant;
      if (editingId) {
        saved = await hierarchyPatch<Plant>(`/api/v1/plants/${editingId}`, payload);
        toast({ title: 'Success', description: 'Plant updated' });
      } else {
        saved = await hierarchyPost<Plant>('/api/v1/plants', payload);
        toast({ title: 'Success', description: 'Plant created' });
      }

      setIsDialogOpen(false);
      setEditingId('');
      setFormData({ name: '', plantType: 'SHOWROOM', country: 'AE', city: '', externalPlantId: '' });
      await fetchPlants();
      if (saved?._id) onSelect?.(saved._id);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save plant', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <SectionHeader
          icon={<Warehouse className="w-5 h-5" />}
          title="Plants"
          description="Physical facilities under the selected sales office"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId('');
                    setFormData({ name: '', plantType: 'SHOWROOM', country: 'AE', city: '', externalPlantId: '' });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Plant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Sheikh Zayed Showroom" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Plant Type</label>
                    <select value={formData.plantType} onChange={(e) => setFormData({ ...formData, plantType: e.target.value as Plant['plantType'] })} className="w-full px-3 py-2 border rounded">
                      <option value="SHOWROOM">SHOWROOM</option>
                      <option value="STOCKYARD">STOCKYARD</option>
                      <option value="WORKSHOP">WORKSHOP</option>
                      <option value="BRANCH">BRANCH</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Country</label>
                      <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">City</label>
                      <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">External ID</label>
                    <Input value={formData.externalPlantId} onChange={(e) => setFormData({ ...formData, externalPlantId: e.target.value })} placeholder="Optional external plant ID" />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingId ? 'Update Plant' : 'Create Plant'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {plants.map((plant) => (
            <div key={plant._id} className={`w-full p-3 border rounded-lg transition ${selectedId === plant._id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40 hover:border-slate-300'}`}>
              <div className="flex justify-between items-start gap-3">
                <button type="button" onClick={() => onSelect?.(plant._id)} className="text-left flex-1">
                  <p className="font-medium">{plant.name}</p>
                  <p className="text-sm text-muted-foreground">{plant.city}, {plant.country}</p>
                  <p className="text-xs text-muted-foreground mt-1">{plant.plantCode}</p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{plant.plantType}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(plant._id);
                      setFormData({
                        name: plant.name,
                        plantType: plant.plantType,
                        country: plant.country,
                        city: plant.city,
                        externalPlantId: '',
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const LocationManager: React.FC<{
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  plantId: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}> = ({ orgId, businessUnitId, salesOfficeId, plantId, selectedId, onSelect }) => {
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({ name: '', locationType: 'SHOWROOM' as LocationNode['locationType'], address: '', externalLocationId: '', latitude: '', longitude: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (plantId) void fetchLocations();
  }, [plantId]);

  const fetchLocations = async () => {
    try {
      const data = await hierarchyGet<LocationNode[]>('/api/v1/locations');
      const next = sortByName((data || []).filter((location) => readRefId((location as { plantId?: unknown }).plantId) === plantId));
      setLocations(next);
      if (!selectedId && next[0]?._id) onSelect?.(next[0]._id);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch locations', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        orgId,
        businessUnitId,
        salesOfficeId,
        plantId,
        name: formData.name,
        locationType: formData.locationType,
        address: formData.address,
        externalLocationId: formData.externalLocationId || null,
        latitude: toNullableNumber(formData.latitude),
        longitude: toNullableNumber(formData.longitude),
      };

      let saved: LocationNode;
      if (editingId) {
        saved = await hierarchyPatch<LocationNode>(`/api/v1/locations/${editingId}`, payload);
        toast({ title: 'Success', description: 'Location updated' });
      } else {
        saved = await hierarchyPost<LocationNode>('/api/v1/locations', payload);
        toast({ title: 'Success', description: 'Location created' });
      }

      setIsDialogOpen(false);
      setEditingId('');
      setFormData({ name: '', locationType: 'SHOWROOM', address: '', externalLocationId: '', latitude: '', longitude: '' });
      await fetchLocations();
      if (saved?._id) onSelect?.(saved._id);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save location', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <SectionHeader
          icon={<Compass className="w-5 h-5" />}
          title="Locations"
          description="Operational areas inside the selected plant"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId('');
                    setFormData({ name: '', locationType: 'SHOWROOM', address: '', externalLocationId: '', latitude: '', longitude: '' });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Location</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Delivery Bay A" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location Type</label>
                    <select value={formData.locationType} onChange={(e) => setFormData({ ...formData, locationType: e.target.value as LocationNode['locationType'] })} className="w-full px-3 py-2 border rounded">
                      <option value="SHOWROOM">SHOWROOM</option>
                      <option value="TEST_DRIVE_AREA">TEST_DRIVE_AREA</option>
                      <option value="STOCK_AREA">STOCK_AREA</option>
                      <option value="DELIVERY_AREA">DELIVERY_AREA</option>
                      <option value="SERVICE_AREA">SERVICE_AREA</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Latitude</label>
                      <Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="Optional" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Longitude</label>
                      <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="Optional" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">External ID</label>
                    <Input value={formData.externalLocationId} onChange={(e) => setFormData({ ...formData, externalLocationId: e.target.value })} placeholder="Optional external location ID" />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingId ? 'Update Location' : 'Create Location'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {locations.map((location) => (
            <div key={location._id} className={`w-full p-3 border rounded-lg transition ${selectedId === location._id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40 hover:border-slate-300'}`}>
              <div className="flex justify-between items-start gap-3">
                <button type="button" onClick={() => onSelect?.(location._id)} className="text-left flex-1">
                  <p className="font-medium">{location.name}</p>
                  <p className="text-sm text-muted-foreground">{location.address}</p>
                  <p className="text-xs text-muted-foreground mt-1">{location.locationCode}</p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{location.locationType}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(location._id);
                      setFormData({
                        name: location.name,
                        locationType: location.locationType,
                        address: location.address,
                        externalLocationId: '',
                        latitude: '',
                        longitude: '',
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const VehicleManager: React.FC<{
  orgId: string;
  businessUnitId: string;
  salesOfficeId?: string;
  plantId?: string;
  locationId?: string;
}> = ({ orgId, businessUnitId, salesOfficeId, plantId, locationId }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brandMappings, setBrandMappings] = useState<BusinessUnitBrandMapping[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ brandId: '', model: '', variant: '', year: String(new Date().getFullYear()), color: '', condition: 'NEW' as Vehicle['condition'], stockType: 'NEW_STOCK' as Vehicle['stockType'], price: '', currency: 'AED', vin: '', stockNumber: '', mileage: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (businessUnitId) {
      void fetchVehicles();
      void fetchBusinessUnitBrands();
    }
  }, [businessUnitId, salesOfficeId, plantId, locationId]);

  const fetchVehicles = async () => {
    try {
      const data = await hierarchyGet<Vehicle[]>('/api/v1/vehicles');
      const filtered = (data || []).filter((vehicle) => {
        if ((vehicle.businessUnitId || '') !== businessUnitId) return false;
        if (locationId) return String(vehicle.locationId || '') === locationId;
        if (plantId) return String(vehicle.plantId || '') === plantId;
        if (salesOfficeId) return String(vehicle.salesOfficeId || '') === salesOfficeId;
        return true;
      });
      setVehicles(filtered);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch vehicles', variant: 'destructive' });
    }
  };

  const fetchBusinessUnitBrands = async () => {
    try {
      const mappings = await hierarchyGet<BusinessUnitBrandMapping[]>(`/api/v1/business-unit-brands?businessUnitId=${encodeURIComponent(businessUnitId)}`);
      setBrandMappings(mappings || []);
      if (!formData.brandId && mappings?.[0]?.brandId?._id) {
        setFormData((prev) => ({ ...prev, brandId: mappings[0].brandId._id }));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch available brands', variant: 'destructive' });
    }
  };

  const selectedBrandMapping = brandMappings.find((mapping) => mapping.brandId?._id === formData.brandId);
  const allowedConditions = selectedBrandMapping?.allowedConditions || ['NEW', 'USED'];

  const handleSave = async () => {
    try {
      await hierarchyPost<Vehicle>('/api/v1/vehicles', {
        orgId,
        businessUnitId,
        brandId: formData.brandId,
        model: formData.model,
        variant: formData.variant,
        year: Number(formData.year),
        color: formData.color,
        condition: formData.condition,
        stockType: formData.stockType,
        price: Number(formData.price),
        currency: formData.currency,
        vin: formData.vin || null,
        stockNumber: formData.stockNumber || null,
        mileage: toNullableNumber(formData.mileage),
        salesOfficeId: salesOfficeId || null,
        plantId: plantId || null,
        locationId: locationId || null,
      });
      toast({ title: 'Success', description: 'Vehicle created' });
      setIsDialogOpen(false);
      setFormData({ brandId: brandMappings[0]?.brandId?._id || '', model: '', variant: '', year: String(new Date().getFullYear()), color: '', condition: 'NEW', stockType: 'NEW_STOCK', price: '', currency: 'AED', vin: '', stockNumber: '', mileage: '' });
      await fetchVehicles();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create vehicle', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <SectionHeader
          icon={<CarFront className="w-5 h-5" />}
          title="Vehicles"
          description="Add inventory under the current business-unit and location context"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={brandMappings.length === 0}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Vehicle</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Brand</label>
                    <select value={formData.brandId} onChange={(e) => setFormData({ ...formData, brandId: e.target.value })} className="w-full px-3 py-2 border rounded">
                      {brandMappings.map((mapping) => (
                        <option key={mapping._id} value={mapping.brandId._id}>{mapping.brandId.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Model</label>
                    <Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="e.g., Land Cruiser" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Variant</label>
                    <Input value={formData.variant} onChange={(e) => setFormData({ ...formData, variant: e.target.value })} placeholder="e.g., VX.R" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Year</label>
                    <Input value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} placeholder="2026" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Color</label>
                    <Input value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} placeholder="White" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Condition</label>
                    <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as Vehicle['condition'] })} className="w-full px-3 py-2 border rounded">
                      {allowedConditions.map((condition) => (
                        <option key={condition} value={condition}>{condition}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Stock Type</label>
                    <select value={formData.stockType} onChange={(e) => setFormData({ ...formData, stockType: e.target.value as Vehicle['stockType'] })} className="w-full px-3 py-2 border rounded">
                      <option value="NEW_STOCK">NEW_STOCK</option>
                      <option value="PRE_OWNED">PRE_OWNED</option>
                      <option value="DEMO">DEMO</option>
                      <option value="CERTIFIED_PRE_OWNED">CERTIFIED_PRE_OWNED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price</label>
                    <Input value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="250000" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Currency</label>
                    <Input value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })} placeholder="AED" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">VIN</label>
                    <Input value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Stock Number</label>
                    <Input value={formData.stockNumber} onChange={(e) => setFormData({ ...formData, stockNumber: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Mileage</label>
                    <Input value={formData.mileage} onChange={(e) => setFormData({ ...formData, mileage: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Create Vehicle</Button>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-4">
        {brandMappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No business-unit brand mappings found. Map at least one brand to this business unit before creating vehicles.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {vehicles.map((vehicle) => {
              const brand = typeof vehicle.brandId === 'object' && vehicle.brandId ? vehicle.brandId.name : 'Brand';
              return (
                <div key={vehicle._id} className="p-3 border rounded-lg hover:border-slate-300 transition">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium">{brand} {vehicle.model} {vehicle.variant}</p>
                      <p className="text-sm text-muted-foreground">{vehicle.year} • {vehicle.color} • {vehicle.condition}</p>
                    </div>
                    <Badge variant="outline">{vehicle.stockType}</Badge>
                  </div>
                  <p className="text-sm mt-2">{vehicle.currency || 'AED'} {vehicle.price?.toLocaleString?.() || vehicle.price}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
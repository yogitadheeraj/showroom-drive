import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, X, Plus, ArrowLeft, ArrowRight, Gauge, Zap, Battery, Fuel, Users, Timer, ArrowUpRight } from 'lucide-react';

const MAX_COMPARE = 4;

const specFields = [
  { key: 'engine_type', label: 'Engine Type', icon: Zap },
  { key: 'horsepower', label: 'Power', icon: Gauge, format: (v: any) => v ? `${v} HP` : '—' },
  { key: 'torque', label: 'Torque', icon: ArrowUpRight },
  { key: 'acceleration', label: '0-100 km/h', icon: Timer },
  { key: 'top_speed', label: 'Top Speed', icon: Zap },
  { key: 'transmission', label: 'Transmission', icon: Car },
  { key: 'drive_type', label: 'Drive Type', icon: Car },
  { key: 'fuel_type', label: 'Fuel Type', icon: Fuel },
  { key: 'mileage', label: 'Mileage', icon: Fuel },
  { key: 'range_km', label: 'Range', icon: Battery, format: (v: any) => v ? `${v} km` : '—' },
  { key: 'battery_capacity', label: 'Battery', icon: Battery },
  { key: 'seating_capacity', label: 'Seats', icon: Users, format: (v: any) => v ? `${v} Seater` : '—' },
  { key: 'total_units', label: 'Total Units', icon: Car },
  { key: 'available_units', label: 'Available Units', icon: Car },
];

const ComparePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('vehicles').select('*, locations(name)').eq('is_active', true).order('brand').then(({ data }) => {
      setAllVehicles(data || []);
    });
  }, []);

  // Initialize from URL params
  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) setSelectedIds(ids.split(',').slice(0, MAX_COMPARE));
  }, [searchParams]);

  const selectedVehicles = useMemo(() =>
    selectedIds.map(id => allVehicles.find(v => v.id === id)).filter(Boolean),
    [selectedIds, allVehicles]
  );

  const availableToAdd = useMemo(() =>
    allVehicles.filter(v => !selectedIds.includes(v.id)),
    [allVehicles, selectedIds]
  );

  const addVehicle = (id: string) => {
    if (selectedIds.length < MAX_COMPARE) setSelectedIds(prev => [...prev, id]);
  };

  const removeVehicle = (id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-dark py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/book" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Booking</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-heading font-bold text-primary-foreground">Compare Vehicles</h1>
          </div>
          <Link to="/" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Home</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Vehicle selector */}
        <div className="mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Add vehicle to compare ({selectedIds.length}/{MAX_COMPARE}):</span>
            {selectedIds.length < MAX_COMPARE && (
              <Select onValueChange={addVehicle}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.variant || ''} ({v.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedVehicles.length === 0 ? (
          <div className="text-center py-20">
            <Car className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-heading font-bold text-foreground mb-2">No Vehicles Selected</h2>
            <p className="text-muted-foreground mb-6">Add up to {MAX_COMPARE} vehicles to compare specs side by side.</p>
            <Link to="/book">
              <Button className="gradient-primary border-0 text-primary-foreground">
                Browse Vehicles <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Vehicle headers */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-3 min-w-[140px] text-sm font-medium text-muted-foreground">Specification</th>
                    {selectedVehicles.map((v: any) => (
                      <th key={v.id} className="p-3 min-w-[200px]">
                        <Card className="shadow-card">
                          <CardContent className="p-4 relative">
                            <button
                              onClick={() => removeVehicle(v.id)}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                            {v.image_url && (
                              <img src={v.image_url} alt={`${v.brand} ${v.model}`} className="w-full h-28 object-cover rounded-lg mb-3" />
                            )}
                            <h3 className="font-heading font-bold text-foreground">{v.brand} {v.model}</h3>
                            <p className="text-xs text-muted-foreground">{v.variant || ''} · {v.year}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className={v.engine_type === 'electric' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                                {v.engine_type === 'electric' ? '⚡ EV' : v.engine_type || 'Petrol'}
                              </Badge>
                              <Badge variant="secondary" className={v.available_units > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                                {v.available_units > 0 ? `${v.available_units} available` : 'Booked'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">📍 {v.locations?.name}</p>
                            {v.available_units > 0 && (
                              <Link to={`/book?vehicleId=${v.id}`}>
                                <Button size="sm" className="w-full mt-3 gradient-primary border-0 text-primary-foreground text-xs">
                                  Book Test Drive
                                </Button>
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      </th>
                    ))}
                    {selectedVehicles.length < MAX_COMPARE && (
                      <th className="p-3 min-w-[200px]">
                        <div className="border-2 border-dashed border-border rounded-xl h-48 flex flex-col items-center justify-center text-muted-foreground">
                          <Plus className="h-8 w-8 mb-2" />
                          <span className="text-sm">Add Vehicle</span>
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {specFields.map(spec => {
                    const hasValue = selectedVehicles.some((v: any) => v[spec.key] != null && v[spec.key] !== '');
                    if (!hasValue) return null;
                    const Icon = spec.icon;
                    return (
                      <tr key={spec.key} className="border-t border-border/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{spec.label}</span>
                          </div>
                        </td>
                        {selectedVehicles.map((v: any) => {
                          const val = v[spec.key];
                          const display = spec.format ? spec.format(val) : (val || '—');
                          // Highlight best value
                          const isNumeric = spec.key === 'horsepower' || spec.key === 'range_km' || spec.key === 'seating_capacity' || spec.key === 'available_units';
                          const allNums = selectedVehicles.map((sv: any) => Number(sv[spec.key]) || 0);
                          const maxNum = Math.max(...allNums);
                          const isBest = isNumeric && Number(val) === maxNum && maxNum > 0;
                          return (
                            <td key={v.id} className="p-3 text-center">
                              <span className={`text-sm ${isBest ? 'font-bold text-success' : 'text-foreground'}`}>
                                {display}
                              </span>
                            </td>
                          );
                        })}
                        {selectedVehicles.length < MAX_COMPARE && <td className="p-3" />}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComparePage;

import { Badge } from '@/components/ui/badge';
import { Car, Gauge, Fuel, Users, ArrowRight, Battery, Timer, ArrowUpRight, Zap } from 'lucide-react';

const SpecItem = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className={`flex items-start gap-2 p-2.5 rounded-lg ${highlight ? 'bg-success/5 border border-success/15' : 'bg-muted/50'}`}>
    <div className={`mt-0.5 ${highlight ? 'text-success' : 'text-muted-foreground'}`}>{icon}</div>
    <div>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-medium leading-tight ${highlight ? 'text-success' : 'text-foreground'}`}>{value}</p>
    </div>
  </div>
);

const VehicleSpecCard = ({ vehicle }: { vehicle: any }) => {
  if (!vehicle) return null;
  const isEV = vehicle.engine_type === 'electric';
  const isHybrid = vehicle.engine_type === 'hybrid';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-heading font-bold text-foreground text-lg">{vehicle.brand} {vehicle.model}</h4>
          <p className="text-sm text-muted-foreground">{vehicle.variant} · {vehicle.year}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{vehicle.is_demo ? 'Demo' : vehicle.is_used ? 'Used' : 'New'}</Badge>
            {!vehicle.is_demo && vehicle.set_price != null && (
              <Badge variant="secondary" className="text-[10px]">Rs {Number(vehicle.set_price).toLocaleString()}</Badge>
            )}
            {!vehicle.is_demo && vehicle.vehicle_time_days != null && (
              <Badge variant="secondary" className="text-[10px]">{vehicle.vehicle_time_days} day(s)</Badge>
            )}
          </div>
        </div>
        <Badge className={
          isEV ? 'bg-success/10 text-success border-success/20' :
          isHybrid ? 'bg-info/10 text-info border-info/20' :
          'bg-muted text-muted-foreground'
        }>
          {isEV ? '⚡ Electric' : isHybrid ? '🔄 Hybrid' : vehicle.fuel_type || 'Petrol'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {vehicle.horsepower && <SpecItem icon={<Gauge className="h-4 w-4" />} label="Power" value={`${vehicle.horsepower} HP`} />}
        {vehicle.torque && <SpecItem icon={<ArrowUpRight className="h-4 w-4" />} label="Torque" value={vehicle.torque} />}
        {vehicle.acceleration && <SpecItem icon={<Timer className="h-4 w-4" />} label="0-100 km/h" value={vehicle.acceleration} />}
        {vehicle.top_speed && <SpecItem icon={<Zap className="h-4 w-4" />} label="Top Speed" value={vehicle.top_speed} />}
        {isEV && vehicle.range_km && <SpecItem icon={<Battery className="h-4 w-4" />} label="Range" value={`${vehicle.range_km} km`} highlight />}
        {isEV && vehicle.battery_capacity && <SpecItem icon={<Fuel className="h-4 w-4" />} label="Battery" value={vehicle.battery_capacity} />}
        {!isEV && vehicle.mileage && <SpecItem icon={<Fuel className="h-4 w-4" />} label="Mileage" value={vehicle.mileage} />}
        {vehicle.transmission && <SpecItem icon={<ArrowRight className="h-4 w-4" />} label="Transmission" value={vehicle.transmission} />}
        {vehicle.seating_capacity && <SpecItem icon={<Users className="h-4 w-4" />} label="Seats" value={`${vehicle.seating_capacity} Seater`} />}
        {vehicle.drive_type && <SpecItem icon={<Car className="h-4 w-4" />} label="Drive" value={vehicle.drive_type} />}
      </div>
      {vehicle.color && (
        <p className="text-xs text-muted-foreground">Color: <span className="font-medium text-foreground">{vehicle.color}</span></p>
      )}
    </div>
  );
};

export default VehicleSpecCard;

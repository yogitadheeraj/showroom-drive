import DashboardLayout from '@/components/DashboardLayout';
import IncomingVehiclesPanel from '@/components/IncomingVehiclesPanel';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { Truck } from 'lucide-react';

export default function IncomingVehiclesPage() {
  const { profile, role } = useAuth();

  // Security staff can interact; all other roles are read-only
  const isSecurityRole = role === APP_ROLE.SECURITY;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Incoming Vehicles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSecurityRole
              ? 'Vehicles in transit to your location. Mark them as received when they arrive.'
              : 'Read-only view of shared vehicles in transit to your location.'}
          </p>
        </div>

        {profile?.location_id && profile?.id ? (
          <IncomingVehiclesPanel
            locationId={profile.location_id}
            profileId={profile.id}
            readOnly={!isSecurityRole}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No location assigned to your profile. Contact your admin.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}

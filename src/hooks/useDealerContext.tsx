import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiGet } from '@/lib/apiClient';

export const SELECTED_LOCATION_KEY = 'hierarchy_selected_location_id';

export interface HierarchyEntity {
  id: string;
  name: string;
  type: 'organization' | 'business_unit' | 'sales_office' | 'plant' | 'location';
}

export interface DealerLocation {
  id: string;
  name: string;
  city: string | null;
}

interface DealerContextValue {
  // Legacy interface names maintained for backward compatibility
  dealerId: string | null; // Now organizationId
  dealerName: string | null; // Now organizationName
  dealerLogoUrl: string | null; // Now organizationLogoUrl
  dealerLocations: DealerLocation[];
  allDealerLocationIds: string[] | null;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  dealerLocationIds: string[] | null;
  loading: boolean;
  // New hierarchy context
  organizationId: string | null;
  organizationName: string | null;
  businessUnitId: string | null;
  locationId: string | null;
}

const DealerCtx = createContext<DealerContextValue>({
  dealerId: null,
  dealerName: null,
  dealerLogoUrl: null,
  dealerLocations: [],
  allDealerLocationIds: null,
  selectedLocationId: null,
  setSelectedLocationId: () => {},
  dealerLocationIds: null,
  loading: true,
  organizationId: null,
  organizationName: null,
  businessUnitId: null,
  locationId: null,
});

export function DealerContextProvider({ children }: { children: ReactNode }) {
  const { user, role, profile } = useAuth();
  
  // Organization hierarchy
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [businessUnitId, setBusinessUnitId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  
  // Locations list for current organization/scope
  const [dealerLocations, setDealerLocations] = useState<DealerLocation[]>([]);
  const [allDealerLocationIds, setAllDealerLocationIds] = useState<string[] | null>(null);
  
  const [selectedLocationId, setSelectedLocationIdRaw] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_LOCATION_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const setSelectedLocationId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(SELECTED_LOCATION_KEY, id);
      } else {
        localStorage.removeItem(SELECTED_LOCATION_KEY);
      }
    } catch {
      /* storage unavailable */
    }
    setSelectedLocationIdRaw(id);
  }, []);

  // Initialize organizational hierarchy context
  useEffect(() => {
    // Clear context for superadmin or unauthorized users
    if (!user || role === APP_ROLE.SUPERADMIN) {
      setOrganizationId(null);
      setOrganizationName(null);
      setBusinessUnitId(null);
      setLocationId(null);
      setDealerLocations([]);
      setAllDealerLocationIds(null);
      setSelectedLocationId(null);
      setLoading(false);
      return;
    }

    // Wait for profile to load
    if (role === undefined || profile === undefined) {
      return;
    }
debugger;
    const initializeHierarchyContext = async () => {
      setLoading(true);

      try {
        const userLocationId = profile?.location_id;
        if (!userLocationId) {
          throw new Error('User profile has no location assigned');
        }

        // Step 1: Fetch user's location to resolve hierarchy
        const userLocation = await apiGet<any>(`/api/v1/locations/${userLocationId}`);
        if (!userLocation) {
          throw new Error('Location not found');
        }

        const resolvedOrgId = String(
          userLocation.organization_id ||
          userLocation.orgId?._id ||
          userLocation.orgId ||
          ''
        ) || null;
        if (!resolvedOrgId) {
          throw new Error('Location has no organization assignment');
        }

        setOrganizationId(resolvedOrgId);
        setBusinessUnitId(
          String(
            userLocation.business_unit_id ||
            userLocation.businessUnitId?._id ||
            userLocation.businessUnitId ||
            ''
          ) || null
        );
        setLocationId(userLocationId);

        // Step 2: Fetch organization info and locations scoped to user's hierarchy in parallel
        const [orgInfo, locationsData] = await Promise.all([
          apiGet<any>(`/api/v1/organizations/${resolvedOrgId}`).catch(() => null),
          apiGet<any[]>(`/api/v1/locations?orgId=${resolvedOrgId}&is_active=true`).catch(() => []),
        ]);

        // Set organization metadata
        setOrganizationName(orgInfo?.name ?? null);

        // Transform and set locations
        const transformedLocations: DealerLocation[] = (locationsData ?? [])
          .map((loc: any) => ({
            id: String(loc.id || loc._id || ''),
            name: loc.name ?? String(loc.id || loc._id || ''),
            city: loc.city ?? null,
          }))
          .filter((loc: DealerLocation) => Boolean(loc.id));

        setDealerLocations(transformedLocations);
        const locationIds = transformedLocations.map((l) => l.id);
        setAllDealerLocationIds(locationIds);

        // Step 3: Validate and restore selected location from localStorage
        setSelectedLocationIdRaw((prevSelected) => {
          const isValidSelection = prevSelected && locationIds.includes(prevSelected);
          const nextSelected = isValidSelection ? prevSelected : null;

          // Sync with localStorage
          if (nextSelected !== prevSelected) {
            try {
              if (nextSelected) {
                localStorage.setItem(SELECTED_LOCATION_KEY, nextSelected);
              } else {
                localStorage.removeItem(SELECTED_LOCATION_KEY);
              }
            } catch {
              /* ignore storage errors */
            }
          }

          return nextSelected;
        });
      } catch (error) {
        // Gracefully degrade on error — context remains null/empty
        setOrganizationId(null);
        setOrganizationName(null);
        setBusinessUnitId(null);
        setLocationId(null);
        setDealerLocations([]);
        setAllDealerLocationIds(null);
      } finally {
        setLoading(false);
      }
    };

    void initializeHierarchyContext();
  }, [user, role, profile, setSelectedLocationId]);

  // Compute effective location IDs for queries
  const dealerLocationIds = useMemo(
    () => (selectedLocationId ? [selectedLocationId] : allDealerLocationIds),
    [selectedLocationId, allDealerLocationIds]
  );

  // Legacy interface support: map new hierarchy to old names
  return (
    <DealerCtx.Provider
      value={{
        // Legacy names (for backward compatibility with consumers)
        dealerId: organizationId,
        dealerName: organizationName,
        dealerLogoUrl: null, // Organizations might not have logos like dealers did
        dealerLocations,
        allDealerLocationIds,
        selectedLocationId,
        setSelectedLocationId,
        dealerLocationIds,
        loading,
        // New hierarchy context (preferred for new code)
        organizationId,
        organizationName,
        businessUnitId,
        locationId,
      }}
    >
      {children}
    </DealerCtx.Provider>
  );
}

export const useDealerContext = (): DealerContextValue => useContext(DealerCtx);

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { demoAutofillData } from '@/lib/demoAutofillData';
import { apiGet, apiPost, apiPatch, apiInvokeFunction } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingState from '@/components/common/LoadingState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { UserPlus, Pencil, MapPin, Mail, Shield, Lock, Unlock, Trash2, MoreHorizontal, PlaneTakeoff, PlaneLanding, Eye, EyeOff, Check, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE, DEFAULT_APP_ROLE, STAFF_ROLE_OPTIONS, DEALER_ASSIGNABLE_ROLES, type AppRole } from '@/constants/roles';
import { getAppRoleBadgeClass, getAppRoleLabel } from '@/lib/roles';

type BrandMultiSelectProps = {
  brands: { id: string; name: string }[];
  selectedBrandIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

type LocationOption = {
  id: string;
  name: string;
  dealer_id?: string | null;
  brandId?: string | null;
  brand_id?: string | null;
  brand_ids?: string[] | null;
};

const getLocationBrandIds = (location: LocationOption) => {
  const brandIds = new Set<string>();

  if (location.brandId) brandIds.add(location.brandId);
  if (location.brand_id) brandIds.add(location.brand_id);
  if (Array.isArray(location.brand_ids)) {
    location.brand_ids.filter(Boolean).forEach((brandId) => brandIds.add(brandId));
  }

  return Array.from(brandIds);
};

const filterLocationsByBrandIds = (locations: LocationOption[], selectedBrandIds: string[]) => {
  if (selectedBrandIds.length === 0) return locations;

  const filtered = locations.filter((location) =>
    getLocationBrandIds(location).some((brandId) => selectedBrandIds.includes(brandId))
  );

  return filtered.length > 0 ? filtered : locations;
};

const BrandMultiSelect = ({ brands, selectedBrandIds, onChange, disabled = false, placeholder = 'Select brands' }: BrandMultiSelectProps) => {
  const selectedBrands = brands.filter((brand) => selectedBrandIds.includes(brand.id));

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between" disabled={disabled}>
            <span className="truncate">{selectedBrands.length > 0 ? `${selectedBrands.length} selected` : placeholder}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {brands.map((brand) => {
            const checked = selectedBrandIds.includes(brand.id);
            return (
              <DropdownMenuItem
                key={brand.id}
                onSelect={(event) => {
                  event.preventDefault();
                  const next = checked
                    ? selectedBrandIds.filter((id) => id !== brand.id)
                    : Array.from(new Set([...selectedBrandIds, brand.id]));
                  onChange(next);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                  <span>{brand.name}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedBrands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedBrands.map((brand) => (
            <span key={brand.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {brand.name}
              <button
                type="button"
                onClick={() => onChange(selectedBrandIds.filter((id) => id !== brand.id))}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const UsersPage = () => {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<any[]>([]);
  const [verificationByUserId, setVerificationByUserId] = useState<Record<string, boolean>>({});
  const [resendingVerificationByUserId, setResendingVerificationByUserId] = useState<Record<string, boolean>>({});
  const [staffDriveMetrics, setStaffDriveMetrics] = useState<Record<string, { assigned: number; active: number; completed: number }>>({});
  const [dealers, setDealers] = useState<any[]>([]);
  const [selectedDealerFilter, setSelectedDealerFilter] = useState<string>(searchParams.get('dealer_id') || 'all');
  // Search + filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'all');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || 'all');
  
  useEffect(() => {
    setSelectedDealerFilter(searchParams.get('dealer_id') || 'all');
    setRoleFilter(searchParams.get('role') || 'all');
    setLocationFilter(searchParams.get('location') || 'all');
  }, [searchParams]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '', brandId: '', can_use_demo_data: false });
  const [createFormBrandIds, setCreateFormBrandIds] = useState<string[]>([]);
  const [editFormBrandIds, setEditFormBrandIds] = useState<string[]>([]);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [editForm, setEditForm] = useState({ role: '', locationId: '' });
  const [saving, setSaving] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState<{ user: any } | null>(null);
  const todayIso = new Date().toISOString().split('T')[0];
  const [leaveForm, setLeaveForm] = useState({ startDate: todayIso, endDate: todayIso });
  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'delete' | 'toggle-block';
    user: any;
  }>(null);
  const { toast } = useToast();
  const { user, role, profile } = useAuth();
  const { dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const isDealerAdmin = role === APP_ROLE.DEALER_ADMIN;
  const isSalesAdmin = role === APP_ROLE.SALES_ADMIN;
  const canManageStaff = isSuperAdmin || isDealerAdmin || isSalesAdmin;
  const canBlockDeleteStaff = isSuperAdmin || isDealerAdmin;
  const assignableRolesForCurrentUser = isSuperAdmin
    ? STAFF_ROLE_OPTIONS
    : isDealerAdmin
      ? DEALER_ASSIGNABLE_ROLES
      : [{ value: APP_ROLE.SALES, label: 'Sales Person' }] as const;

  const getPrimaryRole = (u: any) => u?.user_roles?.[0]?.role as AppRole | undefined;
  const canEditTargetUser = (u: any) => {
    if (!canManageStaff) return false;
    if (u?.user_id === user?.id) return false;
    if (isSalesAdmin) return getPrimaryRole(u) === APP_ROLE.SALES;
    return true;
  };

  const isUserActive = (u: any) => u?.is_active !== false;

  useEffect(() => {
    if (!dealerLoading) {
      if (isSuperAdmin) {
        apiGet<any[]>('/api/dealers?is_active=true').then((data) => setDealers(data || []));
      }
      // Auto-clear expired leaves before loading users
      apiPost('/api/profiles/clear-expired-leaves', {}).catch(() => null);
      fetchUsers();
      const locationParams = new URLSearchParams();
      if (isSuperAdmin && selectedDealerFilter !== 'all') {
        locationParams.set('dealer_id', selectedDealerFilter);
      } else if (isSalesAdmin && profile?.location_id) {
        locationParams.set('ids', profile.location_id);
      } else if (!isSuperAdmin && dealerId) {
        locationParams.set('dealer_id', dealerId);
      } else if (!isSuperAdmin) {
        // No dealer scope resolved — keep dropdowns empty to avoid leaking cross-dealer data
        setLocations([]);
        setBrands([]);
      }
      if (isSuperAdmin || dealerId || (isSalesAdmin && profile?.location_id)) {
        apiGet<any[]>(`/api/locations?${locationParams}`).then((data) => setLocations(data || []));
        // Load brands within the same scope
        const brandParams = new URLSearchParams();
        if (isSuperAdmin && selectedDealerFilter !== 'all') brandParams.set('dealer_id', selectedDealerFilter);
        else if (!isSuperAdmin && dealerId) brandParams.set('dealer_id', dealerId);
        apiGet<any[]>(`/api/brands?${brandParams}`).then((data) => setBrands((data || []).map((b: any) => ({ id: b.id, name: b.name }))));
      }
    }
  }, [dealerId, dealerLoading, isSuperAdmin, isSalesAdmin, profile?.location_id, selectedDealerFilter]);

  // Auto-select brand when only one option is available
  useEffect(() => {
    if (brands.length !== 1) return;
    if (showCreateDialog && createFormBrandIds.length === 0) {
      setCreateFormBrandIds([brands[0].id]);
      setCreateForm(p => ({ ...p, brandId: brands[0].id }));
    }
    if (editingUser && editFormBrandIds.length === 0) {
      setEditFormBrandIds([brands[0].id]);
    }
  }, [brands, showCreateDialog, editingUser, createFormBrandIds.length, editFormBrandIds.length]);

  // Auto-select location in create dialog when filtered list has exactly one option
  useEffect(() => {
    if (!showCreateDialog) return;
    const selectedBrandIds = createFormBrandIds.filter(Boolean);
    const available = filterLocationsByBrandIds(locations, selectedBrandIds);
    if (available.length === 1 && !createForm.locationId) {
      setCreateForm(p => ({ ...p, locationId: available[0].id }));
    }
    if (createForm.locationId && !available.some((location) => location.id === createForm.locationId)) {
      setCreateForm(p => ({ ...p, locationId: '' }));
    }
  }, [showCreateDialog, createFormBrandIds, locations, createForm.locationId]);

  // Auto-select location in edit dialog when filtered list has exactly one option
  useEffect(() => {
    if (!editingUser) return;
    const selectedBrandIds = editFormBrandIds.filter(Boolean);
    const available = filterLocationsByBrandIds(locations, selectedBrandIds);
    if (available.length === 1 && !editForm.locationId) {
      setEditForm(p => ({ ...p, locationId: available[0].id }));
    }
    if (editForm.locationId && !available.some((location) => location.id === editForm.locationId)) {
      setEditForm(p => ({ ...p, locationId: '' }));
    }
  }, [editingUser, editFormBrandIds, locations, editForm.locationId]);

  const fetchUsers = async () => {
    const profileParams = new URLSearchParams();
    if (isSuperAdmin && selectedDealerFilter !== 'all') {
      profileParams.set('dealer_id', selectedDealerFilter);
    }

    const profiles = await apiGet<any[]>(`/api/profiles${profileParams.toString() ? `?${profileParams}` : ''}`);
    const profileUserIds = (profiles || []).map((p) => p.user_id).filter(Boolean);
    const roleParams = new URLSearchParams();
    if (profileUserIds.length > 0) roleParams.set('user_ids', profileUserIds.join(','));
    const roles = profileUserIds.length > 0
      ? await apiGet<any[]>(`/api/user-roles?${roleParams.toString()}`)
      : [];

    const merged = (profiles || [])
      .map(p => ({
        ...p,
        user_roles: (roles || []).filter(r => r.user_id === p.user_id),
      }));
    setUsers(merged);

    const userIds = merged.map((u) => u.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const verificationData = await apiInvokeFunction<any>('staff-verification-status', { userIds });
      setVerificationByUserId((verificationData as any)?.statusByUserId || {});
    } else {
      setVerificationByUserId({});
    }

    const visibleLocationIds = Array.from(new Set(merged.map((p) => p.location_id).filter(Boolean)));
    if (visibleLocationIds.length === 0) {
      setStaffDriveMetrics({});
      return;
    }

    const drives = await apiGet<any[]>(`/api/test-drives?location_ids=${encodeURIComponent(visibleLocationIds.join(','))}&include_related=false&limit=5000`);

    const metrics: Record<string, { assigned: number; active: number; completed: number }> = {};
    const ensure = (profileId: string) => {
      if (!metrics[profileId]) metrics[profileId] = { assigned: 0, active: 0, completed: 0 };
    };

    (drives || []).forEach((drive: any) => {
      const linkedProfiles = [drive.assigned_sales_person_id, drive.assigned_gro_id].filter(Boolean) as string[];
      linkedProfiles.forEach((profileId) => {
        ensure(profileId);
        metrics[profileId].assigned += 1;
        if (drive.status === 'completed') metrics[profileId].completed += 1;
        if (['scheduled', 'confirmed', 'show', 'in_progress', 'key_handover_to_sales'].includes(drive.status)) {
          metrics[profileId].active += 1;
        }
      });
    });

    setStaffDriveMetrics(metrics);
  };

  const handleResendVerificationForUser = async (u: any) => {
    if (!u?.user_id) return;
    setResendingVerificationByUserId((prev) => ({ ...prev, [u.user_id]: true }));
    try {
      const data = await apiInvokeFunction<any>('resend-staff-verification', { userId: u.user_id });
      if ((data as any)?.error) throw new Error((data as any).error as string);

      if ((data as any)?.alreadyVerified) {
        toast({ title: 'Already verified', description: `${u.full_name} has already verified email.` });
      } else if ((data as any)?.sent) {
        toast({ title: 'Verification sent', description: `Verification email sent to ${u.email}.` });
      } else {
        toast({
          title: 'Email skipped',
          description: 'SMTP not configured. Share the verification link from API response/logs.',
          variant: 'destructive',
        });
      }

      await fetchUsers();
    } catch (err: any) {
      toast({ title: 'Resend failed', description: err?.message || 'Unable to resend verification', variant: 'destructive' });
    } finally {
      setResendingVerificationByUserId((prev) => ({ ...prev, [u.user_id]: false }));
    }
  };

  const getStaffDriveMetrics = (profileId: string) =>
    staffDriveMetrics[profileId] || { assigned: 0, active: 0, completed: 0 };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.fullName || !createForm.role) {
      const missing = [!createForm.fullName && 'Full Name', !createForm.email && 'Email', !createForm.password && 'Password', !createForm.role && 'Role'].filter(Boolean).join(', ');
      toast({ title: 'Missing required fields', description: missing, variant: 'destructive' });
      return;
    }

    if (isSalesAdmin && createForm.role !== APP_ROLE.SALES) {
      toast({ title: 'Not allowed', description: 'Sales Admin can add only Sales members.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const brandIds = createFormBrandIds.filter(Boolean);
      const data = await apiInvokeFunction<any>('create-staff-user', {
        email: createForm.email,
        password: createForm.password,
        fullName: createForm.fullName,
        role: createForm.role,
        locationId: createForm.locationId || null,
        brandIds: brandIds.length > 0 ? brandIds : (createForm.brandId ? [createForm.brandId] : []),
        can_use_demo_data: !!createForm.can_use_demo_data,
      });
      if (data?.error) throw new Error(data.error as string);

      const verificationNote = data?.verificationEmailSent
        ? ' Verification email sent.'
        : ' User created. Verification email could not be sent (SMTP not configured).';
      toast({ title: 'User created', description: `${createForm.fullName} added as ${createForm.role}.${verificationNote}` });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'user_created',
          label: `Created user: ${createForm.fullName} (${createForm.role})`,
          route: '/users',
          metadata: { newUserEmail: createForm.email, newUserRole: createForm.role, newUserFullName: createForm.fullName, locationId: createForm.locationId || null },
        });
      }
      setShowCreateDialog(false);
      setCreateFormBrandIds([]);
      setCreateForm({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '', brandId: '', can_use_demo_data: false });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (u: any) => {
    const currentRole = u.user_roles?.[0]?.role || '';
    const locId = u.location_id || '';
    const loc = locations.find(l => l.id === locId);
    const storedBrandIds = Array.isArray(u.brand_ids) ? u.brand_ids.filter(Boolean) : [];
    const fallbackBrandId = (u.brandId || u.brand_id || (loc as any)?.brandId || '').toString();
    setEditFormBrandIds(storedBrandIds.length > 0 ? storedBrandIds : (fallbackBrandId ? [fallbackBrandId] : []));
    setEditForm({ role: currentRole, locationId: locId });
    setEditingUser(u);
  };

  const handleUpdateRole = async () => {
    if (!editingUser || !editForm.role) return;

    if (isSalesAdmin) {
      const targetRole = getPrimaryRole(editingUser);
      if (targetRole !== APP_ROLE.SALES || editForm.role !== APP_ROLE.SALES) {
        toast({ title: 'Not allowed', description: 'Sales Admin can edit only Sales members.', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const previousRole = editingUser.user_roles?.[0]?.role as string | undefined;
      const roleChanged = editForm.role !== previousRole;

      await apiPost('/api/user-roles', {
        user_id: editingUser.user_id,
        role: editForm.role,
        notify: roleChanged,
        userEmail: editingUser.email,
        userName: editingUser.full_name,
        previousRole: previousRole ?? null,
      });

      await apiPatch(`/api/profiles/${encodeURIComponent(editingUser.id)}`, {
        location_id: editForm.locationId || null,
        brand_ids: editFormBrandIds.filter(Boolean),
      });

      toast({ title: 'Updated', description: `${editingUser.full_name} is now ${getAppRoleLabel(editForm.role as AppRole)}${roleChanged ? ' — role change email sent' : ''}` });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'user_role_updated',
          label: `Updated role for ${editingUser.full_name} to ${editForm.role}`,
          route: '/users',
          metadata: { targetProfileId: editingUser.id, targetName: editingUser.full_name, newRole: editForm.role, locationId: editForm.locationId || null },
        });
      }
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Open create dialog — auto-fill location/brand for Sales Admin / Branch Admin
  const handleOpenCreateDialog = () => {
    if ((isSalesAdmin || role === APP_ROLE.BRAND_ADMIN) && profile?.location_id) {
      const creatorLoc = locations.find(l => l.id === profile.location_id);
      const creatorBrandIds = Array.isArray(profile?.brand_ids) ? profile.brand_ids.filter(Boolean) : [];
      const fallbackBrandId = (creatorLoc as any)?.brandId || '';
      setCreateFormBrandIds(creatorBrandIds.length > 0 ? creatorBrandIds : (fallbackBrandId ? [fallbackBrandId] : []));
      setCreateForm(p => ({ ...p, locationId: profile.location_id || '', brandId: fallbackBrandId }));
    } else {
      setCreateFormBrandIds([]);
    }
    setShowCreateDialog(true);
  };

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return null;
    return locations.find(l => l.id === locationId)?.name || null;
  };

  const getBrandName = (u: any) => {
    const assignedBrandIds = Array.isArray(u?.brand_ids) ? u.brand_ids.filter(Boolean) : [];
    if (assignedBrandIds.length > 0) {
      const names = assignedBrandIds
        .map((brandId: string) => brands.find((b: any) => b.id === brandId)?.name)
        .filter(Boolean) as string[];
      if (names.length > 0) return names.join(', ');
    }

    const locationId = u?.location_id || null;
    if (!locationId) return null;
    const loc = locations.find(l => l.id === locationId) as any;
    if (loc?.brandName) return loc.brandName as string;
    if (loc?.brandId) return brands.find(b => b.id === loc.brandId)?.name || null;
    return null;
  };

  const getDealerNameByLocation = (locationId: string | null) => {
    if (!locationId) return null;
    const location = locations.find(l => l.id === locationId);
    if (!location?.dealer_id) return null;
    return dealers.find(d => d.id === location.dealer_id)?.name || null;
  };

  const handleToggleUserBlock = async (u: any) => {
    if (!canBlockDeleteStaff || u.user_id === user?.id) return;

    const nextActive = !isUserActive(u);
    setSaving(true);
    try {
      await apiPatch(`/api/profiles/${encodeURIComponent(u.id)}`, { is_active: nextActive });

      toast({ title: nextActive ? 'User unblocked' : 'User blocked' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (!canBlockDeleteStaff || u.user_id === user?.id) return;

    setSaving(true);
    try {
      const data = await apiInvokeFunction<any>('delete-staff-user', { userId: u.user_id });
      if (data?.error) throw new Error(data.error as string);

      toast({ title: 'User deleted' });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'user_deleted',
          label: `Deleted user: ${u.full_name}`,
          route: '/users',
          metadata: { targetProfileId: u.id, targetName: u.full_name, targetRole: u.user_roles?.[0]?.role ?? null },
        });
      }
      fetchUsers();
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : '';
      const normalizedMessage = message.toLowerCase();
      const status = err?.context?.status ?? err?.status ?? null;

      const isEdgeFunctionNetworkError = normalizedMessage.includes('failed to send a request to the edge function');
      const isFunctionNotFound = status === 404 || normalizedMessage.includes('not found');
      const isForbidden = status === 403 || normalizedMessage.includes('forbidden');
      const isUnauthorized = status === 401 || normalizedMessage.includes('unauthorized');

      toast({
        title: 'Error',
        description: isFunctionNotFound
          ? 'Delete service is not deployed. Please deploy the delete-staff-user Edge Function.'
          : isForbidden
            ? 'Delete service deployment/access is blocked (403). Ask a project owner/admin to deploy or grant required privileges.'
            : isUnauthorized
              ? 'Your session is not authorized for delete service. Please log in again.'
              : isEdgeFunctionNetworkError
                ? 'Delete service is unreachable. Please deploy/enable the delete-staff-user Edge Function and try again.'
                : message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnLeave = async (u: any) => {
    if (!canManageStaff || u.user_id === user?.id) return;
    // If currently on leave → end leave immediately
    if (u.on_leave || u.leave_end_date) {
      setSaving(true);
      try {
        await apiPatch(`/api/profiles/${encodeURIComponent(u.id)}`, {
          on_leave: false,
          leave_start_date: null,
          leave_end_date: null,
        });
        toast({ title: 'Leave ended', description: `${u.full_name} is back and available for auto-assignment.` });
        if (profile?.user_id) {
          void logStaffActivity({
            userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
            eventType: 'user_leave_cleared',
            label: `Cleared leave for ${u.full_name}`,
            route: '/users',
            metadata: { targetProfileId: u.id, targetName: u.full_name },
          });
        }
        fetchUsers();
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      // Open leave date dialog
      setLeaveForm({ startDate: todayIso, endDate: todayIso });
      setLeaveDialog({ user: u });
    }
  };

  const handleSaveLeave = async () => {
    if (!leaveDialog) return;
    const u = leaveDialog.user;
    if (leaveForm.endDate < leaveForm.startDate) {
      toast({ title: 'Invalid dates', description: 'End date cannot be before start date.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/profiles/${encodeURIComponent(u.id)}`, {
        on_leave: true,
        leave_start_date: leaveForm.startDate,
        leave_end_date: leaveForm.endDate,
      });
      const isSingleDay = leaveForm.startDate === leaveForm.endDate;
      toast({
        title: 'Leave scheduled',
        description: isSingleDay
          ? `${u.full_name} is on leave on ${leaveForm.startDate}.`
          : `${u.full_name} is on leave from ${leaveForm.startDate} to ${leaveForm.endDate}. They will be auto-restored on ${leaveForm.endDate} end of day.`,
      });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'user_leave_set',
          label: `Scheduled leave for ${u.full_name}: ${leaveForm.startDate} – ${leaveForm.endDate}`,
          route: '/users',
          metadata: { targetProfileId: u.id, targetName: u.full_name, startDate: leaveForm.startDate, endDate: leaveForm.endDate },
        });
      }
      setLeaveDialog(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openConfirmAction = (type: 'delete' | 'toggle-block', u: any) => {
    if (!canBlockDeleteStaff || u.user_id === user?.id || saving) return;
    setConfirmAction({ type, user: u });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete') {
      await handleDeleteUser(confirmAction.user);
    } else {
      await handleToggleUserBlock(confirmAction.user);
    }

    setConfirmAction(null);
  };

  // Derived filtered list from search + role + location filters
  const displayUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    if (q) {
      const nameMatch = (u.full_name || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }
    if (roleFilter !== 'all') {
      const hasRole = (u.user_roles || []).some((r: any) => r.role === roleFilter);
      if (!hasRole) return false;
    }
    if (locationFilter !== 'all') {
      if (u.location_id !== locationFilter) return false;
    }
    return true;
  });

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading staff list..." className="py-16" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Staff Management</h1>
          <div className="flex w-full sm:w-auto items-center gap-2">
            {isSuperAdmin && (
              <Select value={selectedDealerFilter} onValueChange={setSelectedDealerFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by dealer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {dealers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleOpenCreateDialog} className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" /> Add Staff
            </Button>
          </div>
        </div>

        {/* ── Search + Filter bar ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="w-full sm:w-64 h-9 text-sm"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {STAFF_ROLE_OPTIONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {locations.length > 1 && (
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(searchQuery || roleFilter !== 'all' || locationFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSearchQuery(''); setRoleFilter('all'); setLocationFilter('all'); }}>
              Clear filters
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{displayUsers.length} of {users.length} staff</span>
        </div>

        {/* Desktop Table */}
        <Card className="shadow-card hidden lg:block">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Verified</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Brand</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Dealer</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Test Drives</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                    {(() => {
                      const driveStats = getStaffDriveMetrics(u.id);
                      return (
                        <>
                    <td className="p-3 font-medium text-foreground">{u.full_name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      {verificationByUserId[u.user_id] ? (
                        <Badge variant="secondary" className="bg-success/10 text-success">Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive">No</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {u.user_roles?.map((r: any) => (
                        <Badge key={r.role} variant="secondary" className={getAppRoleBadgeClass(r.role)}>
                          {getAppRoleLabel(r.role)}
                        </Badge>
                      ))}
                      {(!u.user_roles || u.user_roles.length === 0) && (
                        <Badge variant="outline">No role</Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {getBrandName(u) ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400 text-[11px] font-medium">
                          {getBrandName(u)}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {getLocationName(u.location_id) ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getLocationName(u.location_id)}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {getDealerNameByLocation(u.location_id) || '–'}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="bg-info/10 text-info">A: {driveStats.assigned}</Badge>
                        <Badge variant="secondary" className="bg-warning/10 text-warning">Live: {driveStats.active}</Badge>
                        <Badge variant="secondary" className="bg-success/10 text-success">Done: {driveStats.completed}</Badge>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className={isUserActive(u) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {isUserActive(u) ? 'Active' : 'Inactive'}
                        </Badge>
                        {u.on_leave && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] max-w-[160px] truncate">
                            <PlaneTakeoff className="h-2.5 w-2.5 mr-1 shrink-0" />
                            {u.leave_start_date && u.leave_end_date
                              ? u.leave_start_date === u.leave_end_date
                                ? `Leave: ${u.leave_start_date}`
                                : `${u.leave_start_date} → ${u.leave_end_date}`
                              : 'On Leave'}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={saving}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openEditDialog(u)} disabled={!canEditTargetUser(u) || saving}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleResendVerificationForUser(u)}
                            disabled={!canEditTargetUser(u) || saving}
                          >
                            <Mail className="h-3.5 w-3.5 mr-2" />
                            {resendingVerificationByUserId[u.user_id] ? 'Sending Verification...' : 'Send Verification'}
                          </DropdownMenuItem>
                          {canManageStaff && (
                            <DropdownMenuItem
                              onClick={() => handleToggleOnLeave(u)}
                              disabled={u.user_id === user?.id || saving}
                            >
                              {u.on_leave ? (
                                <><PlaneLanding className="h-3.5 w-3.5 mr-2 text-success" /> End Leave</>
                              ) : (
                                <><PlaneTakeoff className="h-3.5 w-3.5 mr-2 text-amber-500" /> Mark On Leave</>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canBlockDeleteStaff && (
                            <DropdownMenuItem
                              onClick={() => openConfirmAction('toggle-block', u)}
                              disabled={u.user_id === user?.id || saving}
                            >
                              {isUserActive(u) ? (
                                <><Lock className="h-3.5 w-3.5 mr-2" /> Block</>
                              ) : (
                                <><Unlock className="h-3.5 w-3.5 mr-2" /> Unblock</>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canBlockDeleteStaff && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openConfirmAction('delete', u)}
                                disabled={u.user_id === user?.id || saving}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {displayUsers.map(u => (
            <Card key={u.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-4 space-y-3">
                {(() => {
                  const driveStats = getStaffDriveMetrics(u.id);
                  return (
                    <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading font-semibold text-foreground">{u.full_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{u.email}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant="secondary" className={isUserActive(u) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {isUserActive(u) ? 'Active' : 'Inactive'}
                    </Badge>
                    {u.on_leave && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] max-w-[160px] truncate">
                        <PlaneTakeoff className="h-2.5 w-2.5 mr-1 shrink-0" />
                        {u.leave_start_date && u.leave_end_date
                          ? u.leave_start_date === u.leave_end_date
                            ? `Leave: ${u.leave_start_date}`
                            : `${u.leave_start_date} → ${u.leave_end_date}`
                          : 'On Leave'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Verified:</span>
                  {verificationByUserId[u.user_id] ? (
                    <Badge variant="secondary" className="bg-success/10 text-success">Yes</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">No</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    {u.user_roles?.map((r: any) => (
                      <Badge key={r.role} variant="secondary" className={`text-xs ${getAppRoleBadgeClass(r.role)}`}>
                        {getAppRoleLabel(r.role)}
                      </Badge>
                    ))}
                    {(!u.user_roles || u.user_roles.length === 0) && (
                      <Badge variant="outline" className="text-xs">No role</Badge>
                    )}
                  </div>
                </div>

                {getLocationName(u.location_id) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {getBrandName(u) && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400 text-[10px] font-medium">
                        {getBrandName(u)}
                      </span>
                    )}
                    {getLocationName(u.location_id)}
                  </div>
                )}

                {getDealerNameByLocation(u.location_id) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Dealer: {getDealerNameByLocation(u.location_id)}
                  </div>
                )}

                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Test Drives</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="secondary" className="bg-info/10 text-info">Assigned: {driveStats.assigned}</Badge>
                    <Badge variant="secondary" className="bg-warning/10 text-warning">Active: {driveStats.active}</Badge>
                    <Badge variant="secondary" className="bg-success/10 text-success">Completed: {driveStats.completed}</Badge>
                  </div>
                </div>

                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={saving}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => openEditDialog(u)} disabled={!canEditTargetUser(u) || saving}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Role & Location
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResendVerificationForUser(u)}
                        disabled={!canEditTargetUser(u) || saving}
                      >
                        <Mail className="h-3.5 w-3.5 mr-2" />
                        {resendingVerificationByUserId[u.user_id] ? 'Sending Verification...' : 'Send Verification'}
                      </DropdownMenuItem>
                      {canManageStaff && (
                        <DropdownMenuItem
                          onClick={() => handleToggleOnLeave(u)}
                          disabled={u.user_id === user?.id || saving}
                        >
                          {u.on_leave ? (
                            <><PlaneLanding className="h-3.5 w-3.5 mr-2 text-success" /> End Leave</>
                          ) : (
                            <><PlaneTakeoff className="h-3.5 w-3.5 mr-2 text-amber-500" /> Mark On Leave</>
                          )}
                        </DropdownMenuItem>
                      )}
                      {canBlockDeleteStaff && (
                        <DropdownMenuItem
                          onClick={() => openConfirmAction('toggle-block', u)}
                          disabled={u.user_id === user?.id || saving}
                        >
                          {isUserActive(u) ? (
                            <><Lock className="h-3.5 w-3.5 mr-2" /> Block User</>
                          ) : (
                            <><Unlock className="h-3.5 w-3.5 mr-2" /> Unblock User</>
                          )}
                        </DropdownMenuItem>
                      )}
                      {canBlockDeleteStaff && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openConfirmAction('delete', u)}
                            disabled={u.user_id === user?.id || saving}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) { setCreateFormBrandIds([]); setCreateForm({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '', brandId: '', can_use_demo_data: false }); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {profile?.can_use_demo_data && (
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setCreateForm(p => ({ ...p, ...demoAutofillData.UsersPage }))}>
                    Show Demo Data
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  id="can_use_demo_data"
                  type="checkbox"
                  checked={createForm.can_use_demo_data}
                  onChange={e => setCreateForm(p => ({ ...p, can_use_demo_data: e.target.checked }))}
                  className="h-4 w-4 border rounded"
                />
                <Label htmlFor="can_use_demo_data" className="text-xs cursor-pointer">Allow demo data autofill</Label>
              </div>
              <div className="space-y-2"><Label>Full Name *</Label><Input value={createForm.fullName} onChange={e => setCreateForm(p => ({ ...p, fullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <div className="relative">
                  <Input type={showCreatePw ? 'text' : 'password'} value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} minLength={6} className="pr-10" />
                  <button type="button" tabIndex={-1} onClick={() => setShowCreatePw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCreatePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
<Select value={createForm.role} onValueChange={(v: string) => setCreateForm(p => ({ ...p, role: v as AppRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignableRolesForCurrentUser
                      .map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Brand selection */}
              {brands.length > 0 && (
                <div className="space-y-2">
                  <Label>Brands</Label>
                  <BrandMultiSelect
                    brands={brands}
                    selectedBrandIds={createFormBrandIds}
                    disabled={isSalesAdmin || role === APP_ROLE.BRAND_ADMIN}
                    onChange={(next) => {
                      setCreateFormBrandIds(next);
                      setCreateForm((p) => ({ ...p, brandId: next[0] || '', locationId: '' }));
                    }}
                  />
                </div>
              )}
              {/* Location filtered by brand */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={createForm.locationId}
                  onValueChange={v => setCreateForm(p => ({ ...p, locationId: v }))}
                  disabled={isSalesAdmin || role === APP_ROLE.BRAND_ADMIN}
                >
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {filterLocationsByBrandIds(locations, createFormBrandIds.filter(Boolean)).map((location) => (
                      <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full bg-success text-success-foreground hover:bg-success/90" disabled={saving}>
                {saving ? 'Creating...' : 'Create Staff Member'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setEditFormBrandIds([]); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                Edit {editingUser?.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
<Select value={editForm.role} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {assignableRolesForCurrentUser
                      .map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Brand selection */}
              {brands.length > 0 && (
                <div className="space-y-2">
                  <Label>Brands</Label>
                  <BrandMultiSelect
                    brands={brands}
                    selectedBrandIds={editFormBrandIds}
                    onChange={(next) => {
                      setEditFormBrandIds(next);
                      setEditForm((p) => ({ ...p, locationId: '' }));
                    }}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={editForm.locationId} onValueChange={v => setEditForm(p => ({ ...p, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="No location" /></SelectTrigger>
                  <SelectContent>
                    {filterLocationsByBrandIds(locations, editFormBrandIds.filter(Boolean)).map((location) => (
                      <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUpdateRole} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === 'delete'
                  ? 'Delete User'
                  : isUserActive(confirmAction?.user)
                    ? 'Block User'
                    : 'Unblock User'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === 'delete'
                  ? (
                    <div className="space-y-2 text-sm">
                      <p>This action cannot be undone. Please confirm the staff member details:</p>
                      <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1">
                        <p><span className="font-medium">Name:</span> {confirmAction?.user?.full_name || 'N/A'}</p>
                        <p><span className="font-medium">Email:</span> {confirmAction?.user?.email || 'N/A'}</p>
                        <p>
                          <span className="font-medium">Role:</span>{' '}
                          {confirmAction?.user?.user_roles?.[0]?.role
                            ? getAppRoleLabel(confirmAction.user.user_roles[0].role)
                            : 'No role'}
                        </p>
                      </div>
                      <p>Do you want to permanently delete this user?</p>
                    </div>
                  )
                  : isUserActive(confirmAction?.user)
                    ? `Block ${confirmAction?.user?.full_name}? They will not be able to log in until unblocked.`
                    : `Unblock ${confirmAction?.user?.full_name}? They will be able to log in again.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction} disabled={saving}>
                {saving
                  ? 'Please wait...'
                  : confirmAction?.type === 'delete'
                    ? 'Delete'
                    : isUserActive(confirmAction?.user)
                      ? 'Block'
                      : 'Unblock'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Leave Date-Range Dialog ── */}
        <Dialog open={!!leaveDialog} onOpenChange={(open) => { if (!open) setLeaveDialog(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5 text-amber-500" />
                Schedule Leave — {leaveDialog?.user?.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <p className="text-sm text-muted-foreground">
                Select the leave period. This staff member will be excluded from auto-assignment during this time and automatically marked available when the leave ends.
              </p>

              {/* Quick-select buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Today only', days: 0 },
                  { label: '2 days', days: 1 },
                  { label: '3 days', days: 2 },
                  { label: '1 week', days: 6 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const end = new Date();
                      end.setDate(end.getDate() + days);
                      setLeaveForm({ startDate: todayIso, endDate: end.toISOString().split('T')[0] });
                    }}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-start">From date</Label>
                  <Input
                    id="leave-start"
                    type="date"
                    value={leaveForm.startDate}
                    min={todayIso}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leave-end">To date</Label>
                  <Input
                    id="leave-end"
                    type="date"
                    value={leaveForm.endDate}
                    min={leaveForm.startDate || todayIso}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {leaveForm.startDate && leaveForm.endDate && leaveForm.endDate >= leaveForm.startDate && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {leaveForm.startDate === leaveForm.endDate
                      ? `1 day leave on ${leaveForm.startDate}`
                      : (() => {
                          const start = new Date(leaveForm.startDate);
                          const end = new Date(leaveForm.endDate);
                          const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                          return `${days} days: ${leaveForm.startDate} → ${leaveForm.endDate}`;
                        })()}
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5 text-xs">
                    Staff will be auto-restored to available after {leaveForm.endDate}.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveDialog(null)} disabled={saving}>Cancel</Button>
              <Button
                onClick={handleSaveLeave}
                disabled={saving || !leaveForm.startDate || !leaveForm.endDate || leaveForm.endDate < leaveForm.startDate}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                {saving ? 'Saving...' : 'Confirm Leave'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;

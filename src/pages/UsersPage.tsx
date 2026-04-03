import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { UserPlus, Pencil, MapPin, Mail, Shield, Lock, Unlock, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE, DEFAULT_APP_ROLE, STAFF_ROLE_OPTIONS, DEALER_ASSIGNABLE_ROLES, type AppRole } from '@/constants/roles';
import { getAppRoleBadgeClass, getAppRoleLabel } from '@/lib/roles';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [selectedDealerFilter, setSelectedDealerFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '' });
  const [editForm, setEditForm] = useState({ role: '', locationId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'delete' | 'toggle-block';
    user: any;
  }>(null);
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const isDealerAdmin = role === APP_ROLE.DEALER_ADMIN;
  const canManageStaff = isSuperAdmin || isDealerAdmin;

  const isUserActive = (u: any) => u?.is_active !== false;

  useEffect(() => {
    if (!dealerLoading) {
      if (isSuperAdmin) {
        supabase.from('dealers').select('id, name').eq('is_active', true).order('name')
          .then(({ data }) => setDealers(data || []));
      }
      fetchUsers();
      let query = supabase.from('locations').select('*');
      if (isSuperAdmin && selectedDealerFilter !== 'all') {
        query = query.eq('dealer_id', selectedDealerFilter);
      } else if (!isSuperAdmin && dealerId) {
        query = query.eq('dealer_id', dealerId);
      }
      query.then(({ data }) => setLocations(data || []));
    }
  }, [dealerId, dealerLoading, isSuperAdmin, selectedDealerFilter]);

  const fetchUsers = async () => {
    const [{ data: profiles }, { data: roles }, { data: allLocations }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('user_roles').select('*'),
      supabase.from('locations').select('id, dealer_id'),
    ]);

    const locationDealerMap = (allLocations || []).reduce((acc: Record<string, string>, loc: any) => {
      acc[loc.id] = loc.dealer_id;
      return acc;
    }, {});
    
    const merged = (profiles || [])
      .filter(p => {
        if (isSuperAdmin) {
          if (selectedDealerFilter === 'all') return true;
          if (!p.location_id) return p.user_id === user?.id;
          return locationDealerMap[p.location_id] === selectedDealerFilter;
        }

        if (!dealerLocationIds) return true;
        if (p.location_id && dealerLocationIds.includes(p.location_id)) return true;
        if (p.user_id === user?.id) return true;
        return false;
      })
      .map(p => ({
        ...p,
        user_roles: (roles || []).filter(r => r.user_id === p.user_id),
      }));
    setUsers(merged);
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.fullName) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email: createForm.email,
          password: createForm.password,
          fullName: createForm.fullName,
          role: createForm.role,
          locationId: createForm.locationId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);

      toast({ title: 'User created', description: `${createForm.fullName} added as ${createForm.role}` });
      setShowCreateDialog(false);
      setCreateForm({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (u: any) => {
    const currentRole = u.user_roles?.[0]?.role || '';
    setEditForm({ role: currentRole, locationId: u.location_id || '' });
    setEditingUser(u);
  };

  const handleUpdateRole = async () => {
    if (!editingUser || !editForm.role) return;
    setSaving(true);
    try {
      const currentRole = editingUser.user_roles?.[0];

      if (currentRole) {
        await supabase.from('user_roles')
          .update({ role: editForm.role as any })
          .eq('user_id', editingUser.user_id);
      } else {
        await supabase.from('user_roles').insert({
          user_id: editingUser.user_id,
          role: editForm.role as any,
        });
      }

      await supabase.from('profiles')
        .update({ location_id: editForm.locationId || null })
        .eq('user_id', editingUser.user_id);

      toast({ title: 'Updated', description: `${editingUser.full_name} is now ${editForm.role}` });
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return null;
    return locations.find(l => l.id === locationId)?.name || null;
  };

  const getDealerNameByLocation = (locationId: string | null) => {
    if (!locationId) return null;
    const location = locations.find(l => l.id === locationId);
    if (!location?.dealer_id) return null;
    return dealers.find(d => d.id === location.dealer_id)?.name || null;
  };

  const handleToggleUserBlock = async (u: any) => {
    if (!canManageStaff || u.user_id === user?.id) return;

    const nextActive = !isUserActive(u);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: nextActive })
        .eq('user_id', u.user_id);

      if (error) throw error;

      toast({ title: nextActive ? 'User unblocked' : 'User blocked' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (!canManageStaff || u.user_id === user?.id) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-staff-user', {
        body: { userId: u.user_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);

      toast({ title: 'User deleted' });
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

  const openConfirmAction = (type: 'delete' | 'toggle-block', u: any) => {
    if (!canManageStaff || u.user_id === user?.id || saving) return;
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
            <Button onClick={() => setShowCreateDialog(true)} className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" /> Add Staff
            </Button>
          </div>
        </div>

        {/* Desktop Table */}
        <Card className="shadow-card hidden lg:block">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Dealer</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-medium text-foreground">{u.full_name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
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
                    <td className="p-3">
                      <Badge variant="secondary" className={isUserActive(u) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {isUserActive(u) ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openEditDialog(u)} disabled={u.user_id === user?.id || saving}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        {canManageStaff && (
                          <Button
                            size="sm"
                            variant={isUserActive(u) ? 'destructive' : 'outline'}
                            onClick={() => openConfirmAction('toggle-block', u)}
                            disabled={u.user_id === user?.id || saving}
                          >
                            {isUserActive(u) ? (
                              <><Lock className="h-3 w-3 mr-1" /> Block</>
                            ) : (
                              <><Unlock className="h-3 w-3 mr-1" /> Unblock</>
                            )}
                          </Button>
                        )}
                        {canManageStaff && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openConfirmAction('delete', u)}
                            disabled={u.user_id === user?.id || saving}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {users.map(u => (
            <Card key={u.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading font-semibold text-foreground">{u.full_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{u.email}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className={isUserActive(u) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                    {isUserActive(u) ? 'Active' : 'Inactive'}
                  </Badge>
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
                    {getLocationName(u.location_id)}
                  </div>
                )}

                {getDealerNameByLocation(u.location_id) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Dealer: {getDealerNameByLocation(u.location_id)}
                  </div>
                )}

                <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openEditDialog(u)} disabled={u.user_id === user?.id}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Role & Location
                </Button>
                {canManageStaff && (
                  <Button
                    size="sm"
                    variant={isUserActive(u) ? 'destructive' : 'outline'}
                    className="w-full"
                    onClick={() => openConfirmAction('toggle-block', u)}
                    disabled={u.user_id === user?.id || saving}
                  >
                    {isUserActive(u) ? (
                      <><Lock className="h-3.5 w-3.5 mr-1.5" /> Block User</>
                    ) : (
                      <><Unlock className="h-3.5 w-3.5 mr-1.5" /> Unblock User</>
                    )}
                  </Button>
                )}
                {canManageStaff && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => openConfirmAction('delete', u)}
                    disabled={u.user_id === user?.id || saving}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete User
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={createForm.fullName} onChange={e => setCreateForm(p => ({ ...p, fullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Password *</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} minLength={6} /></div>
              <div className="space-y-2">
                <Label>Role *</Label>
<Select value={createForm.role} onValueChange={(v: string) => setCreateForm(p => ({ ...p, role: v as AppRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(isSuperAdmin ? STAFF_ROLE_OPTIONS : DEALER_ASSIGNABLE_ROLES)
                      .map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={createForm.locationId} onValueChange={v => setCreateForm(p => ({ ...p, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full bg-success text-success-foreground hover:bg-success/90" disabled={saving}>
                {saving ? 'Creating...' : 'Create Staff Member'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
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
                    {(isSuperAdmin ? STAFF_ROLE_OPTIONS : DEALER_ASSIGNABLE_ROLES)
                      .map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={editForm.locationId} onValueChange={v => setEditForm(p => ({ ...p, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="No location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;

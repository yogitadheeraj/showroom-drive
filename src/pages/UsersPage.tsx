import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { UserPlus, Pencil, MapPin, Mail, Shield, Lock, Unlock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE, DEFAULT_APP_ROLE, STAFF_ROLE_OPTIONS } from '@/constants/roles';
import { getAppRoleBadgeClass, getAppRoleLabel } from '@/lib/roles';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: DEFAULT_APP_ROLE, locationId: '' });
  const [editForm, setEditForm] = useState({ role: '', locationId: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;

  const isUserActive = (u: any) => u.is_active !== false;

  useEffect(() => {
    if (!dealerLoading) {
      fetchUsers();
      let query = supabase.from('locations').select('*');
      if (dealerId) query = query.eq('dealer_id', dealerId);
      query.then(({ data }) => setLocations(data || []));
    }
  }, [dealerId, dealerLoading]);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('*');
    
    const merged = (profiles || [])
      .filter(p => {
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

  const handleToggleUserBlock = async (u: any) => {
    if (!isSuperAdmin || u.user_id === user?.id) return;

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
          <Button onClick={() => setShowCreateDialog(true)} className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto">
            <UserPlus className="h-4 w-4 mr-2" /> Add Staff
          </Button>
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
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant={isUserActive(u) ? 'destructive' : 'outline'}
                            onClick={() => handleToggleUserBlock(u)}
                            disabled={u.user_id === user?.id || saving}
                          >
                            {isUserActive(u) ? (
                              <><Lock className="h-3 w-3 mr-1" /> Block</>
                            ) : (
                              <><Unlock className="h-3 w-3 mr-1" /> Unblock</>
                            )}
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
                  <Badge variant="secondary" className={u.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
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

                <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openEditDialog(u)} disabled={u.user_id === user?.id}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Role & Location
                </Button>
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant={isUserActive(u) ? 'destructive' : 'outline'}
                    className="w-full"
                    onClick={() => handleToggleUserBlock(u)}
                    disabled={u.user_id === user?.id || saving}
                  >
                    {isUserActive(u) ? (
                      <><Lock className="h-3.5 w-3.5 mr-1.5" /> Block User</>
                    ) : (
                      <><Unlock className="h-3.5 w-3.5 mr-1.5" /> Unblock User</>
                    )}
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
                <Select value={createForm.role} <Select value={createForm.role} onValueChange={v => setCreateForm(p => ({ ...p, role: v as AppRole }))}>>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
                    {STAFF_ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;

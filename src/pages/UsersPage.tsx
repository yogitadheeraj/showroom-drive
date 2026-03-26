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
import { UserPlus, Pencil, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ROLES = [
  { value: 'superadmin', label: 'Sales Lead' },
  { value: 'gro', label: 'GRO' },
  { value: 'sales', label: 'Sales Person' },
  { value: 'security', label: 'Security' },
];

const roleColor: Record<string, string> = {
  superadmin: 'bg-destructive/10 text-destructive',
  gro: 'bg-primary/10 text-primary',
  sales: 'bg-info/10 text-info',
  security: 'bg-warning/10 text-warning',
};

const roleLabel: Record<string, string> = {
  superadmin: 'Sales Lead',
  gro: 'GRO',
  sales: 'Sales',
  security: 'Security',
};

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: 'sales', locationId: '' });
  const [editForm, setEditForm] = useState({ role: '', locationId: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { dealerId, dealerLocationIds, loading: dealerLoading } = useDealerContext();

  useEffect(() => {
    if (!dealerLoading && dealerId) {
      fetchUsers();
      supabase.from('locations').select('*').eq('dealer_id', dealerId).then(({ data }) => setLocations(data || []));
    }
  }, [dealerId, dealerLoading]);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('*');
    
    // Filter profiles to only those assigned to dealer's locations (or the dealer admin themselves)
    const merged = (profiles || [])
      .filter(p => {
        if (!dealerLocationIds) return true;
        // Include users at dealer's locations
        if (p.location_id && dealerLocationIds.includes(p.location_id)) return true;
        // Include the current user (dealer admin)
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email,
        password: createForm.password,
        options: { data: { full_name: createForm.fullName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: createForm.role as any,
      });

      if (createForm.locationId) {
        await supabase.from('profiles').update({ location_id: createForm.locationId }).eq('user_id', authData.user.id);
      }

      toast({ title: 'User created', description: `${createForm.fullName} added as ${createForm.role}` });
      setShowCreateDialog(false);
      setCreateForm({ email: '', password: '', fullName: '', role: 'sales', locationId: '' });
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

  if (dealerLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-foreground">Staff Management</h1>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Staff
          </Button>
        </div>

        <Card className="shadow-card">
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
                        <Badge key={r.role} variant="secondary" className={roleColor[r.role] || ''}>
                          {roleLabel[r.role] || r.role}
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
                      <Badge variant="secondary" className={u.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(u)} disabled={u.user_id === user?.id}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

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
                <Select value={createForm.role} onValueChange={v => setCreateForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
              <Button onClick={handleCreateUser} className="w-full" disabled={saving}>
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
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
              <Button onClick={handleUpdateRole} className="w-full" disabled={saving}>
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

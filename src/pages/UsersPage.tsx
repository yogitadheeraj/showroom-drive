import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, UserPlus } from 'lucide-react';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', role: 'sales', locationId: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    supabase.from('locations').select('*').then(({ data }) => setLocations(data || []));
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*, user_roles(role)').order('full_name');
    setUsers(data || []);
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { full_name: formData.fullName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // Assign role
      await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: formData.role as any,
      });

      // Update profile with location
      if (formData.locationId) {
        await supabase.from('profiles').update({ location_id: formData.locationId }).eq('user_id', authData.user.id);
      }

      toast({ title: 'User created', description: `${formData.fullName} added as ${formData.role}` });
      setShowDialog(false);
      setFormData({ email: '', password: '', fullName: '', role: 'sales', locationId: '' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const roleColor: Record<string, string> = {
    superadmin: 'bg-destructive/10 text-destructive',
    gro: 'bg-primary/10 text-primary',
    sales: 'bg-info/10 text-info',
    security: 'bg-warning/10 text-warning',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-foreground">Staff Management</h1>
          <Button onClick={() => setShowDialog(true)}>
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
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
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
                          {r.role}
                        </Badge>
                      ))}
                      {(!u.user_roles || u.user_roles.length === 0) && (
                        <Badge variant="outline">No role</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={u.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Password *</Label><Input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} minLength={6} /></div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={v => setFormData(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="gro">GRO</SelectItem>
                    <SelectItem value="sales">Sales Person</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={formData.locationId} onValueChange={v => setFormData(p => ({ ...p, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full">Create Staff Member</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SecurityDashboard = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodayDrives();
  }, [profile]);

  const fetchTodayDrives = async () => {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('scheduled_date', today)
      .in('status', ['confirmed', 'show', 'in_progress', 'completed']);
    
    if (profile?.location_id) {
      query = query.eq('location_id', profile.location_id);
    }
    
    const { data } = await query.order('scheduled_time', { ascending: true });
    setTestDrives(data || []);
  };

  const checkIn = async (id: string) => {
    await supabase.from('test_drives').update({ 
      security_checked_in_at: new Date().toISOString(),
      status: 'show' as any
    }).eq('id', id);
    toast({ title: 'Customer checked in' });
    fetchTodayDrives();
  };

  const checkOut = async (id: string) => {
    await supabase.from('test_drives').update({ 
      security_checked_out_at: new Date().toISOString() 
    }).eq('id', id);
    toast({ title: 'Customer checked out' });
    fetchTodayDrives();
  };

  const verifyLicense = async (customerId: string) => {
    await supabase.from('customers').update({ driving_license_verified: true }).eq('id', customerId);
    toast({ title: 'License verified' });
    fetchTodayDrives();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Security Dashboard</h1>
        <p className="text-muted-foreground">Today's check-ins and document verification</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Visitors</p>
              <p className="text-2xl font-heading font-bold text-foreground">{testDrives.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Checked In</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => t.security_checked_in_at).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">License Verified</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => t.customers?.driving_license_verified).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Today's Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testDrives.map(td => (
              <div key={td.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {td.vehicles?.brand} {td.vehicles?.model} • {td.scheduled_time}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {td.customers?.driving_license_url ? (
                      td.customers?.driving_license_verified ? (
                        <Badge className="bg-success/10 text-success">License Verified</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-warning/10 text-warning">License Pending</Badge>
                          <Button size="sm" variant="outline" onClick={() => verifyLicense(td.customer_id)}>
                            <FileCheck className="h-3 w-3 mr-1" /> Verify
                          </Button>
                        </div>
                      )
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive">No License</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!td.security_checked_in_at ? (
                    <Button size="sm" onClick={() => checkIn(td.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Check In
                    </Button>
                  ) : !td.security_checked_out_at ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-success/10 text-success">Checked In</Badge>
                      <Button size="sm" variant="outline" onClick={() => checkOut(td.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Check Out
                      </Button>
                    </div>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground">Checked Out</Badge>
                  )}
                </div>
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No appointments for today</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityDashboard;

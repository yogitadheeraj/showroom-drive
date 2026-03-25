import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarCheck, Upload, FileCheck, ArrowRightLeft, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesSwapDialog from './SalesSwapDialog';

const SalesDashboard = () => {
  const { user, profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [swapDrive, setSwapDrive] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignedDrives();
  }, [user]);

  const fetchAssignedDrives = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('test_drives')
      .select('*, customers(*), vehicles(*), locations(*)')
      .eq('assigned_sales_person_id', profile.id)
      .order('scheduled_date', { ascending: true });
    setTestDrives(data || []);
  };

  const handleUploadLicense = async (testDriveId: string, customerId: string, file: File) => {
    setUploading(testDriveId);
    try {
      const ext = file.name.split('.').pop();
      const path = `licenses/${customerId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      await supabase.from('customers').update({ driving_license_url: publicUrl }).eq('id', customerId);
      toast({ title: 'License uploaded successfully' });
      fetchAssignedDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const statusColor: Record<string, string> = {
    scheduled: 'bg-info/10 text-info',
    confirmed: 'bg-primary/10 text-primary',
    show: 'bg-success/10 text-success',
    no_show: 'bg-warning/10 text-warning',
    in_progress: 'bg-accent/10 text-accent-foreground',
    completed: 'bg-success/10 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Sales Dashboard</h1>
        <p className="text-muted-foreground">Your assigned test drives</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <CalendarCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned</p>
              <p className="text-2xl font-heading font-bold text-foreground">{testDrives.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Upload className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending License</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {testDrives.filter(t => !t.customers?.driving_license_url).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Assigned Test Drives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testDrives.map(td => (
              <div key={td.id} className="p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{td.customers?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{td.customers?.phone} • {td.customers?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={statusColor[td.status] || ''}>
                      {td.status.replace('_', ' ')}
                    </Badge>
                    {['scheduled', 'confirmed', 'show'].includes(td.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setSwapDrive(td)} title="Swap with teammate">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{td.vehicles?.brand} {td.vehicles?.model}</span>
                  <span>{td.scheduled_date}</span>
                  <span>{td.scheduled_time}</span>
                </div>
                {td.notes && (
                  <div className="mb-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground whitespace-pre-line">
                    {td.notes}
                  </div>
                )}
                {!td.customers?.driving_license_url ? (
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`license-${td.id}`} className="text-sm">Upload Driving License:</Label>
                    <Input
                      id={`license-${td.id}`}
                      type="file"
                      accept="image/*,.pdf"
                      className="max-w-xs"
                      disabled={uploading === td.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadLicense(td.id, td.customer_id, file);
                      }}
                    />
                    {uploading === td.id && <span className="text-xs text-muted-foreground">Uploading...</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileCheck className="h-4 w-4 text-success" />
                    <span className="text-sm text-success">License uploaded</span>
                    {!td.customers?.driving_license_verified && (
                      <>
                        <Badge variant="outline" className="text-warning">Pending verification</Badge>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`reupload-${td.id}`} className="cursor-pointer">
                            <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
                              <span><RotateCcw className="h-3 w-3 mr-1" /> Re-upload</span>
                            </Button>
                          </Label>
                          <input
                            id={`reupload-${td.id}`}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploading === td.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLicense(td.id, td.customer_id, file);
                            }}
                          />
                        </div>
                      </>
                    )}
                    {td.customers?.driving_license_verified && (
                      <Badge variant="outline" className="text-success">Verified</Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
            {testDrives.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No test drives assigned to you</p>
            )}
          </div>
        </CardContent>
      </Card>

      <SalesSwapDialog
        open={!!swapDrive}
        onClose={() => setSwapDrive(null)}
        testDrive={swapDrive}
        onSwapped={fetchAssignedDrives}
      />
    </div>
  );
};

export default SalesDashboard;

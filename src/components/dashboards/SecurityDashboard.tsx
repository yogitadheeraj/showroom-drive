import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, FileCheck, AlertCircle, Upload, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';

const SecurityDashboard = () => {
  const { profile } = useAuth();
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingVerifyId, setPendingVerifyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);

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

  const openLicensePreview = (customerId: string, licenseUrl: string) => {
    // Get public URL from storage
    const { data } = supabase.storage.from('documents').getPublicUrl(licenseUrl);
    setPreviewUrl(data?.publicUrl || licenseUrl);
    setPendingVerifyId(customerId);
    setPreviewOpen(true);
  };

  const confirmVerify = async () => {
    if (!pendingVerifyId) return;
    await supabase.from('customers').update({ driving_license_verified: true }).eq('id', pendingVerifyId);
    toast({ title: 'License verified' });
    setPreviewOpen(false);
    setPendingVerifyId(null);
    fetchTodayDrives();
  };

  const openRejectDialog = (customerId: string) => {
    setPendingRejectId(customerId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!pendingRejectId) return;
    await supabase.from('customers').update({
      driving_license_url: null,
      driving_license_verified: false,
    }).eq('id', pendingRejectId);
    toast({ title: 'License rejected', description: rejectReason || 'Customer must re-upload their license' });
    setRejectOpen(false);
    setPendingRejectId(null);
    setPreviewOpen(false);
    fetchTodayDrives();
  };

  const handleReuploadLicense = async (customerId: string, file: File) => {
    setReuploadingId(customerId);
    try {
      const ext = file.name.split('.').pop();
      const path = `licenses/${customerId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      await supabase.from('customers').update({
        driving_license_url: publicUrl,
        driving_license_verified: false,
      }).eq('id', customerId);
      toast({ title: 'License re-uploaded', description: 'Ready for verification' });
      fetchTodayDrives();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setReuploadingId(null);
    }
  };

  const pendingCount = testDrives.filter(
    t => t.customers?.driving_license_url && !t.customers?.driving_license_verified
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Security Dashboard</h1>
        <p className="text-muted-foreground">Today's check-ins and document verification</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <Card className="shadow-card border-warning/30">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="relative h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-warning" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Verification</p>
              <p className="text-2xl font-heading font-bold text-warning">{pendingCount}</p>
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
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {td.customers?.driving_license_url ? (
                      td.customers?.driving_license_verified ? (
                        <Badge className="bg-success/10 text-success">License Verified</Badge>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-warning/10 text-warning">License Pending</Badge>
                          <Button size="sm" variant="outline" onClick={() => openLicensePreview(td.customer_id, td.customers.driving_license_url)}>
                            <FileCheck className="h-3 w-3 mr-1" /> Review & Verify
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openRejectDialog(td.customer_id)}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-destructive/10 text-destructive">No License</Badge>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`reupload-sec-${td.customer_id}`} className="cursor-pointer">
                            <Button size="sm" variant="outline" asChild>
                              <span><Upload className="h-3 w-3 mr-1" /> Upload License</span>
                            </Button>
                          </Label>
                          <input
                            id={`reupload-sec-${td.customer_id}`}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={reuploadingId === td.customer_id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReuploadLicense(td.customer_id, file);
                            }}
                          />
                          {reuploadingId === td.customer_id && <span className="text-xs text-muted-foreground">Uploading...</span>}
                        </div>
                      </div>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Driving License Preview</DialogTitle>
            <DialogDescription>Review the uploaded license before verifying</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[300px]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Driving License"
                className="max-w-full max-h-[400px] rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<p class="text-muted-foreground">Unable to load license image. The file may not be an image format.</p>';
                }}
              />
            ) : (
              <p className="text-muted-foreground">No preview available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={confirmVerify}>
              <CheckCircle className="h-4 w-4 mr-1" /> Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityDashboard;

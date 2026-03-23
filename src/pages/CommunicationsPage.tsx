import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CommunicationsPage = () => {
  const [communications, setCommunications] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchCommunications();
  }, [typeFilter]);

  const fetchCommunications = async () => {
    let query = supabase.from('communications')
      .select('*, customers(full_name, phone), test_drives(scheduled_date)')
      .order('created_at', { ascending: false });
    if (typeFilter !== 'all') query = query.eq('type', typeFilter as any);
    const { data } = await query;
    setCommunications(data || []);
  };

  const typeColor: Record<string, string> = {
    email: 'bg-info/10 text-info',
    whatsapp: 'bg-success/10 text-success',
    sms: 'bg-accent/10 text-accent-foreground',
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    sent: 'bg-info/10 text-info',
    delivered: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Communications</h1>
            <p className="text-muted-foreground">Email & WhatsApp message history</p>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-muted-foreground font-medium">Customer</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Type</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Purpose</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Sent To</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Subject</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {communications.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium text-foreground">{c.customers?.full_name}</td>
                      <td className="p-3"><Badge variant="secondary" className={typeColor[c.type]}>{c.type}</Badge></td>
                      <td className="p-3 text-muted-foreground capitalize">{c.purpose.replace('_', ' ')}</td>
                      <td className="p-3 text-muted-foreground">{c.sent_to}</td>
                      <td className="p-3 text-muted-foreground">{c.subject || '-'}</td>
                      <td className="p-3"><Badge variant="secondary" className={statusColor[c.status]}>{c.status}</Badge></td>
                      <td className="p-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {communications.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No communications found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationsPage;

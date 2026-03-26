import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDealerContext } from '@/hooks/useDealerContext';
import { MessageSquare, User, Clock, Send, Mail, Phone } from 'lucide-react';

const CommunicationsPage = () => {
  const [communications, setCommunications] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const { dealerLocationIds, loading: dealerLoading } = useDealerContext();

  useEffect(() => {
    if (!dealerLoading) fetchCommunications();
  }, [typeFilter, dealerLocationIds, dealerLoading]);

  const fetchCommunications = async () => {
    let query = supabase.from('communications')
      .select('*, customers(full_name, phone), test_drives(scheduled_date, location_id)')
      .order('created_at', { ascending: false });
    if (typeFilter !== 'all') query = query.eq('type', typeFilter as any);
    const { data } = await query;
    
    let filtered = data || [];
    if (dealerLocationIds && dealerLocationIds.length > 0) {
      filtered = filtered.filter(c => {
        if (c.test_drive_id && c.test_drives?.location_id) {
          return dealerLocationIds.includes(c.test_drives.location_id);
        }
        return !c.test_drive_id;
      });
    }
    setCommunications(filtered);
  };

  const typeColor: Record<string, string> = {
    email: 'bg-info/10 text-info',
    whatsapp: 'bg-success/10 text-success',
    sms: 'bg-accent/10 text-accent-foreground',
  };

  const typeIcon: Record<string, any> = {
    email: Mail,
    whatsapp: MessageSquare,
    sms: Phone,
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    sent: 'bg-info/10 text-info',
    delivered: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Communications</h1>
            <p className="text-sm text-muted-foreground">Email & WhatsApp message history</p>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
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

        {/* Desktop Table */}
        <Card className="shadow-card hidden lg:block">
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

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {communications.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-8 text-center text-muted-foreground">No communications found</CardContent>
            </Card>
          ) : communications.map(c => {
            const TypeIcon = typeIcon[c.type] || MessageSquare;
            return (
              <Card key={c.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-sm text-foreground">{c.customers?.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{c.purpose.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${statusColor[c.status]}`}>{c.status}</Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={`text-xs ${typeColor[c.type]}`}>{c.type}</Badge>
                    {c.subject && <span className="text-xs text-muted-foreground truncate">{c.subject}</span>}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      <span className="truncate max-w-[180px]">{c.sent_to}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationsPage;

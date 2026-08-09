import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, User, Clock, Send, Mail, Phone } from 'lucide-react';
import { apiGet } from '@/lib/apiClient';

const CommunicationsPage = () => {
  const [communications, setCommunications] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchCommunications();
  }, [typeFilter]);

  const fetchCommunications = async () => {
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const baseComms = await apiGet<any[]>(`/api/communications?${params}`);

      const customerIds = Array.from(
        new Set((baseComms || []).map((c: any) => c.customer_id).filter(Boolean))
      );
      const testDriveIds = Array.from(
        new Set((baseComms || []).map((c: any) => c.test_drive_id).filter(Boolean))
      );

      const [customers, testDrives] = await Promise.all([
        customerIds.length
          ? apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(customerIds.join(','))}`)
          : Promise.resolve([] as any[]),
        testDriveIds.length
          ? apiGet<any[]>(`/api/test-drives?ids=${encodeURIComponent(testDriveIds.join(','))}&include_related=false`)
          : Promise.resolve([] as any[]),
      ]);

      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
      const testDriveMap = new Map((testDrives || []).map((td: any) => [td.id, td]));

      const enriched = (baseComms || []).map((c: any) => ({
        ...c,
        customers: c.customer_id ? customerMap.get(c.customer_id) || null : null,
        test_drives: c.test_drive_id ? testDriveMap.get(c.test_drive_id) || null : null,
      }));
      setCommunications(enriched);
    } catch {
      setCommunications([]);
    }
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
                      <td className="p-3 text-muted-foreground capitalize">{c.purpose?.replace('_', ' ')}</td>
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
                        <p className="text-xs text-muted-foreground capitalize">{c.purpose?.replace('_', ' ')}</p>
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

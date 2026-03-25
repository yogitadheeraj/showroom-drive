import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Inbox, Search, MessageSquare, Phone, Mail, Clock, User, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Enquiry {
  id: string;
  customer_id: string;
  subject: string | null;
  body: string | null;
  sent_to: string;
  status: string;
  created_at: string;
  customers: { full_name: string; phone: string; email: string | null } | null;
}

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'sent', label: 'Responded' },
];

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: 'New', className: 'bg-warning/10 text-warning border-warning/20' },
  sent: { label: 'Responded', className: 'bg-success/10 text-success border-success/20' },
};

const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchEnquiries();
  }, [statusFilter]);

  const fetchEnquiries = async () => {
    setLoading(true);
    let query = supabase
      .from('communications')
      .select('id, customer_id, subject, body, sent_to, status, created_at, customers(full_name, phone, email)')
      .eq('purpose', 'custom')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    setEnquiries((data as unknown as Enquiry[]) || []);
    setLoading(false);
  };

  const filtered = enquiries.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      e.customers?.full_name?.toLowerCase().includes(s) ||
      e.customers?.phone?.includes(s) ||
      e.body?.toLowerCase().includes(s) ||
      e.sent_to?.toLowerCase().includes(s)
    );
  });

  const newCount = enquiries.filter(e => e.status === 'pending').length;

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      // Log the reply as a communication
      const { error } = await supabase.from('communications').insert({
        customer_id: selected.customer_id,
        type: 'email' as const,
        purpose: 'custom' as const,
        sent_to: selected.customers?.email || selected.sent_to,
        subject: `Re: ${selected.subject || 'Website Enquiry'}`,
        body: replyText.trim(),
        status: 'sent',
      });
      if (error) throw error;

      toast.success('Reply logged successfully');
      setReplyText('');
      setSelected(null);
      fetchEnquiries();
    } catch {
      toast.error('Failed to log reply');
    } finally {
      setReplying(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Enquiries Inbox</h1>
              <p className="text-sm text-muted-foreground">
                {newCount > 0 ? `${newCount} new enquir${newCount === 1 ? 'y' : 'ies'}` : 'No new enquiries'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, message…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Enquiry Cards */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading enquiries…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No enquiries found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(e => {
              const badge = statusBadge[e.status] || statusBadge.pending;
              return (
                <Card
                  key={e.id}
                  className={`shadow-card cursor-pointer hover:shadow-elevated transition-all hover:-translate-y-0.5 ${
                    e.status === 'pending' ? 'border-l-4 border-l-warning' : ''
                  }`}
                  onClick={() => setSelected(e)}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold text-foreground">{e.customers?.full_name || 'Unknown'}</span>
                        <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{e.body || 'No message'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.customers?.phone}</span>
                        {e.customers?.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{e.customers.email}</span>
                        )}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(e.created_at), 'dd MMM yyyy, h:mm a')}</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button variant="outline" size="sm" className="rounded-xl text-xs">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Enquiry Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selected.customers?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.customers?.phone} {selected.customers?.email ? `• ${selected.customers.email}` : ''}</p>
                </div>
                <Badge variant="outline" className={`ml-auto ${(statusBadge[selected.status] || statusBadge.pending).className}`}>
                  {(statusBadge[selected.status] || statusBadge.pending).label}
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Message</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.body || 'No message content'}</p>
              </div>

              <p className="text-xs text-muted-foreground">
                Received {format(new Date(selected.created_at), "dd MMM yyyy 'at' h:mm a")}
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Log a Reply</label>
                <Textarea
                  placeholder="Type your response…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="rounded-xl min-h-[80px]"
                  maxLength={2000}
                />
                <Button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="gradient-primary border-0 text-primary-foreground rounded-xl"
                >
                  {replying ? 'Sending…' : <><Send className="h-4 w-4 mr-2" />Log Reply</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EnquiriesPage;

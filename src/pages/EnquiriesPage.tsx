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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Inbox, Search, MessageSquare, Phone, Mail, Clock, User, Send, Reply } from 'lucide-react';
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
  parent_id: string | null;
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
  const [allComms, setAllComms] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const fetchEnquiries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('communications')
      .select('id, customer_id, subject, body, sent_to, status, created_at, parent_id, customers(full_name, phone, email)')
      .eq('purpose', 'custom')
      .order('created_at', { ascending: true });

    setAllComms((data as unknown as Enquiry[]) || []);
    setLoading(false);
  };

  // Only top-level enquiries (no parent_id) shown in the list
  const topLevel = allComms.filter(e => !e.parent_id);

  // Determine effective status: if has replies → 'sent', else original status
  const getEffectiveStatus = (enquiry: Enquiry) => {
    const replies = allComms.filter(c => c.parent_id === enquiry.id);
    return replies.length > 0 ? 'sent' : enquiry.status;
  };

  const getReplies = (enquiryId: string) =>
    allComms.filter(c => c.parent_id === enquiryId).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const filtered = topLevel.filter(e => {
    const effectiveStatus = getEffectiveStatus(e);
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      e.customers?.full_name?.toLowerCase().includes(s) ||
      e.customers?.phone?.includes(s) ||
      e.body?.toLowerCase().includes(s) ||
      e.sent_to?.toLowerCase().includes(s)
    );
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const newCount = topLevel.filter(e => getEffectiveStatus(e) === 'pending').length;

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const { error } = await supabase.from('communications').insert({
        customer_id: selected.customer_id,
        type: 'email' as const,
        purpose: 'custom' as const,
        sent_to: selected.customers?.email || selected.sent_to,
        subject: `Re: ${selected.subject || 'Website Enquiry'}`,
        body: replyText.trim(),
        status: 'sent',
        parent_id: selected.id,
      });
      if (error) throw error;

      toast.success('Reply added to thread');
      setReplyText('');
      fetchEnquiries();
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const replyCount = selected ? getReplies(selected.id).length : 0;

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
              const effectiveStatus = getEffectiveStatus(e);
              const badge = statusBadge[effectiveStatus] || statusBadge.pending;
              const replies = getReplies(e.id);
              return (
                <Card
                  key={e.id}
                  className={`shadow-card cursor-pointer hover:shadow-elevated transition-all hover:-translate-y-0.5 ${
                    effectiveStatus === 'pending' ? 'border-l-4 border-l-warning' : ''
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
                        {replies.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Reply className="h-3 w-3" />{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
                          </span>
                        )}
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
                        View Thread
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Thread Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setReplyText(''); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading">Enquiry Thread</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              {/* Customer info */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selected.customers?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.customers?.phone} {selected.customers?.email ? `• ${selected.customers.email}` : ''}</p>
                </div>
              </div>

              {/* Message thread */}
              <ScrollArea className="flex-1 max-h-[350px] pr-2">
                <div className="space-y-3">
                  {/* Original enquiry */}
                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> {selected.customers?.full_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(selected.created_at), "dd MMM yyyy, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selected.body || 'No message'}</p>
                  </div>

                  {/* Replies */}
                  {getReplies(selected.id).map(reply => (
                    <div key={reply.id} className="p-3 rounded-xl bg-primary/5 border border-primary/10 ml-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-primary flex items-center gap-1">
                          <Reply className="h-3 w-3" /> Staff Reply
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(reply.created_at), "dd MMM yyyy, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{reply.body}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply input */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Textarea
                  placeholder="Type your reply…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="rounded-xl min-h-[70px]"
                  maxLength={2000}
                />
                <Button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="gradient-primary border-0 text-primary-foreground rounded-xl"
                >
                  {replying ? 'Sending…' : <><Send className="h-4 w-4 mr-2" />Reply</>}
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

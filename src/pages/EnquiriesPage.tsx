import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingState from '@/components/common/LoadingState';
import { Inbox, Search, MessageSquare, Phone, Mail, Clock, User, Send, Reply, Link2, ImagePlus, PanelRightOpen, CircleDot } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery, apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { logStaffActivity } from '@/lib/activityLogger';
import { sendTransactionalEmail } from '@/lib/functionService';
import { getStoragePublicUrl, uploadToStorage } from '@/lib/storageClient';

interface Enquiry {
  id: string;
  customer_id: string;
  subject: string | null;
  body: string | null;
  sent_to: string;
  status: string;
  is_read?: boolean;
  read_at?: string | null;
  type?: string | null;
  purpose?: string | null;
  created_at: string;
  parent_id: string | null;
  customers: { full_name: string; phone: string; email: string | null } | null;
}

type EnquiryThread = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  items: Enquiry[];
  latest: Enquiry;
  unreadCount: number;
  effectiveStatus: string;
  preview: string;
};

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
  const { role, profile } = useAuth();
  const [allComms, setAllComms] = useState<Enquiry[]>([]);
  const [salesLocations, setSalesLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [linkToShare, setLinkToShare] = useState('');
  const [imageUrlToShare, setImageUrlToShare] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleQuickTemplate = (template: 'booking' | 'map' | 'brochure') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    if (template === 'booking') {
      setReplyText('You can book your test drive directly from this link.');
      setLinkToShare(`${origin}/book`);
      return;
    }

    if (template === 'map') {
      setReplyText('You can find our showroom location on this map link.');
      setLinkToShare('https://www.google.com/maps/search/showroom');
      return;
    }

    setReplyText('Please check our latest brochure from this link.');
    setLinkToShare(`${origin}/brochure`);
  };

  useEffect(() => {
    fetchEnquiries();
  }, [role, profile?.id, locationFilter]);

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      let customerIds: string[] | null = null;

      if (role === APP_ROLE.SALES) {
        if (!profile?.id) {
          setAllComms([]);
          return;
        }

        const assignedDrives = await apiDbQuery<any[]>({
          table: 'test_drives',
          action: 'select',
          select: 'customer_id, location_id',
          filters: [{ field: 'assigned_sales_person_id', op: 'eq', value: profile.id }],
          limit: 1000,
        });

        const locationIds = Array.from(
          new Set((assignedDrives || []).map((d: any) => d.location_id).filter(Boolean))
        );
        const locations = locationIds.length
          ? await apiDbQuery<any[]>({
              table: 'locations',
              action: 'select',
              select: 'id, name',
              filters: [{ field: 'id', op: 'in', value: locationIds }],
              limit: Math.max(1000, locationIds.length),
            })
          : [];

        const locationNameMap = new Map((locations || []).map((l: any) => [l.id, l.name]));
        const locationMap = new Map<string, string>();
        (assignedDrives || []).forEach((d: any) => {
          if (d.location_id) {
            locationMap.set(d.location_id, locationNameMap.get(d.location_id) || 'Unknown Location');
          }
        });

        setSalesLocations(Array.from(locationMap.entries()).map(([id, name]) => ({ id, name })));

        const drivesByLocation = locationFilter === 'all'
          ? (assignedDrives || [])
          : (assignedDrives || []).filter((d: any) => d.location_id === locationFilter);

        customerIds = Array.from(new Set(drivesByLocation.map((d: any) => d.customer_id)));

        if (customerIds.length === 0) {
          setAllComms([]);
          return;
        }
      } else {
        setSalesLocations([]);
      }

      const commsParams = new URLSearchParams({ purpose: 'custom,follow_up', order: 'asc', limit: '2000' });
      if (customerIds) commsParams.set('customer_ids', customerIds.join(','));
      const comms = await apiGet<any[]>(`/api/communications?${commsParams.toString()}`) || [];

      const commCustomerIds = Array.from(new Set((comms || []).map((c: any) => c.customer_id).filter(Boolean)));
      const customers = commCustomerIds.length
        ? await apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(commCustomerIds.join(','))}`)
        : [];

      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

      const enrichedComms = (comms || []).map((c: any) => ({
        ...c,
        customers: c.customer_id ? customerMap.get(c.customer_id) || null : null,
      }));

      setAllComms((enrichedComms as unknown as Enquiry[]) || []);
    } catch {
      setAllComms([]);
      toast.error('Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  };

  const getReplies = (enquiryId: string) =>
    allComms.filter(c => c.parent_id === enquiryId).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const getEffectiveStatus = (enquiry: Enquiry) => {
    const replies = getReplies(enquiry.id);
    return replies.length > 0 ? 'sent' : enquiry.status;
  };

  const startEditMessage = (message: Enquiry) => {
    setEditingMessageId(message.id);
    setEditText(message.body || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const saveEditedMessage = async () => {
    if (!editingMessageId) return;
    setSavingEdit(true);
    try {
      await apiPatch(`/api/communications/${encodeURIComponent(editingMessageId)}`, { body: editText.trim() });
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'enquiry_message_edited',
          label: 'Edited enquiry message',
          route: '/enquiries',
          metadata: { communicationId: editingMessageId, customerId: selectedThread?.customerId ?? null },
        });
      }
      toast.success('Enquiry message updated');
      cancelEditMessage();
      fetchEnquiries();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update enquiry');
    } finally {
      setSavingEdit(false);
    }
  };

  const threads = useMemo<EnquiryThread[]>(() => {
    const byCustomer = new Map<string, Enquiry[]>();

    for (const message of allComms) {
      const key = message.customer_id || `unknown-${message.id}`;
      const group = byCustomer.get(key) || [];
      group.push(message);
      byCustomer.set(key, group);
    }

    return Array.from(byCustomer.entries()).map(([customerId, items]) => {
      const sorted = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latest = sorted[sorted.length - 1];
      const roots = sorted.filter((item) => !item.parent_id);
      const effectiveStatus = roots.some((item) => getEffectiveStatus(item) === 'pending') ? 'pending' : 'sent';
      const unreadCount = sorted.filter((item) => !item.parent_id && !item.is_read).length;
      return {
        customerId,
        customerName: latest?.customers?.full_name || 'Unknown',
        customerPhone: latest?.customers?.phone || 'No phone',
        customerEmail: latest?.customers?.email || null,
        items: sorted,
        latest,
        unreadCount,
        effectiveStatus,
        preview: latest?.body || latest?.subject || 'No message',
      };
    }).sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [allComms]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (statusFilter !== 'all' && thread.effectiveStatus !== statusFilter) return false;
      if (!q) return true;
      return [thread.customerName, thread.customerPhone, thread.customerEmail, thread.preview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [search, statusFilter, threads]);

  const selectedThread = useMemo(
    () => filteredThreads.find((thread) => thread.customerId === selectedThreadId) || filteredThreads[0] || null,
    [filteredThreads, selectedThreadId],
  );

  useEffect(() => {
    if (!selectedThread && selectedThreadId) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThread && filteredThreads.length > 0) {
      setSelectedThreadId(filteredThreads[0].customerId);
    }
  }, [filteredThreads, selectedThread, selectedThreadId]);

  const newCount = filteredThreads.filter((thread) => thread.effectiveStatus === 'pending').length;

  useEffect(() => {
    if (!selectedThread) return;
    const unreadItems = selectedThread.items.filter((item) => !item.parent_id && !item.is_read);
    if (unreadItems.length === 0) return;

    void Promise.all(
      unreadItems.map((item) =>
        apiPatch(`/api/communications/${encodeURIComponent(item.id)}`, {
          is_read: true,
          read_at: new Date().toISOString(),
        }),
      ),
    ).then(() => {
      setAllComms((prev) => prev.map((item) =>
        unreadItems.some((candidate) => candidate.id === item.id)
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item,
      ));
    }).catch(() => null);
  }, [selectedThread]);

  const handleReply = async () => {
    if (!selectedThread) return;

    const parts = [replyText.trim()];
    if (linkToShare.trim()) parts.push(`Link: ${linkToShare.trim()}`);
    if (imageUrlToShare.trim()) parts.push(`Image: ${imageUrlToShare.trim()}`);

    const finalMessage = parts.filter(Boolean).join('\n\n').trim();
    if (!finalMessage) return;

    setReplying(true);
    try {
      const rootMessage = selectedThread.items.find((item) => !item.parent_id) || selectedThread.latest;
      const recipientEmail = selectedThread.customerEmail || rootMessage.sent_to;
      const inserted = await apiPost<any>('/api/communications', {
        customer_id: selectedThread.customerId,
        type: 'email',
        purpose: 'follow_up',
        sent_to: recipientEmail,
        subject: `Re: ${rootMessage.subject || 'Website Enquiry'}`,
        body: finalMessage,
        status: 'pending',
        parent_id: rootMessage.id,
        is_read: true,
        read_at: new Date().toISOString(),
      });
      if (!inserted?.id) throw new Error('Failed to create follow-up communication');

      if (selectedThread.customerEmail) {
        let emailError: unknown = null;
        try {
          await sendTransactionalEmail({
            templateName: 'sales-follow-up',
            recipientEmail: selectedThread.customerEmail,
            idempotencyKey: `follow-up-${inserted.id}`,
            templateData: {
              customerName: selectedThread.customerName,
              message: finalMessage,
            },
          });
        } catch (error) {
          emailError = error;
        }

        if (emailError) {
          await apiPatch(`/api/communications/${encodeURIComponent(inserted.id)}`, { status: 'failed' });
          throw emailError;
        }

        await apiPatch(`/api/communications/${encodeURIComponent(inserted.id)}`, { status: 'sent', sent_at: new Date().toISOString() });
      }

      toast.success('Reply added to thread');
      if (profile?.user_id) {
        void logStaffActivity({
          userId: profile.user_id, profileId: profile.id, locationId: profile.location_id, role: role as any,
          eventType: 'enquiry_replied',
          label: `Replied to enquiry from ${selectedThread.customerName ?? recipientEmail}`,
          route: '/enquiries',
          metadata: { communicationId: inserted.id, customerId: selectedThread.customerId, customerName: selectedThread.customerName ?? null, sentTo: selectedThread.customerEmail ?? recipientEmail },
        });
      }
      setReplyText('');
      setLinkToShare('');
      setImageUrlToShare('');
      fetchEnquiries();
    } catch {
      toast.error('Failed to send follow-up reply');
    } finally {
      setReplying(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!selectedThread) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WEBP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or less');
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `chat-media/${selectedThread.customerId}/${Date.now()}.${ext}`;

      await uploadToStorage('documents', path, file);
      const publicUrl = await getStoragePublicUrl('documents', path);
      setImageUrlToShare(publicUrl);
      toast.success('Image ready to send');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const extractUrls = (text?: string | null) => {
    if (!text) return [] as string[];
    const matches = text.match(/https?:\/\/[^\s]+/g);
    return matches || [];
  };

  const isImageUrl = (url: string) => /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url);

  const selectedRootMessage = selectedThread?.items.find((item) => !item.parent_id) || selectedThread?.latest || null;
  const replyCount = selectedRootMessage ? getReplies(selectedRootMessage.id).length : 0;

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
                {role === APP_ROLE.SALES
                  ? 'Showing only contacts from your assigned test drives'
                  : (newCount > 0 ? `${newCount} new enquir${newCount === 1 ? 'y' : 'ies'}` : 'No new enquiries')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {role === APP_ROLE.SALES && salesLocations.length > 1 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[170px] rounded-xl">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {salesLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

        {loading ? (
          <LoadingState message="Loading enquiries..." className="py-16" />
        ) : filteredThreads.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No enquiries found</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <Card className="shadow-card order-2 xl:order-1">
              <CardContent className="p-0">
                {selectedThread ? (
                  <div className="flex min-h-[720px] flex-col">
                    <div className="border-b border-border px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-lg font-heading font-bold text-foreground">{selectedThread.customerName}</h2>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedThread.customerPhone}</span>
                              {selectedThread.customerEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedThread.customerEmail}</span>}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={(statusBadge[selectedThread.effectiveStatus] || statusBadge.pending).className}>
                          {(statusBadge[selectedThread.effectiveStatus] || statusBadge.pending).label}
                        </Badge>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 px-4 py-4">
                      <div className="space-y-3">
                        {selectedThread.items.map((message) => {
                          const isReply = Boolean(message.parent_id);
                          const urls = extractUrls(message.body);
                          const authorLabel = isReply ? 'Sales team' : selectedThread.customerName;
                          return (
                            <div key={message.id} className={`flex ${isReply ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-3xl border px-4 py-3 shadow-sm ${isReply ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                                <div className="mb-1 flex items-center justify-between gap-3">
                                  <span className={`text-[11px] font-semibold ${isReply ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{authorLabel}</span>
                                  <span className={`text-[10px] ${isReply ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {format(new Date(message.created_at), 'dd MMM, h:mm a')}
                                  </span>
                                </div>
                                <p className={`whitespace-pre-wrap text-sm ${isReply ? 'text-primary-foreground' : 'text-foreground'}`}>{message.body || 'No message'}</p>
                                {urls.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {urls.map((url) => (
                                      <div key={url}>
                                        {isImageUrl(url) ? (
                                          <img src={url} alt="Shared" className="max-h-56 rounded-xl border border-border/30" />
                                        ) : (
                                          <a href={url} target="_blank" rel="noopener noreferrer" className={`break-all text-xs underline ${isReply ? 'text-primary-foreground' : 'text-primary'}`}>
                                            {url}
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {editingMessageId === message.id ? (
                                  <div className="mt-3 space-y-2">
                                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[90px] bg-background text-foreground" maxLength={2000} />
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" onClick={saveEditedMessage} loading={savingEdit} loadingText="Saving..." disabled={savingEdit || !editText.trim()}>
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={cancelEditMessage}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : isReply ? (
                                  <div className="mt-3 flex justify-end">
                                    <Button size="sm" variant="outline" className="h-7 rounded-full border-white/25 bg-transparent text-xs text-primary-foreground hover:bg-white/10" onClick={() => startEditMessage(message)}>
                                      Edit
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    <div className="border-t border-border px-4 py-4">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleQuickTemplate('booking')}>
                          Share Booking Link
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleQuickTemplate('map')}>
                          Share Map Link
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleQuickTemplate('brochure')}>
                          Share Brochure Link
                        </Button>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
                        <Textarea
                          placeholder="Reply to this enquiry thread..."
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          className="min-h-[90px] rounded-2xl border-0 bg-background"
                          maxLength={2000}
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Link2 className="h-3.5 w-3.5" /> Share Link
                            </label>
                            <Input value={linkToShare} onChange={e => setLinkToShare(e.target.value)} placeholder="https://..." className="h-9 rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="chat-image-upload" className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ImagePlus className="h-3.5 w-3.5" /> Share Image
                            </label>
                            <Input id="chat-image-upload" type="file" accept="image/jpeg,image/png,image/webp" className="h-9 rounded-xl" disabled={uploadingImage} onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                            }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <PanelRightOpen className="h-3.5 w-3.5" />
                            {replyCount} repl{replyCount === 1 ? 'y' : 'ies'} in thread
                          </div>
                          <Button
                            onClick={handleReply}
                            loading={replying || uploadingImage}
                            loadingText={replying ? 'Sending...' : 'Uploading image...'}
                            disabled={replying || uploadingImage || (!replyText.trim() && !linkToShare.trim() && !imageUrlToShare.trim())}
                            className="gradient-primary rounded-xl border-0 text-primary-foreground"
                          >
                            <Send className="mr-2 h-4 w-4" />Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="shadow-card order-1 xl:order-2">
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Inbox List</p>
                      <p className="text-xs text-muted-foreground">One record per customer thread</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{filteredThreads.length}</Badge>
                  </div>
                </div>
                <ScrollArea className="h-[720px]">
                  <div className="space-y-2 p-3">
                    {filteredThreads.map((thread) => {
                      const badge = statusBadge[thread.effectiveStatus] || statusBadge.pending;
                      const isActive = selectedThread?.customerId === thread.customerId;
                      return (
                        <button
                          key={thread.customerId}
                          type="button"
                          onClick={() => setSelectedThreadId(thread.customerId)}
                          className={`w-full rounded-2xl border p-3 text-left transition-all duration-200 ${isActive ? 'border-primary/40 bg-primary/10 shadow-sm' : 'border-border bg-card hover:border-primary/20 hover:bg-muted/30'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <User className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate font-semibold text-foreground">{thread.customerName}</p>
                                    {thread.unreadCount > 0 && <CircleDot className="h-3.5 w-3.5 shrink-0 text-warning" />}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">{thread.customerPhone}</p>
                                </div>
                              </div>
                              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{thread.preview}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                              {thread.unreadCount > 0 ? (
                                <Badge className="bg-warning/10 text-warning">{thread.unreadCount} new</Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Read</span>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{thread.items.length} messages</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(thread.latest.created_at), 'dd MMM, h:mm a')}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EnquiriesPage;

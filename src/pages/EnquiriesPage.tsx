import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Inbox, Search, MessageSquare, Phone, Mail, Clock, User, Send, Reply, Link2, ImagePlus } from 'lucide-react';
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
  const { role, profile } = useAuth();
  const [allComms, setAllComms] = useState<Enquiry[]>([]);
  const [salesLocations, setSalesLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Enquiry | null>(null);
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
          metadata: { communicationId: editingMessageId, customerId: selected?.customer_id ?? null },
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
    if (!selected) return;

    const parts = [replyText.trim()];
    if (linkToShare.trim()) parts.push(`Link: ${linkToShare.trim()}`);
    if (imageUrlToShare.trim()) parts.push(`Image: ${imageUrlToShare.trim()}`);

    const finalMessage = parts.filter(Boolean).join('\n\n').trim();
    if (!finalMessage) return;

    setReplying(true);
    try {
      const recipientEmail = selected.customers?.email || selected.sent_to;
      const inserted = await apiPost<any>('/api/communications', {
        customer_id: selected.customer_id,
        type: 'email',
        purpose: 'follow_up',
        sent_to: recipientEmail,
        subject: `Re: ${selected.subject || 'Website Enquiry'}`,
        body: finalMessage,
        status: 'pending',
        parent_id: selected.id,
      });
      if (!inserted?.id) throw new Error('Failed to create follow-up communication');

      if (selected.customers?.email) {
        let emailError: unknown = null;
        try {
          await sendTransactionalEmail({
            templateName: 'sales-follow-up',
            recipientEmail: selected.customers.email,
            idempotencyKey: `follow-up-${inserted.id}`,
            templateData: {
              customerName: selected.customers.full_name,
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
          label: `Replied to enquiry from ${selected.customers?.full_name ?? selected.sent_to}`,
          route: '/enquiries',
          metadata: { communicationId: inserted.id, customerId: selected.customer_id, customerName: selected.customers?.full_name ?? null, sentTo: selected.customers?.email ?? selected.sent_to },
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
    if (!selected) return;

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
      const path = `chat-media/${selected.customer_id}/${Date.now()}.${ext}`;

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
                  {[selected, ...getReplies(selected.id)].map(message => (
                    <div key={message.id} className={`p-3 rounded-xl border ${message.parent_id ? 'bg-primary/5 border-primary/10 ml-4' : 'bg-muted/50 border-border'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium flex items-center gap-1 ${message.parent_id ? 'text-primary' : 'text-foreground'}`}>
                          {message.parent_id ? <Reply className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {message.parent_id ? 'Staff Reply' : selected.customers?.full_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(message.created_at), "dd MMM yyyy, h:mm a")}
                        </span>
                      </div>

                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="min-h-[80px]"
                            maxLength={2000}
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={saveEditedMessage} disabled={savingEdit || !editText.trim()}>
                              {savingEdit ? 'Saving...' : 'Save'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditMessage}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{message.body || 'No message'}</p>
                          {extractUrls(message.body).length > 0 && (
                            <div className="mt-2 space-y-2">
                              {extractUrls(message.body).map((url) => (
                                <div key={url}>
                                  {isImageUrl(url) ? (
                                    <img src={url} alt="Shared" className="max-h-40 rounded-md border border-border" />
                                  ) : (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">
                                      {url}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEditMessage(message)}>
                              Edit
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply input */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => handleQuickTemplate('booking')}
                  >
                    Share Booking Link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => handleQuickTemplate('map')}
                  >
                    Share Map Link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => handleQuickTemplate('brochure')}
                  >
                    Share Brochure Link
                  </Button>
                </div>
                <Textarea
                  placeholder="Type your reply…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="rounded-xl min-h-[70px]"
                  maxLength={2000}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" /> Share Link
                    </label>
                    <Input
                      value={linkToShare}
                      onChange={e => setLinkToShare(e.target.value)}
                      placeholder="https://..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="chat-image-upload" className="text-xs text-muted-foreground flex items-center gap-1">
                      <ImagePlus className="h-3.5 w-3.5" /> Share Image
                    </label>
                    <Input
                      id="chat-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="h-9"
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </div>
                </div>
                {imageUrlToShare && (
                  <div className="text-xs text-success">
                    Image attached successfully.
                  </div>
                )}
                <Button
                  onClick={handleReply}
                  disabled={replying || uploadingImage || (!replyText.trim() && !linkToShare.trim() && !imageUrlToShare.trim())}
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

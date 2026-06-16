import { useState } from 'react';
import { MessageCircle, X, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { apiDbQuery, apiPost } from '@/lib/apiClient';
import { toast } from 'sonner';

const EnquiryWidget = () => {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast.error('Please fill in name, phone and message');
      return;
    }

    setLoading(true);
    try {
      // Find or create customer, then log as a communication
      let customers = await apiDbQuery<any[]>({
        table: 'customers',
        action: 'select',
        select: 'id',
        filters: [{ field: 'phone', op: 'eq', value: form.phone.trim() }],
        limit: 1,
      });

      let customer = customers?.[0] || null;
      if (!customer) {
        const newCustomers = await apiDbQuery<any[]>({
          table: 'customers',
          action: 'insert',
          values: { full_name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null },
        });
        customer = newCustomers?.[0] || null;
      }

      if (!customer?.id) throw new Error('Failed to create/find customer');

      await apiPost('/api/communications', {
          customer_id: customer.id,
          type: 'email',
          purpose: 'custom',
          sent_to: form.email.trim() || form.phone.trim(),
          subject: 'Website Enquiry',
          body: form.message.trim(),
          status: 'pending',
        });

      setSubmitted(true);
      setForm({ name: '', phone: '', email: '', message: '' });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => { setOpen(true); setSubmitted(false); }}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-info shadow-xl shadow-accent/30 flex items-center justify-center hover:shadow-2xl hover:shadow-accent/40 transition-shadow"
          >
            <MessageCircle className="h-6 w-6 text-accent-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-elevated overflow-hidden"
          >
            {/* Header */}
            <div className="gradient-dark  backdrop-blur border-t border-white/10 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-primary-foreground font-heading font-semibold text-sm">Need Help?</h3>
                <p className="text-primary-foreground/60 text-xs mt-0.5">Send us your enquiry</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {submitted ? (
                <div className="text-center py-8 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                  </div>
                  <h4 className="font-heading font-semibold text-foreground">Thank You!</h4>
                  <p className="text-sm text-muted-foreground">We've received your enquiry and will get back to you shortly.</p>
                  <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSubmitted(false); }} className="mt-2 rounded-xl">
                    Close
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    placeholder="Your Name *"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="rounded-xl text-sm"
                    maxLength={100}
                    required
                  />
                  <Input
                    placeholder="Phone Number *"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="rounded-xl text-sm"
                    maxLength={20}
                    required
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="rounded-xl text-sm"
                    maxLength={255}
                  />
                  <Textarea
                    placeholder="How can we help you? *"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="rounded-xl text-sm min-h-[80px]"
                    maxLength={1000}
                    required
                  />
                  <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground rounded-xl font-semibold">
                    {loading ? 'Sending…' : <>Send Enquiry <Send className="ml-2 h-4 w-4" /></>}
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EnquiryWidget;

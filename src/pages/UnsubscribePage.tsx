import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailX, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { handleEmailUnsubscribe } from '@/lib/functionService';

type Status = 'loading' | 'valid' | 'already_unsubscribed' | 'invalid' | 'success' | 'error';

const UnsubscribePage = () => {
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tokenFromUrl = new URLSearchParams(window.location.search).get('token');
    setToken(tokenFromUrl);
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setStatus('invalid');
      return;
    }

    handleEmailUnsubscribe({ token })
      .then((data) => {
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setStatus('already_unsubscribed');
        } else if (data.valid) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const data = await handleEmailUnsubscribe({ token: token || undefined });
      setStatus(data?.success ? 'success' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  const content: Record<Status, { icon: React.ReactNode; title: string; desc: string }> = {
    loading: { icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />, title: 'Verifying…', desc: 'Please wait while we verify your request.' },
    valid: { icon: <MailX className="h-8 w-8 text-destructive" />, title: 'Unsubscribe', desc: 'Click below to unsubscribe from future emails.' },
    already_unsubscribed: { icon: <CheckCircle className="h-8 w-8 text-muted-foreground" />, title: 'Already Unsubscribed', desc: 'You have already been unsubscribed from our emails.' },
    success: { icon: <CheckCircle className="h-8 w-8 text-success" />, title: 'Unsubscribed', desc: 'You will no longer receive emails from us.' },
    invalid: { icon: <AlertCircle className="h-8 w-8 text-destructive" />, title: 'Invalid Link', desc: 'This unsubscribe link is invalid or has expired.' },
    error: { icon: <AlertCircle className="h-8 w-8 text-destructive" />, title: 'Something Went Wrong', desc: 'Please try again later.' },
  };

  const c = content[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            {c.icon}
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground">{c.title}</h1>
          <p className="text-muted-foreground">{c.desc}</p>
          {status === 'valid' && (
            <Button variant="destructive" onClick={handleUnsubscribe} disabled={processing} className="w-full">
              {processing ? 'Processing…' : 'Confirm Unsubscribe'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnsubscribePage;

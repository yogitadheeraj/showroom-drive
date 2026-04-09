import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, BadgeCheck, Bell, Building2, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [canOpenLeadPage, setCanOpenLeadPage] = useState(false);
  const { signIn, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logoUrl = 'https://res.cloudinary.com/totalesworld/image/upload/v1774900050/logo_acnpcu_Nero_AI_Background_Remover_transparent_1_srpzwi.png';

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setCanOpenLeadPage(Boolean(data.session));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCanOpenLeadPage(Boolean(session));
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!canOpenLeadPage) return;

    const channel = supabase
      .channel('auth-page-lead-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_drives',
        },
        () => {
          setNewLeadCount((count) => Math.min(count + 1, 99));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canOpenLeadPage]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Sign in failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({ title: 'Email required', description: 'Enter your signup email first.', variant: 'destructive' });
      return;
    }

    setIsResending(true);
    try {
      // Check if user/profile exists before attempting resend
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (!existingProfile) {
        toast({
          title: 'User not found',
          description: 'No account exists with this email. Please sign up first.',
          variant: 'destructive',
        });
        setIsResending(false);
        return;
      }

      await resendVerificationEmail(normalizedEmail);
      toast({
        title: 'Verification email sent',
        description: 'Please check inbox and spam. Delivery should start immediately now.',
      });
    } catch (err: any) {
      toast({ title: 'Resend failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  const handleOpenLeadNotifications = () => {
    if (!canOpenLeadPage) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to open Test Drives notifications.',
        variant: 'destructive',
      });
      return;
    }

    setNewLeadCount(0);
    navigate('/test-drives');
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full">
       
          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl animate-fade-in space-y-5">
              <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/85 shadow-[0_24px_80px_-24px_rgba(17,42,74,0.28)] backdrop-blur-md">
                <CardHeader className="space-y-4 border-b border-border/60 bg-white/70 px-6 pb-5 pt-7 sm:px-8">
                  <div className="flex items-center gap-5">
                   <a href="/" >

                        <div className="flex items-center justify-center py-1">
                            <img src="/images/auth_logo.png" alt="Logo" className="h-[50px] w-full" />
                        </div>
                    </a>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Auto Advant</p>
                      <CardTitle className="font-heading text-3xl font-bold tracking-tight">Welcome back</CardTitle>
                      <CardDescription className="text-sm leading-6 text-muted-foreground">
                        Sign in to manage daily test drives, staff activity, customers, and scheduled reporting.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
                  <div className="space-y-5">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Work Email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="name@dealership.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 rounded-xl bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-12 rounded-xl bg-white"
                        />
                      </div>

                      <Button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] text-primary-foreground hover:bg-primary/90 px-4 py-2 h-12 w-full text-base font-semibold" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Access Auto Advant'}
                        {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </form>

                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                      <p className="text-sm font-medium text-foreground">Need to verify your email?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter your account email above and request another verification message.
                      </p>
                      <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-xl" onClick={handleResendVerification} disabled={isResending}>
                        {isResending ? 'Sending...' : 'Resend Verification Email'}
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={handleOpenLeadNotifications}>
                        <Bell className="mr-2 h-4 w-4" />
                        New Leads
                        {newLeadCount > 0 && (
                          <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                            {newLeadCount > 99 ? '99+' : newLeadCount}
                          </span>
                        )}
                      </Button>
                      <Button asChild variant="link" className="h-11 w-full text-sm text-primary">
                        <Link to="/dealer-onboarding">New dealer? Start onboarding</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

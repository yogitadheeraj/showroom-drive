import { useEffect, useState } from 'react';
import Link from 'next/link';
import HeaderComponents from '@/components/common/HeaderComponents';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BadgeCheck, Bell, Eye, EyeOff, KeyRound, MailCheck, Sparkles, 

  Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Send, Phone, Mail, Warehouse, CreditCard, FileText, Package, Receipt, ClipboardList, Smartphone, FolderOpen, PieChart, DollarSign, ShieldCheck, Tag, Landmark, Layers, Moon, Sun
 } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useWhitelabel } from '@/hooks/useWhitelabel';
import { firebaseAuth, isFirebaseClientConfigured } from '@/integrations/supabase/client';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [canOpenLeadPage, setCanOpenLeadPage] = useState(false);
  const [emailVerifiedBanner, setEmailVerifiedBanner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, resendVerificationEmail, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const brand = useWhitelabel();
  const logoUrl = brand.dealerLogoUrl || '/images/auth_logo.png';
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const resolvedTheme = mounted ? (isDarkMode ? 'dark' : 'light') : 'dark';
   const toggleTheme = () => setIsDarkMode((prev) => !prev);
    const staffEntryPath = '/auth';
const THEME_STORAGE_KEY = 'autoadvant-theme';

  useEffect(() => setMounted(true), []);

      useEffect(() => {
          if (!mounted) return;
          document.documentElement.classList.toggle('dark', isDarkMode);
          document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
          localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
      }, [mounted, isDarkMode]);
  useEffect(() => {
    if (!router.isReady) return;
    const verified = router.query.verified === 'true';
    if (verified) {
      setEmailVerifiedBanner(true);
      // Clean up query param without a full page reload
      const nextQuery = { ...router.query };
      delete nextQuery.verified;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [router.isReady, router.query.verified, router]);
  useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const nextDark = savedTheme ? savedTheme === 'dark' : prefersDark;
        setIsDarkMode(nextDark);
        document.documentElement.classList.toggle('dark', nextDark);
        document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    }, []);
  useEffect(() => {
    setCanOpenLeadPage(!!user);
  }, [user]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'Sign in failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({ title: 'Email required', description: 'Please enter your account email.', variant: 'destructive' });
      return;
    }
    setIsSendingReset(true);
    try {
      if (!firebaseAuth || !isFirebaseClientConfigured) {
        toast({ title: 'Configuration issue', description: 'Authentication is not configured for this environment AUTH.', variant: 'destructive' });
        return;
      }
      await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
      setResetSent(true);
    } catch (err: any) {
      // Always show a generic success message to prevent email enumeration
      setResetSent(true);
    } finally {
      setIsSendingReset(false);
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
      const profile = await apiGet<any>('/api/profiles?email=' + encodeURIComponent(normalizedEmail) + '&limit=1')
        .then((res: any) => (Array.isArray(res) ? res[0] : null))
        .catch(() => null);

      if (!profile) {
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
    router.push('/test-drives');
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* SaaS dark backdrop with subtle grid + glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(213 80% 70% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(213 80% 70% / 0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          }}
        />
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-[hsl(213,90%,55%)]/25 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-[hsl(200,90%,50%)]/20 blur-[160px]" />
        <div className="absolute bottom-[-200px] left-1/3 h-[420px] w-[420px] rounded-full bg-[hsl(260,80%,55%)]/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_minmax(0,560px)] lg:items-center">
          <section className="hidden lg:block">
            <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 p-8 shadow-elevated backdrop-blur-xl">
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-info/20 blur-3xl" />
              <div className="relative space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Operations Workspace
                </div>
                <div className="space-y-3">
                  <h2 className="font-heading text-4xl font-bold leading-tight text-foreground">
                    Modern dealership operations start here
                  </h2>
                  <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                    Manage leads, bookings, service flow, and team activity from one secure control center designed for daily execution.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Lead Actions', value: 'Real-time' },
                    { label: 'Team Access', value: 'Role-based' },
                    { label: 'Audit Trail', value: 'Always on' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/80 bg-background/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    'Customer timeline and communication visibility',
                    'Live operational dashboards for each role',
                    'Secure workflows with verified team access',
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-2 text-sm text-foreground/90">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl animate-fade-in space-y-5">
              <Card className="overflow-hidden rounded-[2rem] border-border bg-card shadow-elevated backdrop-blur-xl text-card-foreground">
                <CardHeader className="space-y-2 border-b border-border bg-card/60 px-6 pb-5 pt-7 sm:px-8">
                  {brand.isBranded ? (
                    <div className="flex items-center gap-3 mb-1">
                      {brand.dealerLogoUrl && (
                        <img src={brand.dealerLogoUrl} alt={brand.dealerName || 'Dealer'} className="h-10 w-auto max-w-[120px] object-contain" />
                      )}
                      {brand.dealerName && (
                        <span className="text-base font-bold text-foreground">{brand.dealerName}</span>
                      )}
                    </div>
                  ) : (
                    <></>
                  )}
                  <CardTitle className="font-heading text-3xl font-bold tracking-tight">Welcome back</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    {brand.isBranded
                      ? `Sign in to your ${brand.dealerName || 'dealership'} portal`
                      : 
                      
                      <div >
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      <BadgeCheck className="h-3.5 w-3.5" />
                     Sign in to your Auto Advant portal - Secure staff access
                    </div>
                  </div>}
                  </CardDescription>
                  
                </CardHeader>

                <CardContent className="px-2 py-2 sm:px-6 sm:py-6">
                  <div className="space-y-5">
                    {/* ── Forgot password mode ── */}
                    {forgotMode ? (
                      <div className="space-y-5">
                        {resetSent ? (
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <MailCheck className="h-12 w-12 text-green-500" />
                            <p className="text-base font-semibold text-foreground">Check your inbox</p>
                            <p className="text-sm text-muted-foreground">
                              If an account exists for <strong>{forgotEmail}</strong>, a password reset link has been sent. Check your spam folder too.
                            </p>
                            <Button variant="outline" className="mt-2 h-11 w-full rounded-xl" onClick={() => { setForgotMode(false); setResetSent(false); setForgotEmail(''); }}>
                              Back to Sign In
                            </Button>
                          </div>
                        ) : (
                          <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">Reset your password</p>
                              <p className="text-sm text-muted-foreground">Enter your account email and we'll send you a reset link.</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="forgot-email">Account Email</Label>
                              <Input
                                id="forgot-email"
                                type="email"
                                placeholder="name@dealership.com"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                required
                                className="h-12 rounded-xl"
                              />
                            </div>
                            <Button type="submit" className="h-12 w-full rounded-2xl font-semibold" loading={isSendingReset} loadingText="Sending..." disabled={isSendingReset}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Send Reset Link
                            </Button>
                            <Button type="button" variant="ghost" className="h-11 w-full text-sm" onClick={() => { setForgotMode(false); setForgotEmail(''); }}>
                              ← Back to Sign In
                            </Button>
                          </form>
                        )}
                      </div>
                    ) : (
                      /* ── Normal sign in mode ── */
                      <>
                        {emailVerifiedBanner && (
                          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/40">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                            <div>
                              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Email verified!</p>
                              <p className="text-sm text-green-700 dark:text-green-400">Your email address has been confirmed. You can now sign in below.</p>
                            </div>
                          </div>
                        )}
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
                              className="h-12 rounded-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="signin-password">Password</Label>
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() => { setForgotEmail(email); setForgotMode(true); setResetSent(false); }}
                              >
                                Forgot password?
                              </button>
                            </div>
                            <div className="relative">
                              <Input
                                id="signin-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12 rounded-xl pr-12"
                              />
                              <button
                                type="button"
                                tabIndex={-1}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>

                          <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" loading={isLoading} loadingText="Signing in..." disabled={isLoading}>
                            Access Auto Advant
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </form>

                        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                          <p className="text-sm font-medium text-foreground">Need to verify your email?</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Enter your account email above and request another verification message.
                          </p>
                          <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-xl" onClick={handleResendVerification} loading={isResending} loadingText="Sending..." disabled={isResending}>
                            Resend Verification Email
                          </Button>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          
                          <Button asChild variant="link" className="h-11 w-full text-sm text-primary">
                              <Link href="/dealer-onboarding">New dealer? Start onboarding</Link>
                          </Button>
                        </div>
                      </>
                    )}
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

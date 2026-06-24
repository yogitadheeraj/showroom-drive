import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, BadgeCheck, Bell, Building2, CheckCircle2, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck, Sparkles } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { useWhitelabel } from '@/hooks/useWhitelabel';
import { ENTITY_ORCHESTRATION } from '@/constants/entityOrchestration';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const brand = useWhitelabel();
  const logoUrl = brand.dealerLogoUrl || '/images/auth_logo.png';

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setEmailVerifiedBanner(true);
      // Clean up query param without a full page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('verified');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    setCanOpenLeadPage(!!user);
  }, [user]);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({ title: 'Email required', description: 'Please enter your account email.', variant: 'destructive' });
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(getAuth(), normalizedEmail);
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
    navigate('/test-drives');
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteHeader variant="landing" dealerName={brand.dealerName} dealerLogoUrl={brand.dealerLogoUrl} />
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
        <div className="grid w-full">
       
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
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Auto Advant</p>
                  )}
                  <CardTitle className="font-heading text-3xl font-bold tracking-tight">Welcome back</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    {brand.isBranded
                      ? `Sign in to your ${brand.dealerName || ENTITY_ORCHESTRATION.dealer.toLowerCase()} portal`
                      : 'Sign in to manage daily test drives, staff activity, customers, and scheduled reporting.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
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
                                placeholder="name@dealer.com"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                required
                                className="h-12 rounded-xl"
                              />
                            </div>
                            <Button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-600 text-white font-semibold" disabled={isSendingReset}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              {isSendingReset ? 'Sending...' : 'Send Reset Link'}
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
                              placeholder="name@dealer.com"
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

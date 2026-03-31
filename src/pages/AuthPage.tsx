import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, BadgeCheck, Building2, ShieldCheck, Sparkles } from 'lucide-react';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { signIn, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logoUrl = 'https://res.cloudinary.com/totalesworld/image/upload/v1774900050/logo_acnpcu_Nero_AI_Background_Remover_transparent_1_srpzwi.png';

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#eef6ff_0%,#f7fbff_38%,#fffdf8_100%)] text-foreground">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <section className="hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(145deg,rgba(40,126,67,0.92),rgba(18,59,110,0.92))] p-8 text-white shadow-[0_30px_90px_-24px_rgba(16,43,79,0.55)] lg:flex lg:min-h-[760px] lg:flex-col lg:justify-between">
            <div className="space-y-8">
              <div>
                <h1 className="font-heading text-3xl font-bold tracking-tight">Professional retail operations for modern showrooms</h1>
              </div>

              <div className="max-w-xl space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/90 backdrop-blur">
                  <Sparkles className="h-4 w-4 text-accent" />
                  One platform for bookings, teams, vehicles, and customer follow-up
                </div>
                <p className="text-5xl font-heading font-bold leading-[1.02] tracking-tight">
                  Make Omni Tracely feel like your premium showroom control room.
                </p>
                <p className="max-w-lg text-base leading-7 text-white/75">
                  Manage scheduled test drives, live operations, staff movement, and report delivery from a single, polished workspace built for dealership teams.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                <BadgeCheck className="mb-4 h-5 w-5 text-accent" />
                <p className="text-2xl font-bold">Fast</p>
                <p className="mt-2 text-sm text-white/70">Instant booking, confirmation, and reporting flows.</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                <Building2 className="mb-4 h-5 w-5 text-accent" />
                <p className="text-2xl font-bold">Unified</p>
                <p className="mt-2 text-sm text-white/70">Dealer locations, teams, and inventory in one system.</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                <ShieldCheck className="mb-4 h-5 w-5 text-accent" />
                <p className="text-2xl font-bold">Trusted</p>
                <p className="mt-2 text-sm text-white/70">Role-based access and operational visibility by design.</p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl animate-fade-in space-y-5">
              <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/85 shadow-[0_24px_80px_-24px_rgba(17,42,74,0.28)] backdrop-blur-md">
                <CardHeader className="space-y-4 border-b border-border/60 bg-white/70 px-6 pb-5 pt-7 sm:px-8">
                  <div className="flex items-center gap-5">
                    <div className="rounded-[1.75rem] bg-white p-4 block">
                      <img src={logoUrl} alt="Omni Tracely logo" className="h-24 w-24 object-contain" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Omni Tracely</p>
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

                      <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Access Omni Tracely'}
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

                    <Button asChild variant="link" className="h-auto w-full text-sm text-primary">
                      <Link to="/dealer-onboarding">New dealer? Start onboarding</Link>
                    </Button>
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

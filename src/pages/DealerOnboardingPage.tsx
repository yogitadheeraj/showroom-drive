import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRpc } from '@/lib/apiClient';
import { authResendSignupVerification, authSignUp } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Network, User, CheckCircle, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { ENTITY_ORCHESTRATION } from '@/constants/entityOrchestration';

const STEPS = [
  { id: 'account', label: 'Admin Account', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'handoff', label: 'Hierarchy Setup', icon: Network },
];

const DealerOnboardingPage = () => {
  const [showPw, setShowPw] = useState({ password: false, confirmPassword: false });

  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accountData, setAccountData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [organizationData, setOrganizationData] = useState({
    name: '',
    code: '',
    type: 'ENTITY',
    country: 'AE',
    contactPhone: '',
  });

  const normalizedOrgCode = useMemo(() => {
    return organizationData.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, '');
  }, [organizationData.code]);

  const verificationRedirectUrl = useMemo(() => {
    const next = `/hierarchy?orgCode=${encodeURIComponent(normalizedOrgCode || 'NEW-ORG')}`;
    return `${window.location.origin}/auth?verified=true&next=${encodeURIComponent(next)}`;
  }, [normalizedOrgCode]);

  const canProceed = () => {
    switch (step) {
      case 0: return accountData.fullName && accountData.email && accountData.password.length >= 6 && accountData.password === accountData.confirmPassword;
      case 1: return organizationData.name && normalizedOrgCode && organizationData.country;
      case 2: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await authSignUp(
        accountData.email,
        accountData.password,
        accountData.fullName,
        verificationRedirectUrl,
      );
      if (authError) {
        if (authError.message === 'UNVERIFIED_EMAIL_EXISTS_RESEND_CONFIRM') {
          const wantsResend = window.confirm(
            'This email is already registered but not verified. Do you want to send the verification email again?',
          );

          if (wantsResend) {
            const { error: resendError } = await authResendSignupVerification(accountData.email, verificationRedirectUrl);

            if (resendError) throw resendError;

            toast({
              title: 'Verification email sent',
              description: 'Please verify your email, then sign in to continue hierarchy setup.',
            });
            navigate(`/auth?next=${encodeURIComponent(`/hierarchy?orgCode=${encodeURIComponent(normalizedOrgCode)}`)}`);
            return;
          }

          throw new Error('Please verify your email first to continue.');
        }

        throw authError;
      }
      if (!authData.user) throw new Error('Account creation failed');

      const userId = authData.user.uid;

      await apiRpc('onboard_entity', {
        _organization_name: organizationData.name,
        _organization_code: normalizedOrgCode,
        _organization_type: organizationData.type,
        _country: organizationData.country,
        _contact_phone: organizationData.contactPhone || null,
        _admin_user_id: userId,
        _full_name: accountData.fullName,
        _email: accountData.email,
      } as any);

      toast({
        title: 'Organization created!',
        description: 'Verify your email, then sign in to continue setup in Hierarchy Management.',
      });
      navigate(`/auth?next=${encodeURIComponent(`/hierarchy?orgCode=${encodeURIComponent(normalizedOrgCode)}`)}`);
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader variant="landing" />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/6 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-info/5 rounded-full blur-[80px]" />
        </div>

      </div>

      {/* Steps */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow-md' :
                    isDone ? 'bg-primary/10 text-primary cursor-pointer' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="font-heading">
              {step === 0 && 'Create Admin Account'}
              {step === 1 && 'Create Organization'}
              {step === 2 && 'Continue In Hierarchy Management'}
            </CardTitle>
            <CardDescription>
              {step === 0 && 'Create the primary admin who will own this organization setup'}
              {step === 1 && 'Start with your top-level organization. The rest of the hierarchy can be configured after sign-in.'}
              {step === 2 && 'After verification and sign-in, you will land in Hierarchy Management with your organization ready to select.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Step 0: Admin Account */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={accountData.fullName} onChange={e => setAccountData(p => ({ ...p, fullName: e.target.value }))} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={accountData.email} onChange={e => setAccountData(p => ({ ...p, email: e.target.value }))} placeholder="admin@dealer.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Input type={showPw.password ? 'text' : 'password'} value={accountData.password} onChange={e => setAccountData(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" className="pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPw(p => ({ ...p, password: !p.password }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <div className="relative">
                      <Input type={showPw.confirmPassword ? 'text' : 'password'} value={accountData.confirmPassword} onChange={e => setAccountData(p => ({ ...p, confirmPassword: e.target.value }))} className="pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPw(p => ({ ...p, confirmPassword: !p.confirmPassword }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {accountData.password && accountData.confirmPassword && accountData.password !== accountData.confirmPassword && (
                  <p className="text-xs text-destructive">Passwords don't match</p>
                )}
              </div>
            )}

            {/* Step 1: Organization Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name *</Label>
                  <Input value={organizationData.name} onChange={e => setOrganizationData(p => ({ ...p, name: e.target.value }))} placeholder="Al Futtaim Automotive" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organization Code *</Label>
                    <Input
                      value={organizationData.code}
                      onChange={e => setOrganizationData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="ALF"
                    />
                    {organizationData.code && organizationData.code !== normalizedOrgCode && (
                      <p className="text-xs text-muted-foreground">Saved as {normalizedOrgCode}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Country *</Label>
                    <Input value={organizationData.country} onChange={e => setOrganizationData(p => ({ ...p, country: e.target.value.toUpperCase() }))} placeholder="AE" maxLength={3} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organization Type *</Label>
                    <select
                      value={organizationData.type}
                      onChange={e => setOrganizationData(p => ({ ...p, type: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md text-sm bg-background"
                    >
                      <option value="ENTITY">ENTITY</option>
                      <option value="GROUP">GROUP</option>
                      <option value="COMPANY">COMPANY</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={organizationData.contactPhone} onChange={e => setOrganizationData(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+971..." />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Handoff */}
            {step === 2 && (
              <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">What happens next</p>
                    <p>1. We create your admin account and top-level organization.</p>
                    <p>2. You verify your email and sign in.</p>
                    <p>3. You land in Hierarchy Management and select <strong className="text-foreground">{organizationData.name || 'your organization'}</strong>.</p>
                    <p>4. Then you continue setting up business units, sales offices, plants, locations, vehicles, and staff roles.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {step === 0 ? 'Home' : 'Back'}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2" size="lg">
                  {isSubmitting ? 'Creating organization...' : 'Create Organization'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DealerOnboardingPage;

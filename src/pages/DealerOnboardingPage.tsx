import { useState } from 'react';
import { apiGet, apiRpc } from '@/lib/apiClient';
import { authResendSignupVerification, authSignUp } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Car, Building2, MapPin, User, CheckCircle, ArrowRight, ArrowLeft, Plus, X, Eye, EyeOff } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { navigateTo } from '@/lib/browserNavigation';

const STEPS = [
  { id: 'account', label: 'Admin Account', icon: User },
  { id: 'entity', label: 'Entity', icon: Building2 },
  { id: 'brands', label: 'Brands', icon: Car },
  { id: 'locations', label: 'Locations', icon: MapPin },
];

interface LocationForm {
  name: string;
  locationCode: string;
  address: string;
  city: string;
}

interface BrandForm {
  name: string;
  code: string;
}

const DealerOnboardingPage = () => {
  const [showPw, setShowPw] = useState({ password: false, confirmPassword: false });

  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accountData, setAccountData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [dealerData, setDealerData] = useState({ name: '', code: '', contactEmail: '' });
  const [brands, setBrands] = useState<BrandForm[]>([{ name: '', code: '' }]);
  const [locationForms, setLocationForms] = useState<LocationForm[]>([
    { name: '', locationCode: '', address: '', city: '' },
  ]);

  const addBrand = () => setBrands(prev => [...prev, { name: '', code: '' }]);
  const removeBrand = (i: number) => setBrands(prev => prev.filter((_, idx) => idx !== i));
  const updateBrand = (i: number, field: keyof BrandForm, val: string) => setBrands(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

  const addLocation = () => setLocationForms(prev => [...prev, { name: '', locationCode: '', address: '', city: '' }]);
  const removeLocation = (i: number) => setLocationForms(prev => prev.filter((_, idx) => idx !== i));
  const updateLocation = (i: number, field: keyof LocationForm, val: string) =>
    setLocationForms(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const canProceed = () => {
    switch (step) {
      case 0: return accountData.fullName && accountData.email && accountData.password.length >= 6 && accountData.password === accountData.confirmPassword;
      case 1: return dealerData.name && dealerData.code && dealerData.contactEmail;
      case 2: return brands.length > 0 && brands.every(b => b.name.trim() && b.code.trim());
      case 3: return locationForms.every(l => l.name && l.locationCode && l.address && l.city);
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Generate slug from admin email to ensure uniqueness
      const emailPrefix = accountData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = emailPrefix || dealerData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Check for duplicate slug before creating anything
      const existingDealers = await apiGet<any[]>(`/api/dealers?slug=${encodeURIComponent(slug)}`);
      const existingDealer = existingDealers?.[0] || null;
      if (existingDealer) {
        throw new Error('A dealership with this email already exists. Please use a different email address.');
      }

      // 1. Create admin account
      const { data: authData, error: authError } = await authSignUp(
        accountData.email,
        accountData.password,
        accountData.fullName
      );
      if (authError) {
        if (authError.message === 'UNVERIFIED_EMAIL_EXISTS_RESEND_CONFIRM') {
          const wantsResend = window.confirm(
            'This email is already registered but not verified. Do you want to send the verification email again?',
          );

          if (wantsResend) {
            const { error: resendError } = await authResendSignupVerification(accountData.email);

            if (resendError) throw resendError;

            toast({
              title: 'Verification email sent',
              description: 'Please verify your email, then login and continue onboarding.',
            });
            return;
          }

          throw new Error('Please verify your email first to continue.');
        }

        throw authError;
      }
      if (!authData.user) throw new Error('Account creation failed');
      const userId = authData.user.uid;

      // 2. Create dealer, brands, and locations via security definer function
      const validBrands = brands
        .map((b) => ({ name: b.name.trim(), code: b.code.trim() }))
        .filter((b) => b.name && b.code);

      await apiRpc('onboard_dealer', {
        _dealer_name: dealerData.name,
        _dealer_code: dealerData.code,
        _slug: slug,
        _contact_email: dealerData.contactEmail,
        _contact_phone: null,
        _admin_user_id: userId,
        _full_name: accountData.fullName,
        _email: accountData.email,
        _business_unit: {
          name: dealerData.name,
          code: dealerData.code,
        },
        _brands: validBrands,
        _locations: locationForms.map(loc => ({
          name: loc.name,
          locationCode: loc.locationCode,
          externalLocationId: null,
          address: loc.address,
          city: loc.city,
          state: '',
          phone: '',
          email: '',
          salesOfficeName: `${loc.name} Sales Office`,
          salesOfficeCode: `${loc.locationCode}_SO`,
          externalSalesOfficeId: null,
          plantName: `${loc.name} Plant`,
          plantCode: `${loc.locationCode}_PL`,
          externalPlantId: null,
        })),
      } as any);

      toast({ title: 'Dealership created!', description: 'Please check your email to verify your account, then log in.' });
      navigateTo('/auth');
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SiteHeader variant="landing" />

      {/* Hero banner */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-30%] left-[-10%] w-[500px] h-[500px] bg-primary/6 rounded-full blur-[130px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
            <Building2 className="h-3.5 w-3.5" /> Entity Onboarding
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Get started in minutes</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Set up your organization, add your brands, and configure your first location.</p>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="relative flex items-center justify-between mb-8">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-5 h-0.5 bg-border z-0" />
          <div
            className="absolute left-0 top-5 h-0.5 bg-primary z-0 transition-all duration-500"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={s.id}
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="relative z-10 flex flex-col items-center gap-1.5 group disabled:cursor-not-allowed"
              >
                <span className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-all duration-200 font-bold text-sm
                  ${isActive ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110' :
                    isDone  ? 'border-primary bg-primary/10 text-primary cursor-pointer' :
                              'border-border bg-background text-muted-foreground'}`}>
                  {isDone ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className={`text-[11px] font-medium hidden sm:block transition-colors
                  ${isActive ? 'text-primary' : isDone ? 'text-primary/70' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16">
        <Card className="shadow-elevated border-border/70">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                {step === 0 && <User className="h-5 w-5 text-primary" />}
                {step === 1 && <Building2 className="h-5 w-5 text-primary" />}
                {step === 2 && <Car className="h-5 w-5 text-primary" />}
                {step === 3 && <MapPin className="h-5 w-5 text-primary" />}
              </span>
              <div>
                <CardTitle className="font-heading text-lg">
                  {step === 0 && 'Create Admin Account'}
                  {step === 1 && 'Entity Details'}
                  {step === 2 && 'Add Your Brands'}
                  {step === 3 && 'Add a Location'}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {step === 0 && 'This will be the master admin account for your entity'}
                  {step === 1 && 'Tell us about your organization'}
                  {step === 2 && 'Which vehicle brands do you sell?'}
                  {step === 3 && 'Add at least one showroom location'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Step 0: Admin Account */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                  <Input value={accountData.fullName} onChange={e => setAccountData(p => ({ ...p, fullName: e.target.value }))} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={accountData.email} onChange={e => setAccountData(p => ({ ...p, email: e.target.value }))} placeholder="admin@dealer.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input type={showPw.password ? 'text' : 'password'} value={accountData.password} onChange={e => setAccountData(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" className="pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPw(p => ({ ...p, password: !p.password }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm Password <span className="text-destructive">*</span></Label>
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

            {/* Step 1: Entity Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name <span className="text-destructive">*</span></Label>
                  <Input value={dealerData.name} onChange={e => setDealerData(p => ({ ...p, name: e.target.value }))} placeholder="ABC Motors" />
                </div>
                <div className="space-y-2">
                  <Label>Organization Code <span className="text-destructive">*</span></Label>
                  <Input value={dealerData.code} onChange={e => setDealerData(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="ABCMOTORS" />
                  <p className="text-xs text-muted-foreground">Short identifier used across the system. Uppercase letters only.</p>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={dealerData.contactEmail} onChange={e => setDealerData(p => ({ ...p, contactEmail: e.target.value }))} placeholder="info@organization.com" />
                </div>
              </div>
            )}

            {/* Step 2: Brands */}
            {step === 2 && (
              <div className="space-y-4">
                {brands.map((brand, i) => (
                  <div key={i} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-7">
                      <Input value={brand.name} onChange={e => updateBrand(i, 'name', e.target.value)} placeholder={`Brand ${i + 1} Name (e.g. Toyota)`} />
                    </div>
                    <div className="col-span-4">
                      <Input value={brand.code} onChange={e => updateBrand(i, 'code', e.target.value.toUpperCase())} placeholder="Code (e.g. TOY)" />
                    </div>
                    {brands.length > 1 && (
                      <button onClick={() => removeBrand(i)} className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors col-span-1">
                        <X className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addBrand} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Another Brand
                </Button>
              </div>
            )}

            {/* Step 3: Locations */}
            {step === 3 && (
              <div className="space-y-6">
                {locationForms.map((loc, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Location {i + 1}</h4>
                      {locationForms.length > 1 && (
                        <button onClick={() => removeLocation(i)} className="text-xs text-destructive hover:underline">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location Name <span className="text-destructive">*</span></Label>
                        <Input value={loc.name} onChange={e => updateLocation(i, 'name', e.target.value)} placeholder="Downtown Showroom" />
                      </div>
                      <div className="space-y-2">
                        <Label>Location Code <span className="text-destructive">*</span></Label>
                        <Input value={loc.locationCode} onChange={e => updateLocation(i, 'locationCode', e.target.value.toUpperCase())} placeholder="DXB_01" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address <span className="text-destructive">*</span></Label>
                      <Input value={loc.address} onChange={e => updateLocation(i, 'address', e.target.value)} placeholder="123 Main Street" />
                    </div>
                    <div className="space-y-2">
                      <Label>City <span className="text-destructive">*</span></Label>
                      <Input value={loc.city} onChange={e => updateLocation(i, 'city', e.target.value)} placeholder="Dubai" />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLocation} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Another Location
                </Button>
                <p className="text-xs text-muted-foreground">You can add more details (Business Units, Sales Offices, Plants) from Settings after setup.</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-5 border-t border-border/50">
              <Button variant="outline" onClick={() => step === 0 ? navigateTo('/') : setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {step === 0 ? 'Home' : 'Back'}
              </Button>
              <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()} className="gradient-primary border-0 text-primary-foreground gap-2" size="lg">
                  {isSubmitting ? 'Setting up...' : 'Complete Setup'} {!isSubmitting && <CheckCircle className="h-4 w-4" />}
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

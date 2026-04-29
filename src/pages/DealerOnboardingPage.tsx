import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Car, Building2, MapPin, User, CheckCircle, ArrowRight, ArrowLeft, Plus, X, Menu } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

const STEPS = [
  { id: 'account', label: 'Admin Account', icon: User },
  { id: 'dealer', label: 'Dealership', icon: Building2 },
  { id: 'brands', label: 'Brands', icon: Car },
  { id: 'locations', label: 'Locations', icon: MapPin },
];

interface LocationForm {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

const DealerOnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accountData, setAccountData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [dealerData, setDealerData] = useState({ name: '', contactEmail: '', contactPhone: '' });
  const [brands, setBrands] = useState<string[]>(['']);
  const [locationForms, setLocationForms] = useState<LocationForm[]>([
    { name: '', address: '', city: '', state: '', phone: '', email: '' },
  ]);

  const addBrand = () => setBrands(prev => [...prev, '']);
  const removeBrand = (i: number) => setBrands(prev => prev.filter((_, idx) => idx !== i));
  const updateBrand = (i: number, val: string) => setBrands(prev => prev.map((b, idx) => idx === i ? val : b));

  const addLocation = () => setLocationForms(prev => [...prev, { name: '', address: '', city: '', state: '', phone: '', email: '' }]);
  const removeLocation = (i: number) => setLocationForms(prev => prev.filter((_, idx) => idx !== i));
  const updateLocation = (i: number, field: keyof LocationForm, val: string) =>
    setLocationForms(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const canProceed = () => {
    switch (step) {
      case 0: return accountData.fullName && accountData.email && accountData.password.length >= 6 && accountData.password === accountData.confirmPassword;
      case 1: return dealerData.name && dealerData.contactEmail;
      case 2: return brands.filter(b => b.trim()).length > 0;
      case 3: return locationForms.every(l => l.name && l.address && l.city);
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
      const { data: existingDealer } = await supabase
        .from('dealers')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existingDealer) {
        throw new Error('A dealership with this email already exists. Please use a different email address.');
      }

      // 1. Create admin account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: { data: { full_name: accountData.fullName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Account creation failed');

      const userId = authData.user.id;

      // 2. Create dealer, brands, and locations via security definer function
      const validBrands = brands.filter(b => b.trim());

      const { error: onboardError } = await supabase.rpc('onboard_dealer', {
        _dealer_name: dealerData.name,
        _slug: slug,
        _contact_email: dealerData.contactEmail,
        _contact_phone: dealerData.contactPhone || null,
        _admin_user_id: userId,
        _brands: validBrands,
        _locations: locationForms.map(loc => ({
          name: loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state || '',
          phone: loc.phone || '',
          email: loc.email || '',
        })),
      } as any);
      if (onboardError) throw onboardError;

      toast({ title: 'Dealership created!', description: 'Please check your email to verify your account, then log in.' });
      navigate('/auth');
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader variant="landing" />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/6 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-info/5 rounded-full blur-[80px]" />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-2 flex items-center justify-between">
            <a href="/" >
          <div className="flex items-center justify-center py-1">
            <img src="/images/autoadvant-logo.png" alt="Auto Advant logo" className="h-[50px] w-full" />
          </div>
 </a>
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="primary text-white rounded-xl font-semibold shadow-lg hover:bg-primary-foreground/90 hover:text-black/90 transition-all px-5">
                Staff Login →
              </Button>
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-primary-foreground/10 text-primary-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="relative z-20 lg:hidden px-4 pb-4 space-y-2">
            <Link to="/compare" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-info text-info-foreground rounded-xl font-semibold hover:bg-info/90 justify-start gap-2 h-11">
                <Car className="h-4 w-4" /> Compare Vehicles
              </Button>
            </Link>
            <Link to="/book" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full gradient-accent border-0 text-accent-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
                🚗 Book Test Drive
              </Button>
            </Link>
            <Link to="/dealer-onboarding" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-success text-success-foreground rounded-xl font-semibold hover:bg-success/90 justify-start gap-2 h-11 mt-2">
                <Building2 className="h-4 w-4" /> For Dealers
              </Button>
            </Link>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-primary-foreground text-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
                Staff Login →
              </Button>
            </Link>
          </div>
        )}
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
              {step === 1 && 'Dealership Details'}
              {step === 2 && 'Add Your Brands'}
              {step === 3 && 'Setup Locations'}
            </CardTitle>
            <CardDescription>
              {step === 0 && 'This will be the master admin account for your dealership'}
              {step === 1 && 'Tell us about your dealership'}
              {step === 2 && 'Which vehicle brands do you sell?'}
              {step === 3 && 'Add your showroom locations'}
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
                    <Input type="password" value={accountData.password} onChange={e => setAccountData(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <Input type="password" value={accountData.confirmPassword} onChange={e => setAccountData(p => ({ ...p, confirmPassword: e.target.value }))} />
                  </div>
                </div>
                {accountData.password && accountData.confirmPassword && accountData.password !== accountData.confirmPassword && (
                  <p className="text-xs text-destructive">Passwords don't match</p>
                )}
              </div>
            )}

            {/* Step 1: Dealer Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Dealership Name *</Label>
                  <Input value={dealerData.name} onChange={e => setDealerData(p => ({ ...p, name: e.target.value }))} placeholder="ABC Motors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email *</Label>
                    <Input type="email" value={dealerData.contactEmail} onChange={e => setDealerData(p => ({ ...p, contactEmail: e.target.value }))} placeholder="info@dealer.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={dealerData.contactPhone} onChange={e => setDealerData(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+91 98765 43210" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Brands */}
            {step === 2 && (
              <div className="space-y-4">
                {brands.map((brand, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Input value={brand} onChange={e => updateBrand(i, e.target.value)} placeholder={`Brand ${i + 1} (e.g. Toyota, BMW)`} />
                    {brands.length > 1 && (
                      <button onClick={() => removeBrand(i)} className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
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
                  <div key={i} className="p-4 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Location {i + 1}</h4>
                      {locationForms.length > 1 && (
                        <button onClick={() => removeLocation(i)} className="text-xs text-destructive hover:underline">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location Name *</Label>
                        <Input value={loc.name} onChange={e => updateLocation(i, 'name', e.target.value)} placeholder="Downtown Showroom" />
                      </div>
                      <div className="space-y-2">
                        <Label>City *</Label>
                        <Input value={loc.city} onChange={e => updateLocation(i, 'city', e.target.value)} placeholder="Mumbai" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address *</Label>
                      <Input value={loc.address} onChange={e => updateLocation(i, 'address', e.target.value)} placeholder="123 Main Street" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input value={loc.state} onChange={e => updateLocation(i, 'state', e.target.value)} placeholder="Maharashtra" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={loc.phone} onChange={e => updateLocation(i, 'phone', e.target.value)} placeholder="+91..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={loc.email} onChange={e => updateLocation(i, 'email', e.target.value)} placeholder="location@..." />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLocation} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Another Location
                </Button>
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
                  {isSubmitting ? 'Setting up...' : 'Complete Setup'}
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

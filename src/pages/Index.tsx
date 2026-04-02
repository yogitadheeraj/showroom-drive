import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Send, Phone, Mail } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import EnquiryWidget from '@/components/EnquiryWidget';
import { toast } from 'sonner';
import showcaseAdminDashboard from '@/assets/showcase-admin-dashboard.jpg';
import showcaseBooking from '@/assets/showcase-booking.jpg';
import showcaseGroAssign from '@/assets/showcase-gro-assign.jpg';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

type HomeBrandCard = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  dealerName: string;
  dealerPhone: string | null;
  dealerEmail: string | null;
  models: Array<{ name: string; vehicleId: string | null }>;
  recommendedModels: Array<{ name: string; brand: string }>;
};

const BrandMarketplace = () => {
  const [brandCards, setBrandCards] = useState<HomeBrandCard[]>([]);
  const [selectedBrandTab, setSelectedBrandTab] = useState('All Brands');
  const [selectedCompareVehicleIds, setSelectedCompareVehicleIds] = useState<string[]>([]);
  const [brandEnquiry, setBrandEnquiry] = useState<Record<string, { name: string; phone: string; message: string }>>({});
  const [sendingBrandEnquiry, setSendingBrandEnquiry] = useState<Record<string, boolean>>({});
  const [sentBrandEnquiry, setSentBrandEnquiry] = useState<Record<string, boolean>>({});
  const [openEnquiryBrandId, setOpenEnquiryBrandId] = useState<string | null>(null);

  useEffect(() => {
    const loadBrands = async () => {
      const [{ data: brands }, { data: vehicles }, { data: dealers }, { data: allActiveVehicles }] = await Promise.all([
        supabase
          .from('brands')
          .select('id, dealer_id, name, description, logo_url')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('vehicles')
          .select('id, brand, model')
          .eq('is_active', true)
          .eq('is_available', true),
        supabase
          .from('dealers')
          .select('id, name, contact_phone, contact_email')
          .eq('is_active', true),
        supabase
          .from('vehicles')
          .select('brand, model')
          .eq('is_active', true),
      ]);

      const dealersById = (dealers || []).reduce((acc: Record<string, any>, dealer: any) => {
        acc[dealer.id] = dealer;
        return acc;
      }, {});

      const modelsByBrand = new Map<string, Map<string, string>>();
      (vehicles || []).forEach((vehicle: any) => {
        const brandName = (vehicle.brand || '').trim();
        const modelName = (vehicle.model || '').trim();
        if (!brandName || !modelName) return;
        if (!modelsByBrand.has(brandName)) modelsByBrand.set(brandName, new Map());
        const byModel = modelsByBrand.get(brandName)!;
        if (!byModel.has(modelName)) byModel.set(modelName, vehicle.id);
      });

      const allModelsByBrand = new Map<string, Set<string>>();
      (allActiveVehicles || []).forEach((vehicle: any) => {
        const brandName = (vehicle.brand || '').trim();
        const modelName = (vehicle.model || '').trim();
        if (!brandName || !modelName) return;
        if (!allModelsByBrand.has(brandName)) allModelsByBrand.set(brandName, new Set());
        allModelsByBrand.get(brandName)?.add(modelName);
      });

      const dbBrandCards = (brands || []).map((brand: any) => {
        const availableModelNames = new Set(Array.from(modelsByBrand.get(brand.name)?.keys() || []));
        const recommended = Array.from(allModelsByBrand.get(brand.name) || [])
          .filter((modelName) => !availableModelNames.has(modelName))
          .slice(0, 10)
          .map((modelName) => ({ name: modelName, brand: brand.name }));

        return {
        id: brand.id,
        name: brand.name,
        description: brand.description || `Explore ${brand.name} models and book your test drive instantly.`,
        logoUrl: brand.logo_url || null,
        dealerName: dealersById[brand.dealer_id]?.name || 'Dealer Not Available',
        dealerPhone: dealersById[brand.dealer_id]?.contact_phone || null,
        dealerEmail: dealersById[brand.dealer_id]?.contact_email || null,
        models: Array.from(modelsByBrand.get(brand.name)?.entries() || []).map(([modelName, vehicleId]) => ({
          name: modelName,
          vehicleId: vehicleId || null,
        })),
        recommendedModels: recommended,
      };
      });

      const knownBrandNames = new Set(dbBrandCards.map((brand) => brand.name));
      const fallbackCards = Array.from(modelsByBrand.entries())
        .filter(([brandName]) => !knownBrandNames.has(brandName))
        .map(([brandName, models], index) => ({
          id: `fallback-${index}-${brandName.toLowerCase().replace(/\s+/g, '-')}`,
          name: brandName,
          description: `Discover ${brandName} models available for test drives near you.`,
          logoUrl: null,
          dealerName: 'Dealer Not Available',
          dealerPhone: null,
          dealerEmail: null,
          models: Array.from(models.entries()).map(([modelName, vehicleId]) => ({
            name: modelName,
            vehicleId: vehicleId || null,
          })),
          recommendedModels: Array.from(allModelsByBrand.get(brandName) || [])
            .filter((modelName) => !models.has(modelName))
            .slice(0, 10)
            .map((modelName) => ({ name: modelName, brand: brandName })),
        }));

      setBrandCards([...dbBrandCards, ...fallbackCards]);
    };

    void loadBrands();
  }, []);

  const brandTabs = ['All Brands', ...Array.from(new Set(brandCards.map((brand) => brand.name))).sort((a, b) => a.localeCompare(b))];

  useEffect(() => {
    if (!brandTabs.includes(selectedBrandTab)) {
      setSelectedBrandTab('All Brands');
    }
  }, [brandTabs, selectedBrandTab]);

  const visibleBrandCards = selectedBrandTab === 'All Brands'
    ? brandCards
    : brandCards.filter((brand) => brand.name === selectedBrandTab);

  const toggleCompareVehicle = (vehicleId: string) => {
    setSelectedCompareVehicleIds((prev) => {
      if (prev.includes(vehicleId)) {
        return prev.filter((id) => id !== vehicleId);
      }
      if (prev.length >= 4) {
        toast.error('You Can Compare Up To 4 Vehicles.');
        return prev;
      }
      return [...prev, vehicleId];
    });
  };

  const updateBrandEnquiry = (brandId: string, field: 'name' | 'phone' | 'message', value: string) => {
    setBrandEnquiry((prev) => ({
      ...prev,
      [brandId]: {
        name: prev[brandId]?.name || '',
        phone: prev[brandId]?.phone || '',
        message: prev[brandId]?.message || '',
        [field]: value,
      },
    }));
  };

  const submitBrandEnquiry = async (brand: HomeBrandCard) => {
    const payload = brandEnquiry[brand.id] || { name: '', phone: '', message: '' };
    if (!payload.name.trim() || !payload.phone.trim() || !payload.message.trim()) {
      toast.error('Please fill name, phone and message.');
      return;
    }

    setSendingBrandEnquiry((prev) => ({ ...prev, [brand.id]: true }));

    try {
      let { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', payload.phone.trim())
        .maybeSingle();

      if (!customer) {
        const { data: newCustomer, error: createErr } = await supabase
          .from('customers')
          .insert({
            full_name: payload.name.trim(),
            phone: payload.phone.trim(),
          })
          .select('id')
          .single();

        if (createErr) throw createErr;
        customer = newCustomer;
      }

      const { error } = await supabase.from('communications').insert({
        customer_id: customer.id,
        type: 'email',
        purpose: 'custom',
        sent_to: payload.phone.trim(),
        subject: `Marketplace Enquiry - ${brand.name}`,
        body: payload.message.trim(),
        status: 'pending',
      });

      if (error) throw error;

      setSentBrandEnquiry((prev) => ({ ...prev, [brand.id]: true }));
      setBrandEnquiry((prev) => ({
        ...prev,
        [brand.id]: { name: '', phone: '', message: '' },
      }));
      toast.success('Enquiry Sent Successfully.');
    } catch {
      toast.error('Unable To Send Enquiry. Please Try Again.');
    } finally {
      setSendingBrandEnquiry((prev) => ({ ...prev, [brand.id]: false }));
    }
  };

  if (brandCards.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-10 md:mb-14">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground">
          Test Drives By Brand
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-2xl mx-auto">
          Explore brand-wise listings like a marketplace, compare available models, and book your preferred test drive instantly.
        </p>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1 justify-start sm:justify-center">
          {brandTabs.map((brandTab) => (
            <button
              key={brandTab}
              type="button"
              onClick={() => setSelectedBrandTab(brandTab)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs sm:text-sm transition-colors ${
                selectedBrandTab === brandTab
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {brandTab}
            </button>
          ))}
        </div>

        {selectedCompareVehicleIds.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              {selectedCompareVehicleIds.length} Vehicle{selectedCompareVehicleIds.length > 1 ? 's' : ''} Selected For Compare
            </p>
            <div className="flex gap-2">
              <Link to={`/compare?ids=${selectedCompareVehicleIds.join(',')}`}>
                <Button size="sm" className="gap-2">
                  <GitCompareArrows className="h-4 w-4" />
                  Compare Selected
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setSelectedCompareVehicleIds([])}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {visibleBrandCards.map((brand) => {
          const featuredModel = brand.models[0];
          const quickModels = brand.models.slice(0, 4);
          const recommendationModels = brand.recommendedModels.slice(0, 8);
          const compareIds = brand.models
            .map((model) => model.vehicleId)
            .filter((id): id is string => Boolean(id))
            .slice(0, 4);

          return (
            <div key={brand.id} className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-card hover:shadow-elevated transition-all duration-300 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-11 w-11 rounded-lg object-contain border border-border bg-background p-1" loading="lazy" />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center">
                    {brand.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg">{brand.name}</h3>
                  <p className="text-xs text-muted-foreground">{brand.models.length} Models Available</p>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">{brand.description}</p>

                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2.5 space-y-1.5">
                  <p className="text-xs text-foreground font-medium">Dealer: {brand.dealerName}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {brand.dealerPhone || 'Phone Not Available'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {brand.dealerEmail || 'Email Not Available'}
                    </span>
                  </div>
                </div>

                {quickModels.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {quickModels.map((model) => (
                      <div key={`${brand.id}-${model.name}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-1">
                        <Link to={`/book?modelname=${encodeURIComponent(`${brand.name} ${model.name}`)}`}>
                          <span className="text-[11px] text-foreground hover:text-primary transition-colors">
                            {model.name}
                          </span>
                        </Link>
                        {model.vehicleId && (
                          <button
                            type="button"
                            onClick={() => toggleCompareVehicle(model.vehicleId!)}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] border transition-colors ${
                              selectedCompareVehicleIds.includes(model.vehicleId)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {selectedCompareVehicleIds.includes(model.vehicleId) ? 'Added' : 'Add'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {quickModels.length === 0 && (
                  <div className="mt-4">
                    {recommendationModels.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-foreground mb-2">You May Be Interested In</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {recommendationModels.map((model) => (
                            <Link
                              key={`${brand.id}-rec-${model.name}`}
                              to={`/book?modelname=${encodeURIComponent(`${model.brand} ${model.name}`)}`}
                              className="min-w-[140px] rounded-lg border border-border bg-background px-2.5 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            >
                              <p className="text-[11px] text-muted-foreground">{model.brand}</p>
                              <p className="text-xs font-medium text-foreground truncate">{model.name}</p>
                              <p className="text-[10px] text-primary mt-1">Book Test Drive</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {openEnquiryBrandId === brand.id && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">No Models Available Right Now</p>
                            <p className="text-xs text-muted-foreground">Share your details and our team will reach out.</p>
                          </div>
                        </div>

                        {sentBrandEnquiry[brand.id] ? (
                          <p className="text-xs text-success font-medium">Thanks! Your enquiry has been shared with our team.</p>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              value={brandEnquiry[brand.id]?.name || ''}
                              onChange={(event) => updateBrandEnquiry(brand.id, 'name', event.target.value)}
                              placeholder="Your Name"
                              className="h-9"
                            />
                            <Input
                              value={brandEnquiry[brand.id]?.phone || ''}
                              onChange={(event) => updateBrandEnquiry(brand.id, 'phone', event.target.value)}
                              placeholder="Phone Number"
                              className="h-9"
                            />
                            <Textarea
                              value={brandEnquiry[brand.id]?.message || ''}
                              onChange={(event) => updateBrandEnquiry(brand.id, 'message', event.target.value)}
                              placeholder={`I want a ${brand.name} test drive when models are available.`}
                              className="min-h-[72px]"
                            />
                            <Button
                              className="w-full rounded-xl gap-2"
                              onClick={() => void submitBrandEnquiry(brand)}
                              disabled={Boolean(sendingBrandEnquiry[brand.id])}
                            >
                              <Send className="h-4 w-4" />
                              {sendingBrandEnquiry[brand.id] ? 'Sending...' : 'Send Enquiry'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 bg-secondary/10 pt-4 border-t border-border/60 space-y-2 flex flex-col gap-2">
                {quickModels.length > 0 && compareIds.length >= 2 && (
                  <Link to={`/compare?ids=${compareIds.join(',')}`}>
                    <Button variant="outline" className="w-full rounded-xl gap-2">
                      <GitCompareArrows className="h-4 w-4" />
                      Compare From List
                    </Button>
                  </Link>
                )}

                {featuredModel ? (
                  <Link to={`/book?modelname=${encodeURIComponent(`${brand.name} ${featuredModel.name}`)}`}>
                    <Button className="w-full gradient-primary border-0 text-primary-foreground rounded-xl gap-2">
                      Book From Marketplace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      className="w-full rounded-xl gap-2"
                      variant={openEnquiryBrandId === brand.id ? 'outline' : 'default'}
                      onClick={() => setOpenEnquiryBrandId((prev) => (prev === brand.id ? null : brand.id))}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {openEnquiryBrandId === brand.id ? 'Close Enquiry' : 'Enquiry For This Brand'}
                    </Button>
                    <Button className="w-full rounded-xl" variant="outline" disabled>
                      Booking Opens When Models Are Live
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleBrandCards.length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">No Brands Found For The Selected Tab.</p>
        </div>
      )}
    </div>
  );
};

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const heroSlides = [
    {
      title: 'Control Every Test Drive From One Dashboard',
      subtitle: 'Live ops visibility for bookings, handovers, inspections, and completion.',
      image: showcaseAdminDashboard,
    },
    {
      title: 'Deliver Premium Booking Experience',
      subtitle: 'Fast booking journeys for online and walk-in customers with cleaner data capture.',
      image: showcaseBooking,
    },
    {
      title: 'Assign GRO & Sales Without Delays',
      subtitle: 'Location-aware assignment flow with real-time accountability at each checkpoint.',
      image: showcaseGroAssign,
    },
  ];

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3600);

    return () => clearInterval(slideInterval);
  }, [heroSlides.length]);

  const goToSlide = (index: number) => setActiveHeroSlide(index);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active) {
        setIsLoggedIn(!!session);
      }
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const staffEntryPath = isLoggedIn ? '/dashboard' : '/auth';

  const aiModules = [
    {
      icon: Building2,
      title: 'Dealer Management',
      desc: 'Manage dealer onboarding, activation, access controls, and performance visibility from one command center.',
    },
    {
      icon: CalendarCheck,
      title: 'Test Drive Management',
      desc: 'Handle booking lifecycle, assignment, key handover, completion states, and conversion tracking in real time.',
    },
    {
      icon: Car,
      title: 'Vehicle Management',
      desc: 'Track vehicle availability, location, maintenance windows, and test drive readiness across all branches.',
    },
    {
      icon: MessageCircle,
      title: 'Communication After Booking',
      desc: 'Automate confirmations, reminders, and post-drive follow-ups through structured communication workflows.',
    },
    {
      icon: MapPin,
      title: 'Manage Location',
      desc: 'Operate multi-location showrooms with localized slots, staff mapping, and branch-level reporting controls.',
    },
    {
      icon: Users,
      title: 'Manage Staffs',
      desc: 'Control staff profiles, roles, assignment logic, and accountability checkpoints for every operational step.',
    },
    {
      icon: Clock,
      title: 'Manage Operation Timing',
      desc: 'Define booking windows, team shifts, SLA timing, and process deadlines with configurable timing rules.',
    },
    {
      icon: Shield,
      title: 'Trace Staff Login & Logoff Insights',
      desc: 'Capture staff session activity with secure login/logoff traces and operational visibility for audits.',
    },
    {
      icon: CheckCircle2,
      title: 'Block Test Drive By Day/Time',
      desc: 'Apply blackout controls for specific days, dates, or time blocks to prevent invalid bookings instantly.',
    },
    {
      icon: BarChart3,
      title: 'Dashboard',
      desc: 'Get AI-assisted KPIs for bookings, completion ratios, utilization, conversion trends, and team productivity.',
    },
    {
      icon: Send,
      title: 'Enquiry Management',
      desc: 'Collect, route, prioritize, and convert enquiries with lead scoring and action-oriented next-step tracking.',
    },
    {
      icon: GitCompareArrows,
      title: 'Customer Test Drive Flow Tracking',
      desc: 'Track complete customer journey from enquiry to showroom arrival, drive steps, feedback, and closure.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/6 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-info/5 rounded-full blur-[80px]" />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-2 flex items-center justify-between">
         <a href="/" >
         
          <div className="flex items-center justify-center py-1">
              <img src="https://res.cloudinary.com/totalesworld/image/upload/v1774814506/01492d46-e50d-452e-a7b6-4987c301a6bf_2_nanetp.png" alt="Logo" className="h-[50px] w-full" />
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/compare">
              <Button size="lg" className="bg-info text-info-foreground rounded-xl font-semibold hover:bg-info/90 transition-all px-5">
                <Car className="mr-2 h-4 w-4" /> Compare
              </Button>
            </Link>
            <Link to="/book">
              <Button size="lg" className="primary border-0 text-accent-foreground rounded-xl font-semibold shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-shadow px-5">
                🚗 Book Test Drive
              </Button>
            </Link>
            <Link to="/dealer-onboarding">
              <Button size="lg" className="primary text-success-foreground rounded-xl font-semibold hover:bg-success/90 transition-all px-5">
                <Building2 className="mr-2 h-4 w-4" /> For Dealers
              </Button>
            </Link>
            <Link to={staffEntryPath}>
              <Button size="lg" className="bg-primary-foreground text-foreground rounded-xl font-semibold shadow-lg hover:bg-primary-foreground/90 transition-all px-5">
                Staff Login →
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-primary-foreground/10 text-primary-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-20 lg:hidden px-4 pb-4 space-y-2"
          >
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
            <Link to={staffEntryPath} onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-primary-foreground text-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
                Staff Login →
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Hero Section */}
        <div className="relative z-10 mx-auto max-w-full bg-primary/20 px-4 sm:px-6 pt-10 sm:pt-14 pb-14 sm:pb-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="rounded-[28px] border border-primary/15 bg-white/80 backdrop-blur-sm p-6 sm:p-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-10 items-start">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">Omni Tracely</p>
                <h1 className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-[1.03]">
                  One Stop Solution
                  <span className="block">For All Omni Operations</span>
                </h1>
                <h2 className="mt-5 text-lg sm:text-2xl font-heading font-semibold text-foreground/90 leading-tight">
                Trusted Booking, Assignment, Security Check-In, And Follow-Up In One Workflow, Walkin Test Drive.
                </h2>
                <p className="mt-4 text-sm sm:text-base text-foreground/70 max-w-2xl leading-relaxed">
                  Designed for dealerships that need speed on the floor and clarity in reports. From enquiry to closure, every event is traceable.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link to="/book" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto primary border-0 text-primary-foreground px-8 h-12 rounded-xl">
                      Start Booking <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/dealer-onboarding" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-primary-foreground/90 text-foreground px-8 h-12 rounded-xl font-semibold hover:bg-primary-foreground">
                      For Dealerships
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-primary-foreground/20 min-h-[280px] sm:min-h-[320px] shadow-2xl shadow-black/20">
                  {heroSlides.map((slide, idx) => (
                    <img
                      key={slide.title}
                      src={slide.image}
                      alt={slide.title}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                        idx === activeHeroSlide ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />

                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/75 font-semibold">Omni Tracely Insights</p>
                    <p className="mt-1 text-base sm:text-lg font-heading font-semibold leading-tight">
                      {heroSlides[activeHeroSlide].title}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-white/85 leading-relaxed">
                      {heroSlides[activeHeroSlide].subtitle}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {heroSlides.map((slide, idx) => (
                        <button
                          key={slide.title}
                          type="button"
                          onClick={() => goToSlide(idx)}
                          className={`h-2 rounded-full transition-all ${idx === activeHeroSlide ? 'w-7 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'}`}
                          aria-label={`Go to hero slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white/95 p-4 sm:p-5 text-foreground shadow-xl shadow-black/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick Booking Panel</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Input type="date" className="h-11 rounded-xl bg-card" />
                    <Input type="date" className="h-11 rounded-xl bg-card" />
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <Link to="/compare">
                      <Button variant="outline" className="w-full h-11 rounded-xl">Compare</Button>
                    </Link>
                    <Link to="/book">
                      <Button className="w-full h-11 rounded-xl gradient-primary border-0 text-primary-foreground">Search & Book</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5"
          >
            {[
              { title: 'Trusted Commercial & Passenger Test Drive Workflow', subtitle: 'Online and walk-in journeys managed in a single dashboard' },
              { title: 'One Click Sales Assignment', subtitle: 'GRO to Sales to Security handover without manual confusion' },
              { title: 'From Drive To Opportunity', subtitle: 'Mark hot/cold lead and create follow-up tasks instantly' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-primary-foreground/10 bg-primary px-4 py-3.5">
                <p className="text-sm font-semibold text-primary-foreground">{item.title}</p>
                <p className="text-xs text-primary-foreground/65 mt-1">{item.subtitle}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* AI Operations Modules */}
      <div className="py-14 md:py-20 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-12">
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs sm:text-sm font-semibold text-primary uppercase tracking-[0.2em]"
            >
              AI Driven Omni Tracely
            </motion.span>
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="mt-4 text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight"
            >
              Manage Complete Showroom Operations On One Home Platform
            </motion.h2>
            <motion.p
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="mt-4 text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto"
            >
              Built to centralize dealer operations, test drive lifecycle, staff actions, and customer journey traceability with AI-guided workflow decisions.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {aiModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={index % 6}
                  className="group rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3 mb-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm sm:text-base font-heading font-semibold text-foreground leading-none whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                      {index + 1}. {module.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {module.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 md:mb-14">
          <motion.span
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-[0.2em]"
          >
            Features
          </motion.span>
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3 leading-tight"
          >
            Built For High-Volume Showroom Operations
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="text-sm sm:text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          >
            Capture every checkpoint from booking to closure with fewer manual calls, faster assignments, and cleaner conversion tracking.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[
            { icon: CalendarCheck, title: 'Smart Scheduling', desc: 'Online booking with phone/email validation, walk-in registration, and automatic vehicle availability checks.', color: 'bg-primary/10 text-primary' },
            { icon: Users, title: 'Role-Based Access', desc: 'Dedicated dashboards for GRO, Sales, Security, and Super Admin roles with tailored permissions.', color: 'bg-accent/10 text-accent' },
            { icon: Car, title: 'Vehicle Tracking', desc: 'Track demo vehicles across locations. Auto-release vehicles when test drives are cancelled or completed.', color: 'bg-info/10 text-info' },
            { icon: Shield, title: 'Security Gate', desc: 'Check-in/out tracking, driving license upload and verification at the security gate.', color: 'bg-success/10 text-success' },
            { icon: BarChart3, title: 'Data & Analytics', desc: 'Trends, vehicle popularity, source analysis, and repeat customer tracking in a powerful data center.', color: 'bg-warning/10 text-warning' },
            { icon: MapPin, title: 'Multi-Location', desc: 'Manage multiple showrooms from one platform with location-based filtering and staff assignment.', color: 'bg-destructive/10 text-destructive' },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="group p-5 sm:p-6 rounded-2xl border border-border bg-[linear-gradient(160deg,#ffffff_0%,#f7fbff_100%)] hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl ${f.color} flex items-center justify-center mb-3 sm:mb-4 transition-transform group-hover:scale-110`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Brand Marketplace */}
      <BrandMarketplace />

      {/* How It Works */}
      <div className="bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] py-16 md:py-24 border-y border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-14">
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-[0.2em]"
            >
              How it works
            </motion.span>
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
            >
              3-Step Guest Journey
            </motion.h2>
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="hidden sm:block absolute left-0 right-0 top-[52px] h-px bg-primary/20" />
            {[
              { step: '01', icon: MapPin, title: 'Choose Location & Vehicle', desc: 'Select your nearest showroom and pick the car you want to experience.' },
              { step: '02', icon: Clock, title: 'Pick a Date & Time', desc: 'Choose a convenient slot from available dates. We\'ll confirm instantly.' },
              { step: '03', icon: CheckCircle2, title: 'Show Up & Drive', desc: 'Bring your driving license, complete a quick check-in, and hit the road.' },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="relative text-center rounded-2xl border border-primary/15 bg-white/80 p-5 shadow-sm"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70 mb-2">Step {s.step}</div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-primary/20 relative z-10">
                  <s.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg mb-2">{s.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* For Dealers Section */}
      <div className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-12">
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-sm font-semibold text-accent uppercase tracking-wider"
            >
              For Dealerships
            </motion.span>
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
            >
              Set Up Your Dealership in Minutes
            </motion.h2>
            <motion.p
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto"
            >
              Onboard your dealership, add brands, configure locations, and customize branding — all from one dashboard.
            </motion.p>
          </div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
          >
            {[
              { icon: Building2, title: 'Dealer Onboarding', desc: 'Create your admin account, add brands and showroom locations in a guided setup wizard.', link: '/dealer-onboarding', linkLabel: 'Get Started', btnColor: 'bg-success text-success-foreground hover:bg-success/90' },
              { icon: Car, title: 'Brand Customization', desc: 'Upload logos, set titles, descriptions, and SEO metadata for each brand you sell.', link: '/auth', linkLabel: 'Login to Configure', btnColor: 'bg-primary text-primary-foreground hover:bg-primary/90' },
              { icon: MapPin, title: 'Multi-Location Management', desc: 'Manage vehicles, staff, and schedules across all your showroom locations independently.', link: '/auth', linkLabel: 'Login to Manage', btnColor: 'bg-info text-info-foreground hover:bg-info/90' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i + 4}
                  className="p-5 sm:p-6 rounded-2xl border border-border bg-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 flex flex-col"
                >
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3 sm:mb-4">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">{item.desc}</p>
                  <Link to={item.link} className="mt-4">
                    <Button size="sm" className={`rounded-xl gap-2 w-full ${item.btnColor} border-0`}>
                      {item.linkLabel} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="p-8 sm:p-12 rounded-3xl gradient-dark relative overflow-hidden border border-primary-foreground/15"
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-primary/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-36 sm:w-48 h-36 sm:h-48 bg-accent/10 rounded-full blur-[60px]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
                Ready To Scale Test Drives Like A Premium Brand?
              </h2>
              <p className="text-sm sm:text-base text-primary-foreground/60 mb-6 sm:mb-8 max-w-md mx-auto">
                Launch customer bookings and staff workflow in minutes with complete visibility at every handover.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link to="/book" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gradient-accent border-0 text-accent-foreground text-base px-8 sm:px-10 h-12 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow">
                    Book Your Test Drive <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/dealer-onboarding" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-success text-success-foreground text-base px-8 h-12 rounded-xl font-semibold hover:bg-success/90 transition-all">
                    <Building2 className="mr-2 h-4 w-4" /> Register as Dealer
                  </Button>
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
                  <p className="text-xs text-primary-foreground/70">Customer Flow</p>
                  <p className="text-sm font-semibold text-primary-foreground">Bookings + Reminders + Feedback</p>
                </div>
                <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
                  <p className="text-xs text-primary-foreground/70">Ops Control</p>
                  <p className="text-sm font-semibold text-primary-foreground">GRO + Sales + Security Timeline</p>
                </div>
                <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3">
                  <p className="text-xs text-primary-foreground/70">Conversion Ready</p>
                  <p className="text-sm font-semibold text-primary-foreground">Hot/Cold Lead + Task Creation</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
            <a href="/" >
         
          <div className="flex items-center justify-center py-1">
              <img src="https://res.cloudinary.com/totalesworld/image/upload/v1774814506/01492d46-e50d-452e-a7b6-4987c301a6bf_2_nanetp.png" alt="Logo" className="h-[50px] w-full" />
            </div>
          </a>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link to="/dealer-onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dealer Onboarding</Link>
            <Link to="/compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare Vehicles</Link>
            <Link to={staffEntryPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Login</Link>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center">© {new Date().getFullYear()} Omni Tracely — Smart Test Drive & Lead Platform</p>
        </div>
      </footer>
      <EnquiryWidget />
    </div>
  );
};

export default Index;

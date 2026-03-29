import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Send, Phone, Mail } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import showcaseBooking from '@/assets/showcase-booking.jpg';
import showcaseGro from '@/assets/showcase-gro-assign.jpg';
import showcaseAdmin from '@/assets/showcase-admin-dashboard.jpg';
import EnquiryWidget from '@/components/EnquiryWidget';
import { toast } from 'sonner';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const showcaseItems = [
  {
    id: 'booking',
    label: 'Customer Booking',
    title: 'Easy Online Booking',
    description: 'Customers book test drives in seconds — pick a showroom, choose a vehicle, select a date and time. Confirmation sent via WhatsApp or email instantly.',
    image: showcaseBooking,
  },
  {
    id: 'gro',
    label: 'GRO Assignment',
    title: 'Smart Sales Assignment',
    description: 'GRO receptionist views all bookings on a calendar, assigns the right sales person with one click, and manages the day\'s schedule effortlessly.',
    image: showcaseGro,
  },
  {
    id: 'admin',
    label: 'Admin Dashboard',
    title: 'Complete Visibility',
    description: 'Super Admin and Sales Leads see everything — KPIs, trends, vehicle popularity, team performance, and every test drive across all locations.',
    image: showcaseAdmin,
  },
];

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

              <div className="mt-5 pt-4 border-t border-border/60 space-y-2">
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

const ProductShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const current = showcaseItems[activeIndex];

  return (
    <div className="py-20 md:py-32 relative overflow-hidden">
      {/* Subtle background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-14 md:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">See it in action</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">
            How Omni Tracely Works
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-sm sm:text-base">
            From booking to test drive — experience a seamless workflow designed for modern showrooms.
          </p>
        </div>

        {/* Tabs with progress */}
        <div className="flex justify-center gap-3 mb-12 md:mb-16 flex-wrap">
          {showcaseItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setActiveIndex(idx)}
              className={`relative flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-medium overflow-hidden ${
                activeIndex === idx
                  ? 'bg-card text-foreground shadow-elevated border border-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
              }`}
            >
              <span className={`flex items-center justify-center h-6 w-6 rounded-lg text-xs font-bold ${
                activeIndex === idx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {idx + 1}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Text content */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                Step {activeIndex + 1} of {showcaseItems.length}
              </div>
              <h3 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
                {current.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {current.description}
              </p>
              {activeIndex === 0 && (
                <Link to="/book">
                  <Button className="gradient-primary border-0 text-primary-foreground rounded-xl mt-2 w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                    Try Booking <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Dot indicators */}
            <div className="flex gap-2 mt-8">
              {showcaseItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2 rounded-full ${
                    activeIndex === idx ? 'w-8 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40'
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Image with animated transition */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <div className="relative rounded-2xl overflow-hidden shadow-elevated border border-border bg-card p-1.5">
              {/* Decorative gradient border effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
              
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={current.image}
                  alt={current.title}
                  loading="lazy"
                  className="w-full h-auto"
                />
              </div>

              {/* Floating badge */}
              <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 rounded-full flex items-center gap-2 shadow-card">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-medium text-foreground">Live Preview</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <div className="gradient-dark relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent/6 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-info/5 rounded-full blur-[80px]" />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <Car className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-heading font-bold text-primary-foreground tracking-tight">Omni Tracely</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/compare">
              <Button size="lg" className="bg-info text-info-foreground rounded-xl font-semibold hover:bg-info/90 transition-all px-5">
                <Car className="mr-2 h-4 w-4" /> Compare
              </Button>
            </Link>
            <Link to="/book">
              <Button size="lg" className="gradient-accent border-0 text-accent-foreground rounded-xl font-semibold shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-shadow px-5">
                🚗 Book Test Drive
              </Button>
            </Link>
            <Link to="/dealer-onboarding">
              <Button size="lg" className="bg-success text-success-foreground rounded-xl font-semibold hover:bg-success/90 transition-all px-5">
                <Building2 className="mr-2 h-4 w-4" /> For Dealers
              </Button>
            </Link>
            <Link to="/auth">
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
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-primary-foreground text-foreground rounded-xl font-semibold justify-start gap-2 h-11 mt-2">
                Staff Login →
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Hero Section */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 mb-6 sm:mb-8"
          >
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-primary-foreground/80">Trusted by leading automotive showrooms</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-3xl sm:text-5xl md:text-7xl font-heading font-bold text-primary-foreground leading-[1.1] tracking-tight"
          >
            Smart Test Drive & Lead Platform
            <span className="text-2xl  block mt-2 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-accent)' }}>
              Made Simple Test Drive Management
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto leading-relaxed px-2"
          >
            The complete platform for automotive showrooms. Manage bookings, walk-ins, vehicle availability, staff assignments, and customer communications — all in one place.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0"
          >
            <Link to="/book" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gradient-primary border-0 text-primary-foreground text-base px-8 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                Book a Test Drive <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-primary-foreground text-foreground text-base px-8 h-12 rounded-xl font-semibold shadow-lg hover:bg-primary-foreground/90 transition-all">
                Staff Portal →
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto"
          >
            {[
              { value: '500+', label: 'Test Drives' },
              { value: '98%', label: 'On-Time Rate' },
              { value: '4.9★', label: 'Satisfaction' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-primary-foreground">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-primary-foreground/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-10 md:mb-16">
          <motion.span
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-sm font-semibold text-primary uppercase tracking-wider"
          >
            Features
          </motion.span>
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
          >
            Everything Your Showroom Needs
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          >
            From booking to completion, Omni Tracely handles the entire test drive lifecycle with precision.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                className="group p-5 sm:p-6 rounded-2xl border border-border bg-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
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

      {/* Brand Marketplace */}
      <BrandMarketplace />

      {/* Product Showcase */}
      <ProductShowcase />

      {/* How It Works */}
      <div className="bg-muted/50 py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-16">
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-sm font-semibold text-primary uppercase tracking-wider"
            >
              How it works
            </motion.span>
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
            >
              Book in 3 Simple Steps
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
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
                className="relative text-center"
              >
                <div className="text-5xl sm:text-6xl font-heading font-bold text-primary/10 mb-3 sm:mb-4">{s.step}</div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-primary/20">
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
            className="p-8 sm:p-12 rounded-3xl gradient-dark relative overflow-hidden"
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-primary/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-36 sm:w-48 h-36 sm:h-48 bg-accent/10 rounded-full blur-[60px]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
                Ready to Experience Your Dream Car?
              </h2>
              <p className="text-sm sm:text-base text-primary-foreground/60 mb-6 sm:mb-8 max-w-md mx-auto">
                Book your test drive today. It only takes a minute to get started.
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
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-foreground">Omni Tracely</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link to="/dealer-onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dealer Onboarding</Link>
            <Link to="/compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare Vehicles</Link>
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Login</Link>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center">© {new Date().getFullYear()} Omni Tracely — Smart Test Drive & Lead Platform</p>
        </div>
      </footer>
      <EnquiryWidget />
    </div>
  );
};

export default Index;

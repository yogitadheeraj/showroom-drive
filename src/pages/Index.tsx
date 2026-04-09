import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Smartphone, FolderOpen, PieChart, DollarSign, ShieldCheck, Tag, Landmark, Layers, CreditCard, FileText, Package, Receipt, ClipboardList, Warehouse } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import EnquiryWidget from '@/components/EnquiryWidget';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active) setIsLoggedIn(!!session);
    };
    void loadSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  const staffEntryPath = isLoggedIn ? '/dashboard' : '/auth';

  const features = [
    { icon: Car, title: 'Seamless Online Sales', desc: 'Engage customers and streamline the buying process effortlessly with digital-first workflows.' },
    { icon: GitCompareArrows, title: 'Advanced Trade-In Tool', desc: 'Accurately appraise and manage trade-ins for higher customer satisfaction and faster deals.' },
    { icon: DollarSign, title: 'F&I Integration', desc: 'Integrate financing and insurance options smoothly into every deal for maximum profitability.' },
  ];

  const aiModules = [
    { icon: Car, title: 'Vehicle Management', desc: 'Complete vehicle lifecycle management — inventory, availability, location tracking.' },
    { icon: Users, title: 'Dealer CRM', desc: 'Unified customer relationship management with lead scoring and conversion tracking.' },
    { icon: CalendarCheck, title: 'Test Drive Management', desc: 'End-to-end booking lifecycle — assignment, key handover, inspection, completion.' },
    { icon: GitCompareArrows, title: 'Trade-In Management', desc: 'Streamline vehicle trade-in evaluations, appraisals, and offers.' },
    { icon: Warehouse, title: 'Vehicle Inventory', desc: 'Real-time inventory visibility across locations with stock levels.' },
    { icon: CreditCard, title: 'CPQ – Configure, Price, Quote', desc: 'Configure vehicles, apply pricing rules, and generate accurate quotes.' },
    { icon: Tag, title: 'Vehicle Reservation', desc: 'Allow customers to reserve vehicles with deposit management.' },
    { icon: Receipt, title: 'RTP – Request To Pay', desc: 'Digital payment request workflows with tracking and reminders.' },
    { icon: ClipboardList, title: 'Order Management', desc: 'Track orders from placement to delivery with status updates.' },
    { icon: MessageCircle, title: 'Communication Module', desc: 'Multi-channel communication via WhatsApp, Email, and SMS.' },
    { icon: FolderOpen, title: 'Deal File Management', desc: 'AI-powered document management with auto-classification.' },
    { icon: BarChart3, title: 'Role Based Reports', desc: 'Pre-built reports tailored for each role with actionable KPIs.' },
    { icon: PieChart, title: 'Realtime Analytics & BI', desc: 'Live dashboards with AI-assisted insights for all operations.' },
    { icon: Smartphone, title: 'Showroom Sales App', desc: 'Mobile-first app for sales teams on the floor.' },
    { icon: DollarSign, title: 'F&I Module', desc: 'Finance and Insurance with product bundling and margin tracking.' },
    { icon: Building2, title: 'AutoAdvant ERP', desc: 'Enterprise resource planning connecting all dealership operations.' },
    { icon: Package, title: 'Accessories', desc: 'Manage accessory catalog, pricing, and fitment scheduling.' },
    { icon: ShieldCheck, title: 'Insurance Products', desc: 'Integrated insurance offerings with comparison and tracking.' },
    { icon: Layers, title: 'Integrated PIM', desc: 'Centralized vehicle specs, media assets, and content management.' },
    { icon: FileText, title: 'Pricing Rules', desc: 'Configurable pricing engine with discount rules and approvals.' },
    { icon: Landmark, title: 'Loan & Leasing', desc: 'End-to-end loan and leasing with EMI calculators and lender integration.' },
  ];

  return (
    <div className="min-h-screen bg-[hsl(220,50%,10%)]">
      {/* Navigation */}
      <nav className="relative z-50 max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <a href="/">
          <img src="/images/autoadvant-logo.png" alt="AutoAdvant" className="h-10 sm:h-12 w-auto" />
        </a>

        <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-white/80">
          <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#modules" className="hover:text-white transition-colors">Resources</a>
          <Link to="/dealer-onboarding" className="hover:text-white transition-colors">About</Link>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/book">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold px-5 border-0">
              Get a Demo
            </Button>
          </Link>
          <Link to={staffEntryPath}>
            <Button size="sm" variant="outline" className="text-white border-white/30 hover:bg-white/10 rounded-md font-semibold px-5">
              Staff Login
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-white"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative z-40 lg:hidden px-4 pb-4 space-y-2">
          <Link to="/book" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold h-11 border-0">Get a Demo</Button>
          </Link>
          <Link to="/compare" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-white/10 text-white rounded-md font-semibold h-11 mt-2 border-0">Compare Vehicles</Button>
          </Link>
          <Link to={staffEntryPath} onClick={() => setMobileMenuOpen(false)}>
            <Button variant="outline" className="w-full text-white border-white/30 rounded-md font-semibold h-11 mt-2">Staff Login</Button>
          </Link>
        </motion.div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,50%,10%)] via-[hsl(213,70%,18%)] to-[hsl(220,50%,10%)]" />
          <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[hsl(213,80%,50%/0.08)] rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-[hsl(200,90%,48%/0.06)] rounded-full blur-[100px]" />
          {/* City skyline overlay effect */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[hsl(220,50%,10%)] to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left Content */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-white leading-[1.1]">
                Drive Your
                <br />
                <span className="text-white">Dealership's </span>
                <span className="bg-gradient-to-r from-[hsl(200,90%,65%)] to-[hsl(213,80%,70%)] bg-clip-text text-transparent">Success</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-white/60 max-w-lg leading-relaxed">
                Empowering Automotive Digital Retailing for Rapid Sales Growth. The complete platform for modern dealerships.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/book">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 rounded-md font-semibold shadow-lg shadow-red-600/30 border-0">
                    Get a Demo
                  </Button>
                </Link>
                <Link to="/dealer-onboarding">
                  <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10 text-base px-8 h-13 rounded-md font-semibold">
                    Learn More
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right — Car Visual Placeholder */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30 bg-[hsl(220,50%,12%)]">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(220,50%,8%)] border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-6 rounded-md bg-white/5 border border-white/10 max-w-xs mx-auto flex items-center justify-center">
                      <span className="text-[10px] text-white/40 font-mono">app.autoadvant.com</span>
                    </div>
                  </div>
                </div>
                <div className="aspect-[16/10] bg-gradient-to-br from-[hsl(213,70%,18%)] to-[hsl(220,50%,12%)] flex items-center justify-center p-8">
                  <div className="text-center">
                    <Car className="h-16 w-16 text-[hsl(213,80%,55%)] mx-auto mb-4" />
                    <p className="text-white/70 text-sm font-heading font-semibold">Admin Dashboard</p>
                    <p className="text-white/40 text-xs mt-1">Complete operational command center</p>
                  </div>
                </div>
              </div>
              {/* Floating data visualizations */}
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-xl bg-[hsl(213,80%,50%/0.15)] border border-[hsl(213,80%,50%/0.25)] backdrop-blur-sm flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-[hsl(213,80%,60%)]" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-xl bg-[hsl(200,90%,48%/0.15)] border border-[hsl(200,90%,48%/0.25)] backdrop-blur-sm flex items-center justify-center">
                <PieChart className="h-6 w-6 text-[hsl(200,90%,60%)]" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features — 3 Card Section */}
      <div id="solutions" className="relative bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground"
            >
              The Future of Car Buying <span className="text-primary italic">Starts Here</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                  className="group relative rounded-2xl border border-border bg-card overflow-hidden shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Numbered badge */}
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                    {i + 1}
                  </div>
                  {/* Icon area */}
                  <div className="h-44 bg-gradient-to-br from-[hsl(213,70%,18%)] to-[hsl(220,50%,12%)] flex items-center justify-center">
                    <Icon className="h-16 w-16 text-[hsl(213,80%,60%)] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="p-5 sm:p-6 text-center">
                    <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg mb-2">{f.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    <a href="#" className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3 hover:gap-2 transition-all">
                      Learn More <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="relative overflow-hidden bg-[hsl(220,50%,10%)] py-16 md:py-20">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,50%,10%)] via-[hsl(213,70%,15%)] to-[hsl(220,50%,10%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(213,80%,50%/0.3)] to-transparent" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white"
          >
            Schedule Your Demo <span className="text-[hsl(200,90%,65%)] italic">Today!</span>
          </motion.h2>
          <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="mt-4 text-sm sm:text-base text-white/60 max-w-2xl mx-auto"
          >
            Discover how AutoAdvant can accelerate your sales growth and transform your dealership's online retail experience.
          </motion.p>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link to="/book">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 rounded-md font-semibold shadow-lg shadow-red-600/30 border-0">
                Get a Demo
              </Button>
            </Link>
            <Link to="/dealer-onboarding">
              <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10 text-base px-8 h-13 rounded-md font-semibold">
                Watch Video
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="py-16 md:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-14">
            <motion.span initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-[0.2em]"
            >
              How it works
            </motion.span>
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
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
              <motion.div key={s.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="relative text-center rounded-2xl border border-primary/15 bg-card p-5 shadow-card"
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

      {/* AI Operations Modules */}
      <div id="modules" className="py-14 md:py-20 bg-muted/30 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-12">
            <motion.span initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs sm:text-sm font-semibold text-primary uppercase tracking-[0.2em]"
            >
              Complete DMS Platform
            </motion.span>
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="mt-4 text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight"
            >
              AI Powered DMS For A Seamless Experience
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="mt-4 text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto"
            >
              21+ integrated modules covering every aspect of dealership operations — from vehicle management to loan & leasing.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {aiModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div key={module.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={index % 6}
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
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{module.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* For Dealers Section */}
      <div className="py-16 md:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 md:mb-12">
            <motion.span initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-sm font-semibold text-primary uppercase tracking-wider"
            >
              For Dealerships
            </motion.span>
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
            >
              Set Up Your Dealership in Minutes
            </motion.h2>
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
          >
            {[
              { icon: Building2, title: 'Dealer Onboarding', desc: 'Create your admin account and add showroom locations in a guided setup wizard.', link: '/dealer-onboarding', linkLabel: 'Get Started' },
              { icon: Car, title: 'Brand Customization', desc: 'Upload logos, set descriptions, and SEO metadata for each brand you sell.', link: '/auth', linkLabel: 'Login to Configure' },
              { icon: MapPin, title: 'Multi-Location', desc: 'Manage vehicles, staff, and schedules across all your showroom locations.', link: '/auth', linkLabel: 'Login to Manage' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 4}
                  className="p-5 sm:p-6 rounded-2xl border border-border bg-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 flex flex-col"
                >
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 sm:mb-4">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-base sm:text-lg mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">{item.desc}</p>
                  <Link to={item.link} className="mt-4">
                    <Button size="sm" className="rounded-md gap-2 w-full border-0">
                      {item.linkLabel} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Trusted By */}
      <div className="py-10 bg-muted/20 border-y border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm sm:text-base font-heading font-semibold text-foreground mb-6">
            Trusted by Leading Dealerships Nationwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {['Partner 1', 'Partner 2', 'Partner 3', 'Partner 4'].map((name) => (
              <div key={name} className="px-6 py-3 rounded-lg border border-border bg-card text-sm font-heading font-semibold text-muted-foreground tracking-wider uppercase">
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[hsl(220,50%,10%)] border-t border-white/10 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
          <a href="/">
            <img src="/images/autoadvant-logo.png" alt="AutoAdvant" className="h-8 sm:h-10 w-auto" />
          </a>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link to="/dealer-onboarding" className="text-sm text-white/50 hover:text-white/80 transition-colors">Dealer Onboarding</Link>
            <Link to="/compare" className="text-sm text-white/50 hover:text-white/80 transition-colors">Compare Vehicles</Link>
            <Link to={staffEntryPath} className="text-sm text-white/50 hover:text-white/80 transition-colors">Staff Login</Link>
            <a href="#" className="text-sm text-white/50 hover:text-white/80 transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-white/50 hover:text-white/80 transition-colors">Terms of Service</a>
          </div>
          <p className="text-xs sm:text-sm text-white/40 text-center">© {new Date().getFullYear()} AutoAdvant. All Rights Reserved.</p>
        </div>
      </footer>
      <EnquiryWidget />
    </div>
  );
};

export default Index;

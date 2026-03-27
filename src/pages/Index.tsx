import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import showcaseBooking from '@/assets/showcase-booking.jpg';
import showcaseGro from '@/assets/showcase-gro-assign.jpg';
import showcaseAdmin from '@/assets/showcase-admin-dashboard.jpg';
import EnquiryWidget from '@/components/EnquiryWidget';

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

const ProductShowcase = () => {
  const [active, setActive] = useState('booking');
  const current = showcaseItems.find(i => i.id === active)!;

  return (
    <div className="py-16 md:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 md:mb-12">
          <motion.span
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-sm font-semibold text-primary uppercase tracking-wider"
          >
            See it in action
          </motion.span>
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
          >
            How TestDriveSync Works
          </motion.h2>
        </div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
          className="flex justify-center gap-2 mb-8 md:mb-10 flex-wrap"
        >
          {showcaseItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                active === item.id
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-primary/30'
              }`}
            >
              {item.label}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 items-center"
        >
          <div className="lg:col-span-2 space-y-3 md:space-y-4 order-2 lg:order-1">
            <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{current.title}</h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{current.description}</p>
            {active === 'booking' && (
              <Link to="/book">
                <Button className="gradient-primary border-0 text-primary-foreground rounded-xl mt-2 w-full sm:w-auto">
                  Try Booking <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="rounded-2xl overflow-hidden shadow-elevated border border-border bg-card">
              <img
                src={current.image}
                alt={current.title}
                loading="lazy"
                className="w-full h-auto"
              />
            </div>
          </div>
        </motion.div>
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
            <span className="text-lg sm:text-xl font-heading font-bold text-primary-foreground tracking-tight">TestDriveSync</span>
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
            <span className="block mt-2 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-accent)' }}>
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
            From booking to completion, TestDriveSync handles the entire test drive lifecycle with precision.
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
            <span className="font-heading font-semibold text-foreground">TestDriveSync</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link to="/dealer-onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dealer Onboarding</Link>
            <Link to="/compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare Vehicles</Link>
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Login</Link>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center">© {new Date().getFullYear()} TestDriveSync — Smart Test Drive & Lead Platform</p>
        </div>
      </footer>
      <EnquiryWidget />
    </div>
  );
};

export default Index;

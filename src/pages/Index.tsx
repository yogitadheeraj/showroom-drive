import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import showcaseBooking from '@/assets/showcase-booking.jpg';
import showcaseGro from '@/assets/showcase-gro-assign.jpg';
import showcaseAdmin from '@/assets/showcase-admin-dashboard.jpg';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <div className="gradient-dark relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] right-[-5%] w-[500px] h-[500px] bg-accent/6 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-info/5 rounded-full blur-[80px]" />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold text-primary-foreground tracking-tight">DriveSync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/book">
              <Button variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 rounded-xl">
                Book Test Drive
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="gradient-primary border-0 text-primary-foreground rounded-xl shadow-lg shadow-primary/25">
                Staff Login
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 mb-8"
          >
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-primary-foreground/80">Trusted by leading automotive showrooms</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-5xl md:text-7xl font-heading font-bold text-primary-foreground leading-[1.1] tracking-tight"
          >
            Test Drive Management
            <span className="block mt-2 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-accent)' }}>
              Made Simple
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="mt-6 text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto leading-relaxed"
          >
            The complete platform for automotive showrooms. Manage bookings, walk-ins, vehicle availability, staff assignments, and customer communications — all in one place.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/book">
              <Button size="lg" className="gradient-primary border-0 text-primary-foreground text-base px-8 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                Book a Test Drive <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8 h-12 rounded-xl">
                Staff Portal
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { value: '500+', label: 'Test Drives' },
              { value: '98%', label: 'On-Time Rate' },
              { value: '4.9★', label: 'Satisfaction' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-heading font-bold text-primary-foreground">{stat.value}</div>
                <div className="text-xs text-primary-foreground/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <motion.span
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-sm font-semibold text-primary uppercase tracking-wider"
          >
            Features
          </motion.span>
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
          >
            Everything Your Showroom Needs
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="text-muted-foreground mt-4 max-w-xl mx-auto"
          >
            From booking to completion, DriveSync handles the entire test drive lifecycle with precision.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className="group p-6 rounded-2xl border border-border bg-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`h-12 w-12 rounded-xl ${f.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted/50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-sm font-semibold text-primary uppercase tracking-wider"
            >
              How it works
            </motion.span>
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-3"
            >
              Book in 3 Simple Steps
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <div className="text-6xl font-heading font-bold text-primary/10 mb-4">{s.step}</div>
                <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                  <s.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="p-12 rounded-3xl gradient-dark relative overflow-hidden"
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-[60px]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
                Ready to Experience Your Dream Car?
              </h2>
              <p className="text-primary-foreground/60 mb-8 max-w-md mx-auto">
                Book your test drive today. It only takes a minute to get started.
              </p>
              <Link to="/book">
                <Button size="lg" className="gradient-accent border-0 text-accent-foreground text-base px-10 h-12 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow">
                  Book Your Test Drive <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-foreground">DriveSync</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} DriveSync — Test Drive Management Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

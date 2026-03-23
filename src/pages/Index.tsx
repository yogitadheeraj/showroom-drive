import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-accent rounded-full blur-3xl" />
        </div>
        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold text-primary-foreground">DriveSync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/book">
              <Button variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                Book Test Drive
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="gradient-primary border-0 text-primary-foreground">Staff Login</Button>
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-heading font-bold text-primary-foreground leading-tight"
          >
            Test Drive Management
            <span className="block gradient-accent bg-clip-text text-transparent">Made Simple</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg text-primary-foreground/70 max-w-2xl mx-auto"
          >
            Complete SaaS platform for automotive showrooms. Manage bookings, walk-ins, vehicle availability, staff assignments, and customer communications — all in one place.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-4"
          >
            <Link to="/book">
              <Button size="lg" className="gradient-primary border-0 text-primary-foreground text-base px-8">
                Book a Test Drive <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-heading font-bold text-foreground text-center mb-12">
          Everything Your Showroom Needs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: CalendarCheck, title: 'Smart Scheduling', desc: 'Online booking with phone/email validation, walk-in registration, and automatic vehicle availability.' },
            { icon: Users, title: 'Role-Based Access', desc: 'Dedicated dashboards for GRO, Sales, Security, and Super Admin with appropriate permissions.' },
            { icon: Car, title: 'Vehicle Management', desc: 'Track demo vehicles across locations. Auto-release vehicles when test drives are cancelled or completed.' },
            { icon: Shield, title: 'Security & Verification', desc: 'Check-in/out tracking, driving license upload and verification at the security gate.' },
            { icon: BarChart3, title: 'Data & Analytics', desc: 'Data center dashboard with trends, vehicle popularity, source analysis, and repeat customer tracking.' },
            { icon: ArrowRight, title: 'Multi-Location', desc: 'Manage multiple showrooms from one platform with location-based filtering and staff assignment.' },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-elevated transition-shadow"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} DriveSync — Test Drive Management Platform</p>
      </footer>
    </div>
  );
};

export default Index;

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Send, Phone, Mail, Warehouse, CreditCard, FileText, Package, Receipt, ClipboardList, Smartphone, FolderOpen, PieChart, DollarSign, ShieldCheck, Tag, Landmark, Layers } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import EnquiryWidget from '@/components/EnquiryWidget';
import SiteHeader from '@/components/SiteHeader';
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
export default function AutoAdvantLandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeHeroSlide, setActiveHeroSlide] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [demoForm, setDemoForm] = useState({ name: '', email: '', company: '', phone: '', message: '' });
    const [demoLoading, setDemoLoading] = useState(false);
    const [demoSubmitted, setDemoSubmitted] = useState(false);

    const handleDemoRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!demoForm.email.trim()) {
            toast.error('Please enter your email address');
            return;
        }
        setDemoLoading(true);
        try {
            // Save as customer enquiry
            let { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', demoForm.phone.trim() || 'demo-request')
                .maybeSingle();

            if (!customer) {
                const { data: newCustomer, error } = await supabase
                    .from('customers')
                    .insert({
                        full_name: demoForm.name.trim() || 'Demo Request',
                        phone: demoForm.phone.trim() || `demo-${Date.now()}`,
                        email: demoForm.email.trim(),
                    })
                    .select('id')
                    .single();
                if (error) throw error;
                customer = newCustomer;
            }

            const commId = crypto.randomUUID();
            await supabase.from('communications').insert({
                id: commId,
                customer_id: customer!.id,
                type: 'email' as const,
                purpose: 'custom' as const,
                sent_to: demoForm.email.trim(),
                subject: 'Book a Demo Request',
                body: `Demo request from ${demoForm.name || 'Website visitor'}. Company: ${demoForm.company || 'N/A'}. Message: ${demoForm.message || 'N/A'}`,
                status: 'pending',
            });

            // Send confirmation email
            await supabase.functions.invoke('send-transactional-email', {
                body: {
                    templateName: 'demo-request-confirmation',
                    recipientEmail: demoForm.email.trim(),
                    idempotencyKey: `demo-confirm-${commId}`,
                    templateData: {
                        name: demoForm.name.trim(),
                        email: demoForm.email.trim(),
                        company: demoForm.company.trim(),
                        phone: demoForm.phone.trim(),
                        message: demoForm.message.trim(),
                    },
                },
            });

            setDemoSubmitted(true);
            setDemoForm({ name: '', email: '', company: '', phone: '', message: '' });
            toast.success('Demo request submitted! Check your email for confirmation.');
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setDemoLoading(false);
        }
    };
    const heroSlides = [
        { title: 'Admin Dashboard', subtitle: 'Complete operational command center with live KPIs', image: '/images/hero-1.png' },
        { title: 'Test Drive Management', subtitle: 'Track every booking from schedule to completion', image: '/images/hero-2.png' },
        { title: 'GRO Assignment Flow', subtitle: 'One-click handover from GRO to Sales team', image: '/images/hero-3.png' },
        { title: 'Vehicle Tracking', subtitle: 'Real-time vehicle availability across locations', image: '/images/hero-4.png' },
        { title: 'Security Gate', subtitle: 'Check-in, license verification, and exit logging', image: '/images/hero-5.png' },
        { title: 'Data Center', subtitle: 'AI-powered analytics with conversion insights', image: '/images/hero-6.png' },
        { title: 'Communications', subtitle: 'Automated WhatsApp, Email & SMS workflows', image: '/images/hero-7.png' },
        { title: 'Multi-Location Ops', subtitle: 'Branch-level controls with unified reporting', image: '/images/hero-8.png' },
        { title: 'Enquiry Pipeline', subtitle: 'Lead scoring and action-oriented follow-ups', image: '/images/hero-9.png' },
    ];
    useEffect(() => {
        const slideInterval = setInterval(() => {
            setActiveHeroSlide((prev) => (prev + 1) % heroSlides.length);
        }, 4000);

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
        { icon: Car, title: 'Vehicle Management', desc: 'Complete vehicle lifecycle management — inventory, availability, location tracking.' },
        { icon: Users, title: 'Dealer CRM', desc: 'Unified customer relationship management with lead scoring and conversion tracking.' },
        { icon: CalendarCheck, title: 'Test Drive Management', desc: 'End-to-end booking lifecycle — assignment, key handover, inspection, completion.' },
        { icon: Warehouse, title: 'Vehicle Inventory', desc: 'Real-time inventory visibility across locations with stock levels.' },
        { icon: CreditCard, title: 'CPQ – Configure, Price, Quote', desc: 'Configure vehicles, apply pricing rules, and generate accurate quotes.' },
        { icon: Tag, title: 'Vehicle Reservation', desc: 'Allow customers to reserve vehicles with deposit management.' },
        { icon: ClipboardList, title: 'Order Management', desc: 'Track orders from placement to delivery with status updates.' },
        { icon: MessageCircle, title: 'Communication Module', desc: 'Multi-channel communication via WhatsApp, Email, and SMS.' },
        { icon: FolderOpen, title: 'Deal File Management', desc: 'AI-powered document management with auto-classification.' },
        { icon: BarChart3, title: 'Role Based Reports', desc: 'Pre-built reports tailored for each role with actionable KPIs.' },
        { icon: PieChart, title: 'Realtime Analytics & BI', desc: 'Live dashboards with AI-assisted insights for all operations.' },
        { icon: Smartphone, title: 'Showroom Sales App', desc: 'Mobile-first app for sales teams on the floor.' },
        { icon: Building2, title: 'AutoAdvant ERP', desc: 'Enterprise resource planning connecting all dealership operations.' },
        { icon: Package, title: 'Accessories', desc: 'Manage accessory catalog, pricing, and fitment scheduling.' },
        { icon: ShieldCheck, title: 'Insurance Products', desc: 'Integrated insurance offerings with comparison and tracking.' },
        { icon: Layers, title: 'Integrated PIM', desc: 'Centralized vehicle specs, media assets, and content management.' },
        { icon: FileText, title: 'Pricing Rules', desc: 'Configurable pricing engine with discount rules and approvals.' },
    ];


    const features = [
        {
            title: 'Lead Management',
            desc: 'Capture, organize, and track every automotive lead from inquiry to conversion.',
            icon: '📈',
        },
        {
            title: 'Test Drive Scheduling',
            desc: 'Streamline bookings, assignments, reminders, and vehicle availability in one place.',
            icon: '🚗',
        },
        {
            title: 'Dealer Operations',
            desc: 'Support multi-location dealerships with centralized workflows and clean visibility.',
            icon: '🏢',
        },
        {
            title: 'Performance Insights',
            desc: 'Monitor pipeline health, test drive outcomes, and sales performance with actionable dashboards.',
            icon: '📊',
        },
    ];

    const stats = [
        { value: '3x', label: 'Faster lead follow-up' },
        { value: '40%', label: 'Better booking efficiency' },
        { value: '24/7', label: 'Centralized platform access' },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground dark:text-white">
            <SiteHeader variant="landing" />

            <main className="dark bg-[hsl(220,50%,7%)] text-slate-100">
                <section className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.16),transparent_22%)]" />
                    <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
                        <div className="relative z-10 flex flex-col justify-center">
                            <div className="mb-5 inline-flex w-fit items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
                                Automotive SaaS + Marketplace Ready
                            </div>
                            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                                Drive more leads, manage test drives, and grow faster with <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">AutoAdvant</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                                A modern platform built for dealerships and automotive businesses to simplify lead handling, optimize test drive operations, and improve sales performance across every location.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <button className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]">
                                    Get Started
                                </button>
                                <button className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                                    View Platform
                                </button>
                            </div>

                            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {stats.map((item) => (
                                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
                                        <div className="text-2xl font-semibold text-white">{item.value}</div>
                                        <div className="mt-1 text-sm text-slate-400">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative z-10">
                            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-sky-900/20 backdrop-blur-xl sm:p-6">
                                <div className="rounded-[24px] border border-white/10 bg-slate-900 p-4 sm:p-6">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                        <div>
                                            <p className="text-sm text-slate-400">Dashboard Overview</p>
                                            <h3 className="mt-1 text-xl font-semibold">Dealer Growth Center</h3>
                                        </div>
                                        <div className="rounded-xl bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                                            Live Platform
                                        </div>
                                    </div>

                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-4">
                                            <p className="text-sm text-slate-400">Leads This Week</p>
                                            <p className="mt-2 text-3xl font-semibold">248</p>
                                            <p className="mt-2 text-sm text-emerald-300">+18% from last week</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-4">
                                            <p className="text-sm text-slate-400">Test Drives Booked</p>
                                            <p className="mt-2 text-3xl font-semibold">96</p>
                                            <p className="mt-2 text-sm text-sky-300">Smooth scheduling flow</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-800/70 p-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-slate-400">Pipeline Status</p>
                                            <p className="text-xs text-slate-500">Updated now</p>
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {[
                                                ['New Leads', '82%', 'w-[82%]'],
                                                ['Assigned Follow-ups', '67%', 'w-[67%]'],
                                                ['Test Drive Completion', '74%', 'w-[74%]'],
                                            ].map(([label, value, width]) => (
                                                <div key={label}>
                                                    <div className="mb-1 flex items-center justify-between text-sm">
                                                        <span className="text-slate-300">{label}</span>
                                                        <span className="text-slate-400">{value}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-700">
                                                        <div className={`h-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 ${width}`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="max-w-full">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Core Features</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built for modern automotive operations</h2>
                        <p className="mt-4 text-slate-400">
                            Everything your team needs to manage customer journeys, test drive workflows, and dealership performance in one elegant system.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {features.map((feature) => (
                            <div key={feature.title} className="rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-900/20 transition hover:-translate-y-1 hover:bg-white/[0.07]">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-2xl">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>


                <section id="features" className="mx-auto max-w-7xl px-4 py-8 sm:px-0 lg:px-0 lg:py-8">
                    <div className="max-w-2xl">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Complete DMS Platform</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built for modern automotive operations</h2>

                    </div>


                    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                                    className="rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-900/20 transition hover:-translate-y-1 hover:bg-white/[0.07]"
                                >
                                    <div className="flex items-center gap-3 mb-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl bg-sky-400/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-sm sm:text-base text-lg font-semibold text-white font-heading font-semibold text-foreground leading-none whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                                            {index + 1}. {module.title}
                                        </h3>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-400 mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                        {module.desc}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                <section id="benefits" className="border-y border-white/10 bg-white/[0.03]">
                    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
                        <div>
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Why AutoAdvant</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">An advantage for every dealership team</h2>
                            <p className="mt-4 max-w-xl text-slate-400">
                                AutoAdvant brings together lead tracking, smart booking workflows, reporting, and operational visibility so your team can move faster and convert more.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            {[
                                'Reduce lead leakage with structured follow-up workflows.',
                                'Give sales teams a cleaner view of each customer journey.',
                                'Support test drive assignments across multiple branches.',
                                'Create a premium digital experience for dealers and buyers.',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-600 text-xs font-bold text-white">✓</div>
                                    <p className="text-slate-300">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-cyan-400/10 p-8 shadow-xl shadow-sky-950/20 md:p-12">
                        <div className="grid gap-10 lg:grid-cols-2">
                            <div>
                                <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Get Started</p>
                                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Ready to modernize your automotive platform?</h2>
                                <p className="mt-4 text-slate-300">
                                    Launch faster with a platform built for lead generation, test drive management, and dealership growth.
                                </p>
                                <div className="mt-8 space-y-4">
                                    {[
                                        { icon: Mail, text: 'info@autoadvant.com' },
                                        { icon: Phone, text: '+91 98765 43210' },
                                        { icon: MapPin, text: 'Mumbai, India' },
                                    ].map((item) => (
                                        <div key={item.text} className="flex items-center gap-3 text-slate-300">
                                            <item.icon className="h-5 w-5 text-sky-400" />
                                            <span className="text-sm">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                {demoSubmitted ? (
                                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
                                            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                                        </div>
                                        <h3 className="text-xl font-semibold">Demo Request Sent!</h3>
                                        <p className="mt-2 text-sm text-slate-400">We've sent a confirmation to your email. Our team will reach out within 24 hours.</p>
                                        <button onClick={() => setDemoSubmitted(false)} className="mt-6 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                                            Submit Another
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleDemoRequest} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <input
                                                placeholder="Your Name"
                                                value={demoForm.name}
                                                onChange={e => setDemoForm(f => ({ ...f, name: e.target.value }))}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
                                                maxLength={100}
                                            />
                                            <input
                                                placeholder="Work Email *"
                                                type="email"
                                                value={demoForm.email}
                                                onChange={e => setDemoForm(f => ({ ...f, email: e.target.value }))}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
                                                maxLength={255}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <input
                                                placeholder="Company Name"
                                                value={demoForm.company}
                                                onChange={e => setDemoForm(f => ({ ...f, company: e.target.value }))}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
                                                maxLength={100}
                                            />
                                            <input
                                                placeholder="Phone Number"
                                                value={demoForm.phone}
                                                onChange={e => setDemoForm(f => ({ ...f, phone: e.target.value }))}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
                                                maxLength={20}
                                            />
                                        </div>
                                        <textarea
                                            placeholder="Tell us about your dealership needs..."
                                            value={demoForm.message}
                                            onChange={e => setDemoForm(f => ({ ...f, message: e.target.value }))}
                                            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none min-h-[100px] resize-none"
                                            maxLength={1000}
                                        />
                                        <button
                                            type="submit"
                                            disabled={demoLoading}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.01] disabled:opacity-50"
                                        >
                                            {demoLoading ? 'Sending...' : <><Send className="h-4 w-4" /> Book a Demo</>}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            {/* Footer */}
            <footer className="bg-background/80 backdrop-blur border-t border-border dark:bg-slate-950/80 dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
                    <a href="/" >

                        <div className="flex items-center justify-center py-1">
                            <img src="/images/autoadvant-logo.png" alt="Logo" className="h-[50px] w-full" />
                        </div>
                    </a>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        <Link to="/dealer-onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dealer Onboarding</Link>
                        <Link to="/compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare Vehicles</Link>
                        <Link to={staffEntryPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Login</Link>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">© {new Date().getFullYear()} AutoAdvant — Smart Test Drive & Lead Platform</p>
                </div>
            </footer>
            <EnquiryWidget />
        </div>
    );
}

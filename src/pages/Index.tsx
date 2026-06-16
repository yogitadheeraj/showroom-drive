import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { apiPost, apiGet } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Car, CalendarCheck, Shield, BarChart3, Users, ArrowRight, MapPin, Clock, CheckCircle2, Building2, Menu, X, GitCompareArrows, MessageCircle, Send, Phone, Mail, Warehouse, CreditCard, FileText, Package, Receipt, ClipboardList, Smartphone, FolderOpen, PieChart, DollarSign, ShieldCheck, Tag, Landmark, Layers } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import EnquiryWidget from '@/components/EnquiryWidget';
import SiteHeader from '@/components/SiteHeader';
import { useTheme } from '@/hooks/useTheme';
import { useWhitelabel } from '@/hooks/useWhitelabel';
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
    const { resolvedTheme } = useTheme();
    const brand = useWhitelabel();
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
            let customer = await apiGet<any>(`/api/customers?phone=${encodeURIComponent(demoForm.phone.trim() || 'demo-request')}&limit=1`)
              .then((res: any) => (Array.isArray(res) ? res[0] : null))
              .catch(() => null);

            if (!customer) {
                customer = await apiPost<any>('/api/customers', {
                    full_name: demoForm.name.trim() || 'Demo Request',
                    phone: demoForm.phone.trim() || `demo-${Date.now()}`,
                    email: demoForm.email.trim(),
                });
            }

            const commId = crypto.randomUUID();
            await apiPost('/api/communications', {
                id: commId,
                customer_id: customer.id,
                type: 'email',
                purpose: 'custom',
                sent_to: demoForm.email.trim(),
                subject: 'Book a Demo Request',
                body: `Demo request from ${demoForm.name || 'Website visitor'}. Company: ${demoForm.company || 'N/A'}. Message: ${demoForm.message || 'N/A'}`,
                status: 'pending',
            });

            // Send confirmation email
            await apiPost('/api/functions/send-transactional-email', {
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
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsLoggedIn(!!user);
        });

        return () => unsubscribe();
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

    const painPoints = [
        { icon: '📋', title: 'Scheduling Chaos', desc: 'Test drive bookings managed over WhatsApp, phone calls, and sticky notes — with zero centralization or visibility.' },
        { icon: '🔄', title: 'Lead Leakage', desc: 'Leads from walk-ins, websites, and campaigns fall through the cracks with no unified pipeline or assignment workflow.' },
        { icon: '👁️', title: 'Zero Real-Time Visibility', desc: 'Management has no live view of which vehicles are out, who is assigned, or what stage each lead is in right now.' },
        { icon: '📞', title: 'Manual Follow-Ups', desc: 'Sales teams manually call and message customers for every reminder — burning time on low-value, repetitive tasks.' },
        { icon: '📊', title: 'Fragmented Reporting', desc: 'Reports compiled manually from Excel sheets, riddled with errors, and always several days out of date.' },
        { icon: '🏢', title: 'Multi-Branch Blind Spots', desc: 'Group operations across locations have no unified command view, leading to duplicated effort and missed revenue opportunities.' },
    ];

    const roiStats = [
        { value: '3x', label: 'Faster Lead Follow-Up', detail: 'Automated workflows replace manual calling' },
        { value: '62%', label: 'Reduction in No-Shows', detail: 'Smart reminders via WhatsApp & SMS' },
        { value: '40%', label: 'More Test Drive Completions', detail: 'Structured assignment and real-time tracking' },
        { value: '100%', label: 'Digital Audit Trail', detail: 'Every action logged with timestamp and user' },
        { value: '5 min', label: 'Team Onboarding Time', detail: 'GROs and sales reps ready instantly' },
        { value: '2x', label: 'Conversion Rate Lift', detail: 'From first lead to completed test drive' },
    ];

    const journeySteps = [
        { step: '01', title: 'Lead Generated', desc: 'Walk-in, web form, or campaign capture' },
        { step: '02', title: 'Auto Assignment', desc: 'GRO assigned based on availability & location' },
        { step: '03', title: 'Customer Confirmation', desc: 'Automated WhatsApp / SMS sent instantly' },
        { step: '04', title: 'Test Drive Scheduled', desc: 'Slot booked, vehicle reserved, team notified' },
        { step: '05', title: 'Reminder Sent', desc: '24h and 1h automated pre-drive reminders' },
        { step: '06', title: 'Vehicle Tracked', desc: 'Key handover logged, route tracking optional' },
        { step: '07', title: 'Feedback Collected', desc: 'Post-drive survey triggered automatically' },
        { step: '08', title: 'Lead Converted', desc: 'Sales team notified with full journey context' },
    ];

    const integrations = [
        { name: 'WhatsApp Business', icon: '💬', category: 'Messaging' },
        { name: 'Twilio SMS', icon: '📱', category: 'SMS' },
        { name: 'Mailgun / SendGrid', icon: '📧', category: 'Email' },
        { name: 'Google Maps', icon: '🗺️', category: 'Location' },
        { name: 'Salesforce CRM', icon: '☁️', category: 'CRM' },
        { name: 'HubSpot', icon: '🔶', category: 'CRM' },
        { name: 'Zapier', icon: '⚡', category: 'Automation' },
        { name: 'Stripe', icon: '💳', category: 'Payments' },
        { name: 'Power BI', icon: '📊', category: 'Analytics' },
        { name: 'No SQL Database', icon: '🔋', category: 'Database' },
        { name: 'AWS / Azure', icon: '☁️', category: 'Infrastructure' },
        { name: 'Open API', icon: '🔌', category: 'Custom Integration' },
    ];

    const testimonials = [
        {
            name: 'Khalid Al-Rashidi',
            role: 'Role',
            region: 'region',
            quote: 'AutoAdvant transformed how we manage test drives across 6 branches. Lead leakage dropped to near zero within the first month of going live.',
            avatar: 'KA',
        },
        {
            name: 'Fatima Al-Mansouri',
            role: 'Head of Operations',
            region: 'UAE',
            quote: 'The real-time dashboard gives our management team instant visibility we never had before. We completely stopped relying on end-of-day WhatsApp update groups.',
            avatar: 'FA',
        },
        {
            name: 'Omar Yousef',
            role: 'GM ',
            region: 'KSA',
            quote: 'The customer journey automation alone recovered leads we were losing to slow follow-ups. The ROI within 90 days was undeniable and measurable.',
            avatar: 'OY',
        },
    ];

    const caseStudy = {
        dealer: 'Premium Auto Group',
        region: 'Dubai, UAE',
        challenge: 'Managing 200+ test drives per month across 4 showrooms using WhatsApp groups and Excel spreadsheets — with no visibility, no automation, and persistently high no-show rates.',
        results: [
            '3x increase in booked test drives within 60 days of going live',
            '68% reduction in no-shows via automated WhatsApp & SMS reminders',
            'Full real-time pipeline visibility for senior management — live, not next-day',
            'Sales team NPS improved by 40 points post-rollout',
        ],
    };

    return (
        <div className="min-h-screen bg-background text-foreground dark:text-white">
            <SiteHeader variant="landing" dealerName={brand.dealerName} dealerLogoUrl={brand.dealerLogoUrl} />

            <main className={`landing-main bg-background text-foreground${resolvedTheme === 'dark' ? ' dark' : ''}`}>
                <section className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.16),transparent_22%)]" />
                    <div className="mx-auto grid max-w-7xl gap-12 px-4 py-8 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-10">
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

                            <div className="mt-8 flex flex-wrap gap-3">
                                <a href="#contact" className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]">
                                    Book Live Demo
                                </a>
                                <a href="#contact" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20">
                                    Start Pilot Program
                                </a>
                                <a href="#contact" className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                                    Request Dealer Access
                                </a>
                             
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

                {/* ── Dealer Pain Points ── */}
                <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">Dealer Pain Points</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sound familiar?</h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">These are the operational challenges costing dealerships time, leads, and revenue every single day.</p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {painPoints.map((point) => (
                            <div key={point.title} className="rounded-[24px] border border-rose-400/15 bg-rose-400/5 p-6 transition hover:border-rose-400/30 hover:bg-rose-400/10">
                                <div className="mb-4 text-3xl">{point.icon}</div>
                                <h3 className="text-lg font-semibold text-white">{point.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-400">{point.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── ROI Impact Numbers ── */}
                <section className="border-y border-white/10 bg-gradient-to-r from-sky-950/40 via-blue-950/30 to-slate-900/50">
                    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                        <div className="text-center mb-12">
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Platform ROI</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Real numbers. Real results.</h2>
                            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Dealerships on AutoAdvant see measurable improvements within the first 30 days of going live.</p>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {roiStats.map((stat) => (
                                <div key={stat.label} className="rounded-[24px] border border-sky-400/20 bg-sky-400/5 p-6 text-center">
                                    <div className="text-5xl font-bold bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">{stat.value}</div>
                                    <div className="mt-3 text-lg font-semibold text-white">{stat.label}</div>
                                    <div className="mt-2 text-sm text-slate-400">{stat.detail}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 3D Scroll Animated Feature Showcase ── */}
                <section className="relative overflow-hidden py-24 sm:py-32">
                    {/* Ambient background glow */}
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
                        <div className="absolute right-1/4 bottom-0 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-blue-600/10 blur-[100px]" />
                    </div>
                    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <motion.div
                            className="text-center mb-16"
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Platform Capabilities</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                                Everything works{' '}
                                <span className="bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                    together
                                </span>
                            </h2>
                            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
                                Each module is built to connect — from the first lead to the signed deal, every action flows through one unified system.
                            </p>
                        </motion.div>

                        {/* 3D perspective cards grid */}
                        <div className="grid gap-8 md:grid-cols-3" style={{ perspective: '1200px' }}>
                            {[
                                {
                                    accent: 'from-sky-400 to-blue-600',
                                    glow: 'bg-sky-500/15',
                                    border: 'border-sky-400/20',
                                    icon: '🚀',
                                    title: 'Instant Lead Capture',
                                    desc: 'Every walk-in, web form, and campaign lead lands in one pipeline. Auto-assigned, tracked, and never lost.',
                                    badge: 'Lead Management',
                                    stats: [{ label: 'Capture Rate', value: '99%' }, { label: 'Avg Response', value: '< 2 min' }],
                                },
                                {
                                    accent: 'from-emerald-400 to-teal-600',
                                    glow: 'bg-emerald-500/15',
                                    border: 'border-emerald-400/20',
                                    icon: '🗓️',
                                    title: 'Smart Scheduling',
                                    desc: 'Real-time slot availability, vehicle reservation, and automated confirmations — zero manual coordination needed.',
                                    badge: 'Test Drive Ops',
                                    stats: [{ label: 'Booking Time', value: '< 90 sec' }, { label: 'No-Show Drop', value: '62%' }],
                                },
                                {
                                    accent: 'from-violet-400 to-purple-600',
                                    glow: 'bg-violet-500/15',
                                    border: 'border-violet-400/20',
                                    icon: '📊',
                                    title: 'Live Intelligence',
                                    desc: 'Role-based dashboards with real-time KPIs. Directors, managers, and reps each see exactly what they need.',
                                    badge: 'Analytics & BI',
                                    stats: [{ label: 'Data Freshness', value: 'Real-time' }, { label: 'Roles Supported', value: '8+' }],
                                },
                            ].map((card, i) => (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, rotateX: 25, y: 60 }}
                                    whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                                    whileHover={{ rotateY: 4, rotateX: -4, scale: 1.03, z: 30 }}
                                    style={{ transformStyle: 'preserve-3d' }}
                                    className="group relative rounded-[28px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm shadow-2xl shadow-slate-900/40 cursor-default"
                                >
                                    {/* Glow blob */}
                                    <div className={`absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${card.glow} blur-xl`} />
                                    {/* Top accent line */}
                                    <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${card.accent} opacity-60`} />

                                    <div className="relative z-10">
                                        {/* Badge */}
                                        <div className={`mb-5 inline-flex items-center rounded-full border ${card.border} bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300`}>
                                            {card.badge}
                                        </div>

                                        {/* Icon */}
                                        <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-3xl shadow-lg`}>
                                            {card.icon}
                                        </div>

                                        {/* Title & desc */}
                                        <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                                        <p className="mt-3 text-sm leading-6 text-slate-400">{card.desc}</p>

                                        {/* Mini stats */}
                                        <div className="mt-6 grid grid-cols-2 gap-3">
                                            {card.stats.map((s) => (
                                                <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                                    <div className={`text-lg font-bold bg-gradient-to-r ${card.accent} bg-clip-text text-transparent`}>{s.value}</div>
                                                    <div className="mt-1 text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Bottom floating 3D ticker bar */}
                        <motion.div
                            className="mt-16 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-sm"
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <div className="flex items-center gap-0 overflow-hidden">
                                <div className="flex shrink-0 animate-[scroll_28s_linear_infinite] gap-0 whitespace-nowrap">
                                    {[
                                        '🚗 Test Drive Booked',
                                        '✅ GRO Assigned',
                                        '📩 WhatsApp Sent',
                                        '🔑 Key Handover Logged',
                                        '📊 Report Generated',
                                        '💬 Customer Feedback Received',
                                        '📈 Conversion Tracked',
                                        '🏢 Multi-Branch Synced',
                                        '⚡ Lead Auto-Assigned',
                                        '🗓️ Slot Reserved',
                                    ].concat([
                                        '🚗 Test Drive Booked',
                                        '✅ GRO Assigned',
                                        '📩 WhatsApp Sent',
                                        '🔑 Key Handover Logged',
                                        '📊 Report Generated',
                                        '💬 Customer Feedback Received',
                                        '📈 Conversion Tracked',
                                        '🏢 Multi-Branch Synced',
                                        '⚡ Lead Auto-Assigned',
                                        '🗓️ Slot Reserved',
                                    ]).map((item, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-2 px-6 py-4 text-sm text-slate-400 border-r border-white/5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── Product Screenshots ── */}
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Product Screenshots</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">See the platform in action</h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">A clean, modern interface designed for speed. Every screen is built around dealer workflows.</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {[
                            { img: showcaseAdminDashboard, title: 'Admin Command Center', desc: 'Live KPIs, pipeline health, and team performance in one unified view.' },
                            { img: showcaseBooking, title: 'Test Drive Booking Flow', desc: 'Frictionless scheduling with real-time slot availability and auto-confirmation.' },
                            { img: showcaseGroAssign, title: 'GRO Assignment & Handover', desc: 'One-click assignment with key handover tracking and full audit trail.' },
                        ].map((screenshot) => (
                            <div key={screenshot.title} className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/60">
                                <div className="overflow-hidden rounded-t-[24px]">
                                    <img
                                        src={screenshot.img}
                                        alt={screenshot.title}
                                        className="w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                    />
                                </div>
                                <div className="p-5">
                                    <h3 className="font-semibold text-white">{screenshot.title}</h3>
                                    <p className="mt-2 text-sm text-slate-400">{screenshot.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Customer Journey Flow ── */}
                <section className="border-y border-white/10 bg-white/[0.02]">
                    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                        <div className="text-center mb-14">
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Customer Journey</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From lead to conversion — fully automated</h2>
                            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Every step is tracked, automated, and visible in real-time. Directors understand the product the moment they see this.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {journeySteps.map((step, index) => (
                                <div key={step.step} className="relative rounded-[20px] border border-sky-400/20 bg-sky-400/5 p-5 transition hover:bg-sky-400/10">
                                    {index < journeySteps.length - 1 && (
                                        <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-sky-400/50 text-xl font-bold lg:block z-10">→</div>
                                    )}
                                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-xs font-bold text-white shrink-0">
                                        {step.step}
                                    </div>
                                    <h3 className="font-semibold text-white text-sm">{step.title}</h3>
                                    <p className="mt-1 text-xs text-slate-400 leading-5">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Integrations ── */}
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Integrations</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Connects with your existing stack</h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">AutoAdvant integrates natively with the tools your team already uses — or works standalone out of the box.</p>
                    </div>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {integrations.map((integration) => (
                            <div key={integration.name} className="flex flex-col items-center gap-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-center transition hover:bg-white/[0.08]">
                                <div className="text-2xl">{integration.icon}</div>
                                <div className="text-xs font-medium text-white leading-tight">{integration.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide">{integration.category}</div>
                            </div>
                        ))}
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

                {/* ── Testimonials ── */}
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Testimonials</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Trusted by automotive teams</h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Hear from the directors and operations leads who run their dealerships on AutoAdvant.</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {testimonials.map((t) => (
                            <div key={t.name} className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/5 p-6">
                                <p className="text-sm leading-7 text-slate-300 italic flex-1">"{t.quote}"</p>
                                <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold text-white">
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white text-sm">{t.name}</p>
                                        <p className="text-xs text-slate-400">{t.role}</p>
                                        <p className="text-xs text-sky-400 mt-0.5">{t.region}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── UAE / KSA Positioning ── */}
                <section className="border-y hidden border-white/10 bg-gradient-to-r from-emerald-950/30 via-teal-950/20 to-slate-900/40">
                    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                        <div className="grid gap-10 lg:grid-cols-2 items-center">
                            <div>
                                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Built for the Region</p>
                                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Purpose-built for UAE & KSA automotive markets</h2>
                                <p className="mt-4 text-slate-300">AutoAdvant is designed with Gulf region dealership workflows in mind — not a generic CRM retrofitted for automotive.</p>
                                <div className="mt-8 space-y-4">
                                    {[
                                        { icon: '🇦🇪', title: 'UAE Compliant', desc: 'RTA-ready workflows, UAE trade license integration, Emirates ID verification support.' },
                                        { icon: '🇸🇦', title: 'KSA Ready', desc: 'SAMA-aligned data handling, Arabic RTL interface, VAT-compliant transaction logging.' },
                                        { icon: '🌐', title: 'Arabic & English', desc: 'Full bilingual interface with instant language switching across all modules.' },
                                        { icon: '⏰', title: 'Gulf Calendar & Timezone', desc: 'Hijri calendar support, UAE/KSA public holiday awareness built into scheduling.' },
                                    ].map((item) => (
                                        <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                                            <div className="text-2xl shrink-0">{item.icon}</div>
                                            <div>
                                                <p className="font-semibold text-white">{item.title}</p>
                                                <p className="text-sm text-slate-400 mt-1">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8">
                                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Market Traction</p>
                                <h3 className="mt-3 text-2xl font-semibold text-white">Leading the Gulf's automotive digital transformation</h3>
                                <div className="mt-6 grid grid-cols-2 gap-4">
                                    {[
                                        { value: '15+', label: 'Dealer Groups Onboarded' },
                                        { value: '6', label: 'Countries in MEA Region' },
                                        { value: '50K+', label: 'Test Drives Managed' },
                                        { value: '99.9%', label: 'Platform Uptime SLA' },
                                    ].map((stat) => (
                                        <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="text-2xl font-bold text-emerald-400">{stat.value}</div>
                                            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Case Study ── */}
                <section className="mx-auto hidden max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="text-center mb-12">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Case Study</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From chaos to control in 60 days</h2>
                    </div>
                    <div className="rounded-[32px] border border-sky-400/20 bg-gradient-to-br from-sky-950/40 to-blue-950/30 p-8 md:p-12">
                        <div className="grid gap-8 lg:grid-cols-2 items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-2xl">🏢</div>
                                    <div>
                                        <p className="font-semibold text-white">{caseStudy.dealer}</p>
                                        <p className="text-sm text-sky-400">{caseStudy.region}</p>
                                    </div>
                                </div>
                                <p className="text-xs font-medium uppercase tracking-[0.15em] text-rose-400 mb-2">The Challenge</p>
                                <p className="text-slate-300 leading-7 text-sm">{caseStudy.challenge}</p>
                                <p className="mt-6 text-xs font-medium uppercase tracking-[0.15em] text-emerald-400 mb-3">Results After 60 Days</p>
                                <div className="space-y-3">
                                    {caseStudy.results.map((result) => (
                                        <div key={result} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-xs text-emerald-400">✓</div>
                                            <p className="text-slate-300 text-sm">{result}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { before: 'WhatsApp Groups', after: 'Centralized Platform', label: 'Coordination' },
                                    { before: '48hr Response', after: '<2hr Response', label: 'Lead Follow-Up' },
                                    { before: '22% Show Rate', after: '68% Show Rate', label: 'Test Drive Attendance' },
                                    { before: 'Manual Reporting', after: 'Live Dashboard', label: 'Performance Visibility' },
                                ].map((metric) => (
                                    <div key={metric.label} className="rounded-[20px] border border-white/10 bg-slate-900/60 p-4">
                                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">{metric.label}</p>
                                        <p className="text-sm text-rose-400 line-through opacity-70 mb-1">{metric.before}</p>
                                        <p className="text-sm font-semibold text-emerald-400">{metric.after}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
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

                {/* ── Security & Scalability ── */}
                <section className="border-y border-white/10 bg-white/[0.02]">
                    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                        <div className="text-center mb-12">
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Security & Scalability</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Enterprise-grade. Dealership-ready.</h2>
                            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Built on a security-first architecture that scales from a single showroom to a 50-branch dealership group without breaking a sweat.</p>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { icon: '🔐', title: 'Row-Level Security', desc: 'No SQL RLS ensures each role only accesses their permitted data — enforced at the database level, not the application layer.' },
                                { icon: '🛡️', title: 'SOC 2 Infrastructure', desc: 'Hosted on AWS/Azure infrastructure with SOC 2 Type II compliance and a 99.9% uptime SLA guarantee.' },
                                { icon: '🔑', title: 'Role-Based Access Control', desc: '8 distinct user roles with granular permission scopes — from Superadmin to Reception, each access boundary is precisely defined.' },
                                { icon: '📋', title: 'Full Audit Trail', desc: 'Every action — key handovers, assignments, status changes — is permanently logged with a timestamp and user ID.' },
                                { icon: '📈', title: 'Horizontal Scalability', desc: 'Auto-scaling infrastructure handles peak showroom hours, multi-branch loads, and high-traffic campaign surges seamlessly.' },
                            ].map((item) => (
                                <div key={item.title} className="rounded-[24px] border border-white/10 bg-white/5 p-6 transition hover:bg-white/[0.07]">
                                    <div className="mb-4 text-3xl">{item.icon}</div>
                                    <h3 className="font-semibold text-white">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Strong CTA Section ── */}
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <div className="rounded-[32px] border border-sky-400/20 bg-gradient-to-br from-sky-950/60 via-blue-950/40 to-slate-900/60 p-8 md:p-12 text-center">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">Choose Your Entry Point</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl text-white">Ready to run your dealership smarter?</h2>
                        <p className="mt-4 text-slate-300 max-w-2xl mx-auto">Whether you need a live demo, a risk-free pilot, immediate access, or an expert consultation — we have a path that fits.</p>
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                { label: 'Book Live Demo', desc: 'See AutoAdvant live in 30 minutes', primary: true },
                                { label: 'Start Pilot Program', desc: '30-day free pilot for your dealership', primary: false },
                                { label: 'Request Dealer Access', desc: 'Get your team onboarded fast', primary: false },
                                { label: 'Talk to Automotive Expert', desc: 'Chat directly with a specialist', primary: false },
                            ].map((cta) => (
                                <a
                                    key={cta.label}
                                    href="#contact"
                                    className={`group rounded-[20px] border p-5 text-left transition ${cta.primary ? 'border-sky-400/40 bg-gradient-to-br from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30' : 'border-white/10 bg-white/5 hover:bg-white/[0.09]'}`}
                                >
                                    <p className={`font-semibold text-sm ${cta.primary ? 'text-sky-300' : 'text-white'}`}>{cta.label}</p>
                                    <p className="mt-1 text-xs text-slate-400">{cta.desc}</p>
                                    <ArrowRight className={`mt-4 h-4 w-4 transition group-hover:translate-x-1 ${cta.primary ? 'text-sky-400' : 'text-slate-500'}`} />
                                </a>
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
                                        { icon: Phone, text: '+91 8*********' },
                                        { icon: MapPin, text: 'Noida, India' },
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

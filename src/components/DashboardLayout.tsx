import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { apiGet, apiDbQuery, apiPatch } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useWhitelabel } from '@/hooks/useWhitelabel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  type LucideIcon,
  Car, LayoutDashboard, Users, Shield, CalendarCheck,
  LogOut, MapPin, BarChart3, MessageSquare, Menu, X, Inbox, Settings, UserCircle2, Bell, ClipboardCheck, BookOpen, ScrollText, PlaneLanding, Truck, ChevronLeft, ChevronRight, Network
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { APP_ROLE, AppRole, DEFAULT_APP_ROLE } from '@/constants/roles';
import { getAppRoleLabel } from '@/lib/roles';
import { logStaffActivity, updateActivitySession } from '@/lib/activityLogger';
import SiteHeader from '@/components/SiteHeader';
import AiChatPanel from '@/components/AiChatPanel';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS: Partial<Record<AppRole, NavItem[]>> = {
  [APP_ROLE.SUPERADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Car Bookings', path: '/car-bookings', icon: BookOpen },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Fleet', path: '/fleet', icon: Truck },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Entity Brands', path: '/entity-brands', icon: Car },
    { label: 'Hierarchy', path: '/hierarchy', icon: Network },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Reports', path: '/reports/monitoring', icon: BarChart3 },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.DEALER_ADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Car Bookings', path: '/car-bookings', icon: BookOpen },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Fleet', path: '/fleet', icon: Truck },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Entity Brands', path: '/entity-brands', icon: Car },
    { label: 'Hierarchy', path: '/hierarchy', icon: Network },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Reports', path: '/reports/monitoring', icon: BarChart3 },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.SALES_ADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Car Bookings', path: '/car-bookings', icon: BookOpen },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Fleet', path: '/fleet', icon: Truck },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Entity Brands', path: '/entity-brands', icon: Car },
    { label: 'Hierarchy', path: '/hierarchy', icon: Network },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Reports', path: '/reports/monitoring', icon: BarChart3 },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.GRO]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Incoming Vehicles', path: '/incoming-vehicles', icon: Truck },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.SALES_PERSON]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'My Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Car Bookings', path: '/car-bookings', icon: BookOpen },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Incoming Vehicles', path: '/incoming-vehicles', icon: Truck },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.SALES]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Follow-ups', path: '/follow-ups', icon: ClipboardCheck },
    { label: 'My Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Car Bookings', path: '/car-bookings', icon: BookOpen },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Incoming Vehicles', path: '/incoming-vehicles', icon: Truck },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
  [APP_ROLE.SECURITY]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Incoming Vehicles', path: '/incoming-vehicles', icon: Truck },
    { label: 'Fleet', path: '/fleet', icon: Car },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
  ],
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, role, profile, signOut, refreshProfile } = useAuth();
  console.log('DashboardLayout render:', { user, role, profile });
  const { dealerLocations, selectedLocationId, setSelectedLocationId, dealerName: ctxDealerName, dealerLogoUrl: ctxDealerLogoUrl } = useDealerContext();
  const wl = useWhitelabel();
  // Whitelabel branding takes precedence; fall back to DealerContext values
  const dealerName    = wl.dealerName    ?? ctxDealerName;
  const dealerLogoUrl = wl.dealerLogoUrl ?? ctxDealerLogoUrl;
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [endingLeave, setEndingLeave] = useState(false);
  const leadPollRef = useRef({
    lastCheckedAt: new Date().toISOString(),
    seenIds: new Set<string>(),
  });
  const activityStateRef = useRef({
    lastTickAt: Date.now(),
    lastInteractionAt: Date.now(),
    isIdle: false,
  });
  const remindedTaskIdsRef = useRef<Set<string>>(new Set());
  const reminderDigestRef = useRef<string>('');
  const [followUpReminderConfig, setFollowUpReminderConfig] = useState({
    reminder_enabled: false,
    reminder_before_minutes: 30,
    reminder_message: 'Follow-up due soon: {{title}} at {{dueAt}}',
    tone_type: 'classic',
    notify_due_list: true,
  });

  const playReminderTone = (toneType = 'classic') => {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const tonesByType: Record<string, Array<{ frequency: number; duration: number }>> = {
        soft: [{ frequency: 660, duration: 0.18 }],
        alert: [
          { frequency: 920, duration: 0.16 },
          { frequency: 760, duration: 0.16 },
        ],
        classic: [{ frequency: 880, duration: 0.24 }],
      };

      const sequence = tonesByType[toneType] || tonesByType.classic;
      let startAt = ctx.currentTime;

      sequence.forEach((tone) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = tone.frequency;
        gain.gain.value = 0.02;
        gain.gain.setTargetAtTime(0, startAt, 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + tone.duration);

        startAt += tone.duration + 0.04;
      });
    } catch {
      // No-op for unsupported or blocked autoplay contexts.
    }
  };

  const toggleCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch { /* ok */ }
      return next;
    });
  };

  const navItems = NAV_ITEMS[role ?? DEFAULT_APP_ROLE] ?? [];
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Staff User';
  const displayRole = role ? getAppRoleLabel(role) : 'Staff';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleOpenLeadNotifications = () => {
    setNewLeadCount(0);
    navigate('/test-drives');
  };

  useEffect(() => {
    if (!user || !profile?.id || !role) return;

    void logStaffActivity({
      userId: user.id,
      profileId: profile.id,
      locationId: profile.location_id,
      role,
      eventType: 'page_view',
      label: `Visited ${location.pathname}`,
      route: location.pathname,
    });
  }, [location.pathname, profile?.id, profile?.location_id, role, user]);

  useEffect(() => {
    if (!profile?.location_id) return;

    const fetchReminderConfig = async () => {
      try {
        const row = await apiGet<any>(`/api/follow-up-reminder-config/${encodeURIComponent(profile.location_id)}`);

        if (!row) return;

        setFollowUpReminderConfig((prev) => ({
          reminder_enabled: row.reminder_enabled,
          reminder_before_minutes: Number(row.reminder_before_minutes) > 0
            ? Number(row.reminder_before_minutes)
            : prev.reminder_before_minutes,
          reminder_message: String(row.reminder_message || prev.reminder_message),
          tone_type: String(row.tone_type || prev.tone_type),
          notify_due_list: row.notify_due_list !== false,
        }));
      } catch {
        // Config is optional; defaults are used if unavailable.
      }
    };

    void fetchReminderConfig();
  }, [profile?.location_id]);

  useEffect(() => {
    if (!profile?.id) return;
    if (!followUpReminderConfig.reminder_enabled) return;
console.log('Setting up follow-up reminder polling with config:', followUpReminderConfig);
    const pollDueFollowUps = async () => {
      const now = new Date();
      const soon = new Date(
        now.getTime() + Math.max(1, Number(followUpReminderConfig.reminder_before_minutes || 30)) * 60 * 1000
      );

      const dueTasks = await apiDbQuery<any[]>({
        table: 'sales_tasks',
        action: 'select',
        select: 'id, title, due_at, status',
        filters: [
          { field: 'status', op: 'eq', value: 'open' },
          { field: 'assigned_to_profile_id', op: 'eq', value: profile.id },
          { field: 'due_at', op: 'lte', value: soon.toISOString() },
        ],
        order: [{ field: 'due_at', ascending: true }],
        limit: 20,
      });

      const actionableTasks = (dueTasks || []).filter((task) =>
        task?.id && task?.due_at && String(task?.title || '').trim().length > 0
      );

      const newlyReminded: any[] = [];

      actionableTasks.forEach((task) => {
        if (!task?.id || remindedTaskIdsRef.current.has(task.id)) return;
        remindedTaskIdsRef.current.add(task.id);
        newlyReminded.push(task);

        const dueAt = task.due_at ? new Date(task.due_at) : null;
        const dueText = dueAt
          ? dueAt.getTime() <= now.getTime()
            ? `now (${dueAt.toLocaleString()})`
            : `${dueAt.toLocaleString()}`
          : 'now';

        const template = followUpReminderConfig.reminder_message || 'Follow-up due soon: {{title}} at {{dueAt}}';
        const text = template
          .replace('{{title}}', task.title || 'Task')
          .replace('{{dueAt}}', dueText);

        toast({
          title: 'Follow-up Reminder',
          description: text,
        });
        playReminderTone(followUpReminderConfig.tone_type);
      });

      if (followUpReminderConfig.notify_due_list && actionableTasks.length > 0) {
        const digest = actionableTasks.map((task) => task.id).join('|');
        if (digest !== reminderDigestRef.current && newlyReminded.length > 0) {
          reminderDigestRef.current = digest;
          const preview = actionableTasks
            .slice(0, 5)
            .map((task) => `• ${task.title || 'Task'} (${new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`)
            .join('\n');

          toast({
            title: `Follow-up List (${actionableTasks.length})`,
            description: preview,
          });
        }
      }
    };

    void pollDueFollowUps();
    const intervalId = window.setInterval(() => {
      void pollDueFollowUps();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    followUpReminderConfig.notify_due_list,
    followUpReminderConfig.reminder_before_minutes,
    followUpReminderConfig.reminder_enabled,
    followUpReminderConfig.reminder_message,
    followUpReminderConfig.tone_type,
    profile?.id,
    toast,
  ]);

  useEffect(() => {
    if (!user || !role) return;

    let cancelled = false;
    leadPollRef.current.lastCheckedAt = new Date().toISOString();
    leadPollRef.current.seenIds.clear();

    const pollLeads = async () => {
      const nowIso = new Date().toISOString();
      const params = new URLSearchParams({
        created_at_gte: leadPollRef.current.lastCheckedAt,
        include_related: 'false',
        limit: '200',
      });
      if (role !== APP_ROLE.SUPERADMIN && profile?.location_id) {
        params.set('location_id', profile.location_id);
      }

      try {
        const leads = await apiGet<any[]>(`/api/test-drives?${params}`);

        if (cancelled) return;

        let increment = 0;
        (leads || []).forEach((lead: any) => {
          if (!lead?.id || leadPollRef.current.seenIds.has(lead.id)) return;
          leadPollRef.current.seenIds.add(lead.id);
          increment += 1;
        });

        if (increment > 0) {
          setNewLeadCount((count) => Math.min(count + increment, 99));
        }
      } catch {
        // Intentionally no toast: this polling is best-effort only.
      } finally {
        leadPollRef.current.lastCheckedAt = nowIso;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollLeads();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [profile?.location_id, role, user]);

  useEffect(() => {
    if (!user || !profile?.id || !role) return;

    const markInteraction = () => {
      const now = Date.now();
      const wasIdle = activityStateRef.current.isIdle;
      activityStateRef.current.lastInteractionAt = now;

      if (wasIdle) {
        activityStateRef.current.isIdle = false;
        void logStaffActivity({
          userId: user.id,
          profileId: profile.id,
          locationId: profile.location_id,
          role,
          eventType: 'active_resume',
          label: 'Returned from idle',
          route: location.pathname,
        });
      }
    };

    const syncActivity = () => {
      const now = Date.now();
      const elapsedSeconds = Math.max(1, Math.round((now - activityStateRef.current.lastTickAt) / 1000));
      const shouldBeIdle = document.hidden || now - activityStateRef.current.lastInteractionAt > 5 * 60 * 1000;

      if (shouldBeIdle !== activityStateRef.current.isIdle) {
        activityStateRef.current.isIdle = shouldBeIdle;
        void logStaffActivity({
          userId: user.id,
          profileId: profile.id,
          locationId: profile.location_id,
          role,
          eventType: shouldBeIdle ? 'idle_start' : 'active_resume',
          label: shouldBeIdle ? 'Went idle' : 'Returned from idle',
          route: location.pathname,
        });
      }

      void updateActivitySession({
        activeSeconds: shouldBeIdle ? 0 : elapsedSeconds,
        idleSeconds: shouldBeIdle ? elapsedSeconds : 0,
        lastSeenAt: new Date(now).toISOString(),
        isOnline: true,
      });

      activityStateRef.current.lastTickAt = now;
    };

    activityStateRef.current.lastTickAt = Date.now();
    activityStateRef.current.lastInteractionAt = Date.now();
    activityStateRef.current.isIdle = false;

    const intervalId = window.setInterval(syncActivity, 60_000);
    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

    events.forEach((eventName) => window.addEventListener(eventName, markInteraction, { passive: true }));
    document.addEventListener('visibilitychange', markInteraction);

    return () => {
      window.clearInterval(intervalId);
      events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
      document.removeEventListener('visibilitychange', markInteraction);
    };
  }, [location.pathname, profile?.id, profile?.location_id, role, user]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl transform transition-all duration-200 lg:translate-x-0 lg:static flex-shrink-0 ${
        sidebarCollapsed ? 'w-[60px]' : 'w-64'
      } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className={`bg-[hsl(220,50%,10%)] flex items-center dark:bg-[hsl(220,50%,10%)] px-2 py-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
           
           <Link to="/" className="flex items-center shrink-0">
            {(dealerLogoUrl || dealerName) ? (
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-2">
                  {dealerLogoUrl && (
                    <img
                      src={dealerLogoUrl}
                      alt={dealerName || 'Dealer'}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  )}
                  {!sidebarCollapsed && dealerName && (
                    <span className="text-base font-bold text-white dark:text-slate-100 truncate max-w-[180px]">
                      {dealerName}
                    </span>
                  )}
                </div>
             
              </div>
            ) : (
              <> {
                !sidebarCollapsed && (
              <img src="/images/autoadvant-logo.png" alt="AutoAdvant" className="h-10 w-auto" />
            )}
            {sidebarCollapsed && (
              <img src="/images/auth_logo.png" alt="AutoAdvant" className="h-8 w-8 object-contain rounded" />
            )}</>
            )}
          </Link>
            <div className="flex items-center gap-1">
              {/* Desktop collapse toggle */}
              <button
                onClick={toggleCollapsed}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden lg:flex h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              {/* Mobile close */}
              <button onClick={() => setSidebarOpen(false)} className="flex lg:hidden h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <TooltipProvider delayDuration={0}>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-hidden">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const linkEl = (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      sidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-400 to-blue-600 text-white font-medium shadow-md shadow-blue-500/20'
                        : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && item.label}
                  </Link>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return linkEl;
              })}
            </nav>
          </TooltipProvider>

          <div className={`p-3 border-t border-sidebar-border space-y-2 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            {!sidebarCollapsed && (
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-sidebar-border/50 shrink-0">
                    {displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</p>
                    <p className="text-xs text-sidebar-foreground/70 truncate">{displayRole}</p>
                    <p className="text-[11px] text-sidebar-foreground/60 truncate">{profile?.email || user?.email}</p>
                  </div>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/my-profile" className="h-9 w-9 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-sidebar-border/50">
                      {displayName?.[0]?.toUpperCase() || 'U'}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-muted-foreground">{displayRole}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {sidebarCollapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button variant="outline" size="sm" className="w-full justify-center border-sidebar-border text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out Securely
              </Button>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <SiteHeader
          variant="app"
          showNav={false}
          showLogo={false}
          dealerName={''}
          dealerLogoUrl={''}
          leftSlot={
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground dark:text-slate-100">
              <Menu className="h-5 w-5" />
              
            </button>
          }
          rightSlot={
            <>
              {role === APP_ROLE.DEALER_ADMIN && dealerLocations.length > 1 && (
            <div className="flex items-center gap-3 rounded-xl bg-transparent">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by location:</span>
              <Select
                value={selectedLocationId ?? 'all_locations'}
                onValueChange={(v) => setSelectedLocationId(v === 'all_locations' ? null : v)}
              >
                <SelectTrigger className="h-8 w-64 max-w-full text-sm">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_locations">All Locations</SelectItem>
                  {dealerLocations.filter((loc) => Boolean(loc.id)).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLocationId && (
                <button
                  type="button"
                  onClick={() => setSelectedLocationId(null)}
                  className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={handleOpenLeadNotifications}
              >
                <Bell className="h-4 w-4 mr-1.5" />
                New Leads
                {newLeadCount > 0 && (
                  <span className="ml-1.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {newLeadCount > 99 ? '99+' : newLeadCount}
                  </span>
                )}
              </Button>
              <Link
                to="/my-profile"
                className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 hover:bg-muted/80 transition-colors dark:border-white/10 dark:bg-white/5"
              >
                <UserCircle2 className="h-4 w-4 text-muted-foreground dark:text-slate-300" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-foreground max-w-[180px] truncate dark:text-slate-100">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground dark:text-slate-400">{displayRole}</p>
                </div>
              </Link>
             
              
            </>
          }
        />
        <div className="p-3 sm:p-6 animate-fade-in">
          {/* ── On-Leave Banner ── */}
          {profile?.on_leave && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-900/20">
              <span className="text-xl shrink-0">✈️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">You are currently on leave</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  New leads and test drives will <strong>not</strong> be assigned to you today.
                  {profile.leave_end_date && (
                    <> Your leave ends on <strong>{profile.leave_end_date}</strong>.</>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Button
                    size="sm"
                    disabled={endingLeave}
                    onClick={async () => {
                      if (!profile?.id) return;
                      setEndingLeave(true);
                      try {
                        await apiPatch(`/api/profiles/${profile.id}`, { on_leave: false, leave_start_date: null, leave_end_date: null });
                        await refreshProfile();
                        toast({ title: "You're available", description: "Leave ended. Leads can be assigned to you again." });
                      } finally {
                        setEndingLeave(false);
                      }
                    }}
                    className="bg-success text-success-foreground hover:bg-success/90 h-7 text-xs"
                  >
                    <PlaneLanding className="h-3.5 w-3.5 mr-1.5" />
                    {endingLeave ? 'Updating...' : "I'm Available Now"}
                  </Button>
                  <Link to="/my-profile" className="text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline">
                    Manage in My Profile
                  </Link>
                </div>
              </div>
            </div>
          )}
        
          {children}
        </div>
      </main>

      {/* Floating AI Assistant button */}
      <button
        type="button"
        onClick={() => setAiChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        title="Ask AutoAdvant AI"
        aria-label="Open AI assistant"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </button>

      {/* AI Chat Panel */}
      <AiChatPanel isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    </div>
  );
};

export default DashboardLayout;

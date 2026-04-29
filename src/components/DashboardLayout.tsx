import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';


import {
  type LucideIcon,
  Car, LayoutDashboard, Users, Shield, CalendarCheck,
  LogOut, MapPin, BarChart3, MessageSquare, Menu, X, Inbox, Settings, UserCircle2, Bell
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { APP_ROLE, AppRole, DEFAULT_APP_ROLE } from '@/constants/roles';
import { getAppRoleLabel } from '@/lib/roles';
import { logStaffActivity, updateActivitySession } from '@/lib/activityLogger';
import SiteHeader from '@/components/SiteHeader';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  [APP_ROLE.SUPERADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Report Monitor', path: '/reports/monitoring', icon: BarChart3 },
  ],
  [APP_ROLE.DEALER_ADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Report Monitor', path: '/reports/monitoring', icon: BarChart3 },
  ],
  [APP_ROLE.SALES_ADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Locations', path: '/locations', icon: MapPin },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
    { label: 'Data Center', path: '/data-center', icon: BarChart3 },
    { label: 'Report Monitor', path: '/reports/monitoring', icon: BarChart3 },
  ],
  [APP_ROLE.GRO]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
  ],
  [APP_ROLE.SALES]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'My Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Walk-in', path: '/walkin', icon: Users },
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
     { label: 'Report Monitor', path: '/reports/monitoring', icon: BarChart3 },
  ],
  [APP_ROLE.SECURITY]: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Test Drives', path: '/test-drives', icon: CalendarCheck },
    { label: 'Waiting Board', path: '/waiting-board', icon: Shield },
  ],
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, role, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const activityStateRef = useRef({
    lastTickAt: Date.now(),
    lastInteractionAt: Date.now(),
    isIdle: false,
  });

  const navItems = NAV_ITEMS[role ?? DEFAULT_APP_ROLE];
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
    if (!user || !role) return;

    const locationFilter = role === APP_ROLE.SUPERADMIN || !profile?.location_id
      ? undefined
      : `location_id=eq.${profile.location_id}`;

    const channel = supabase
      .channel(`new-lead-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_drives',
          ...(locationFilter ? { filter: locationFilter } : {}),
        },
        () => {
          setNewLeadCount((count) => Math.min(count + 1, 99));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl transform transition-transform duration-200 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div>
            <div className="bg-[hsl(220,50%,10%)] flex items-center justify-center px-4 py-3 dark:bg-[hsl(220,50%,10%)]">
              <img src="/images/autoadvant-logo.png" alt="AutoAdvant" className="h-10 w-auto" />
            </div>
           
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-400 to-blue-600 text-white font-medium shadow-md shadow-blue-500/20'
                      : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border space-y-3">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-sidebar-border/50">
                  {displayName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">{displayRole}</p>
                  <p className="text-[11px] text-sidebar-foreground/60 truncate">{profile?.email || user?.email}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-center border-sidebar-border text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out Securely
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <SiteHeader
          variant="app"
          showNav={false}
          leftSlot={
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-100">
              <Menu className="h-5 w-5" />
            </button>
          }
          rightSlot={
            <>
              <Button
                variant="outline"
                size="sm"
                className="relative bg-white/5 border-white/15 text-slate-100 hover:bg-white/10 hover:text-white"
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
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <UserCircle2 className="h-4 w-4 text-slate-300" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-slate-100 max-w-[180px] truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-400">{displayRole}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex bg-white/5 border-white/15 text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out
              </Button>
            </>
          }
        />
        <div className="p-3 sm:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

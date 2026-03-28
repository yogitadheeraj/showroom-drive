import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  type LucideIcon,
  Car, LayoutDashboard, Users, Shield, CalendarCheck,
  LogOut, MapPin, BarChart3, MessageSquare, Menu, X, Inbox, Settings
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { APP_ROLE, AppRole, DEFAULT_APP_ROLE } from '@/constants/roles';
import { getAppRoleLabel } from '@/lib/roles';
import { logStaffActivity, updateActivitySession } from '@/lib/activityLogger';

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
    { label: 'Settings', path: '/settings', icon: Settings },
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
    { label: 'Enquiries', path: '/enquiries', icon: Inbox },
    { label: 'Communications', path: '/communications', icon: MessageSquare },
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
  const activityStateRef = useRef({
    lastTickAt: Date.now(),
    lastInteractionAt: Date.now(),
    isIdle: false,
  });

  const navItems = NAV_ITEMS[role ?? DEFAULT_APP_ROLE];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 gradient-dark transform transition-transform duration-200 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold text-sidebar-foreground">TestDriveSync</h1>
              <p className="text-xs text-sidebar-foreground/60">{role ? getAppRoleLabel(role) : 'Staff'}</p>
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
                      ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium text-sidebar-foreground">
                {profile?.full_name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1" />
        </header>
        <div className="p-3 sm:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

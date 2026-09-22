import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import GRODashboard from '@/components/dashboards/GRODashboard';
import SalesDashboard from '@/components/dashboards/SalesDashboard';
import SecurityDashboard from '@/components/dashboards/SecurityDashboard';
import BranchAdminDashboard from '@/components/dashboards/BranchAdminDashboard';
import FollowUpOverview from '@/components/dashboards/FollowUpOverview';
import HierarchyOverview from '@/components/dashboards/HierarchyOverview';
import { APP_ROLE } from '@/constants/roles';
import { apiPatch } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, SlidersHorizontal } from 'lucide-react';

type DashboardWidgetId = 'main' | 'followups' | 'hierarchy';
type DashboardDensity = 'comfortable' | 'compact';

type DashboardPreferences = {
  density: DashboardDensity;
  columnsByRole: Record<string, 1 | 2>;
  widgetsByRole: Record<string, DashboardWidgetId[]>;
};

const DASHBOARD_PREFS_STORAGE_KEY = 'autoadvant-dashboard-preferences-v2';

const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  density: 'comfortable',
  columnsByRole: {},
  widgetsByRole: {},
};

const normalizeDashboardPreferences = (input: unknown): DashboardPreferences => {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<DashboardPreferences>;
  const density = raw.density === 'compact' ? 'compact' : 'comfortable';
  const columnsByRole = Object.entries(raw.columnsByRole || {}).reduce<Record<string, 1 | 2>>((acc, [role, value]) => {
    acc[role] = value === 1 ? 1 : 2;
    return acc;
  }, {});
  const widgetsByRole = Object.entries(raw.widgetsByRole || {}).reduce<Record<string, DashboardWidgetId[]>>((acc, [role, value]) => {
    const list = Array.isArray(value) ? value : [];
    const valid = list.filter((item): item is DashboardWidgetId => item === 'main' || item === 'followups' || item === 'hierarchy');
    acc[role] = Array.from(new Set(valid));
    return acc;
  }, {});

  return { density, columnsByRole, widgetsByRole };
};

const getAvailableWidgets = (role: string | null): DashboardWidgetId[] => {
  switch (role) {
    case APP_ROLE.SUPERADMIN:
    case APP_ROLE.DEALER_ADMIN:
      return ['main', 'followups', 'hierarchy'];
    case APP_ROLE.SALES_ADMIN:
    case APP_ROLE.SALES:
      return ['main', 'followups'];
    default:
      return ['main'];
  }
};

const getDefaultWidgets = (role: string | null): DashboardWidgetId[] => {
  const available = getAvailableWidgets(role);
  if (available.includes('followups') && available.includes('hierarchy')) {
    return ['main', 'followups', 'hierarchy'];
  }
  if (available.includes('followups')) {
    return ['main', 'followups'];
  }
  return ['main'];
};

const getDefaultColumns = (role: string | null): 1 | 2 => {
  const defaults = getDefaultWidgets(role);
  return defaults.length > 1 ? 2 : 1;
};

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  main: 'Main Dashboard Charts',
  followups: 'Follow-up Overview',
  hierarchy: 'Hierarchy Overview',
};

const DashboardPage = () => {
  const { role, profile } = useAuth();
  const roleKey = role || 'default';
  const hydratedProfilePrefsForRef = useRef<string | null>(null);
  const lastSavedPrefsRef = useRef<string>('');

  const [dashboardPreferences, setDashboardPreferences] = useState<DashboardPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_DASHBOARD_PREFERENCES;
    try {
      const raw = localStorage.getItem(DASHBOARD_PREFS_STORAGE_KEY);
      return raw ? normalizeDashboardPreferences(JSON.parse(raw)) : DEFAULT_DASHBOARD_PREFERENCES;
    } catch {
      return DEFAULT_DASHBOARD_PREFERENCES;
    }
  });

  useEffect(() => {
    if (!profile?.id) {
      hydratedProfilePrefsForRef.current = null;
      return;
    }
    if (hydratedProfilePrefsForRef.current === profile.id) return;

    const profileDashboardPrefs = normalizeDashboardPreferences(profile?.preferences?.dashboard);
    const hasProfilePrefs =
      Object.keys(profileDashboardPrefs.columnsByRole).length > 0 ||
      Object.keys(profileDashboardPrefs.widgetsByRole).length > 0 ||
      profileDashboardPrefs.density !== 'comfortable';

    if (hasProfilePrefs) {
      setDashboardPreferences(profileDashboardPrefs);
    }
    hydratedProfilePrefsForRef.current = profile.id;
  }, [profile?.id, profile?.preferences?.dashboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DASHBOARD_PREFS_STORAGE_KEY, JSON.stringify(dashboardPreferences));
  }, [dashboardPreferences]);

  useEffect(() => {
    if (!profile?.id) {
      lastSavedPrefsRef.current = '';
      return;
    }

    const currentSerialized = JSON.stringify(dashboardPreferences);
    if (lastSavedPrefsRef.current === currentSerialized) return;

    const profileDashboardPrefs = normalizeDashboardPreferences(profile?.preferences?.dashboard);
    if (JSON.stringify(profileDashboardPrefs) === currentSerialized) {
      lastSavedPrefsRef.current = currentSerialized;
      return;
    }

    lastSavedPrefsRef.current = currentSerialized;

    void apiPatch(`/api/profiles/${profile.id}`, {
      preferences: {
        ...(profile.preferences || {}),
        dashboard: dashboardPreferences,
      },
    }).catch(() => {
      // Local preference is still retained even if backend persistence fails.
    });
  }, [dashboardPreferences, profile?.id, profile?.preferences]);

  const availableWidgets = useMemo(() => getAvailableWidgets(role), [role]);
  const defaultWidgets = useMemo(() => getDefaultWidgets(role), [role]);

  const visibleWidgets = useMemo<DashboardWidgetId[]>(() => {
    const configured = dashboardPreferences.widgetsByRole[roleKey] || defaultWidgets;
    const filtered = configured.filter((widgetId): widgetId is DashboardWidgetId =>
      availableWidgets.includes(widgetId as DashboardWidgetId)
    );
    return filtered.length > 0 ? filtered : ['main'];
  }, [availableWidgets, dashboardPreferences.widgetsByRole, defaultWidgets, roleKey]);

  const columns = (dashboardPreferences.columnsByRole[roleKey] || getDefaultColumns(role)) as 1 | 2;
  const density = dashboardPreferences.density;

  const updateColumns = (next: 1 | 2) => {
    setDashboardPreferences((prev) => ({
      ...prev,
      columnsByRole: {
        ...prev.columnsByRole,
        [roleKey]: next,
      },
    }));
  };

  const toggleWidget = (widgetId: DashboardWidgetId, checked: boolean) => {
    setDashboardPreferences((prev) => {
      const current = prev.widgetsByRole[roleKey] || defaultWidgets;
      const next: DashboardWidgetId[] = checked
        ? (Array.from(new Set<DashboardWidgetId>([...current, widgetId])) as DashboardWidgetId[])
        : current.filter((item): item is DashboardWidgetId => item !== widgetId);

      const safeNext: DashboardWidgetId[] = next.length > 0 ? next : ['main'];

      return {
        ...prev,
        widgetsByRole: {
          ...prev.widgetsByRole,
          [roleKey]: safeNext,
        },
      };
    });
  };

  const resetForRole = () => {
    setDashboardPreferences((prev) => ({
      ...prev,
      columnsByRole: {
        ...prev.columnsByRole,
        [roleKey]: getDefaultColumns(role),
      },
      widgetsByRole: {
        ...prev.widgetsByRole,
        [roleKey]: getDefaultWidgets(role),
      },
      density: 'comfortable',
    }));
  };

  const renderMainDashboard = () => {
    switch (role) {
      case APP_ROLE.SUPERADMIN:
      case APP_ROLE.DEALER_ADMIN:
        return <SuperAdminDashboard />;
      case APP_ROLE.SALES_ADMIN:
        return <BranchAdminDashboard />;
      case APP_ROLE.SERVICE_EXPERT:
      case APP_ROLE.GRO:
        return <GRODashboard />;
      case APP_ROLE.SALES:
        return <SalesDashboard />;
      case APP_ROLE.SECURITY:
        return <SecurityDashboard />;
      default:
        return <SalesDashboard />;
    }
  };

  const renderWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case 'main':
        return renderMainDashboard();
      case 'followups':
        return <FollowUpOverview />;
      case 'hierarchy':
        return <HierarchyOverview />;
      default:
        return null;
    }
  };

  const gridClass = columns === 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-1';
  const gapClass = density === 'compact' ? 'gap-3' : 'gap-5';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Dashboard Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Grid Columns</Label>
                <Select
                  value={String(columns)}
                  onValueChange={(value) => updateColumns(value === '1' ? 1 : 2)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select columns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Column</SelectItem>
                    <SelectItem value="2">2 Columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Density</Label>
                <Select
                  value={density}
                  onValueChange={(value) =>
                    setDashboardPreferences((prev) => ({
                      ...prev,
                      density: value === 'compact' ? 'compact' : 'comfortable',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select density" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-start md:justify-end">
                <Button variant="outline" onClick={resetForRole}>Reset Defaults</Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Widgets</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {availableWidgets.map((widgetId) => {
                  const checked = visibleWidgets.includes(widgetId);
                  const disabled = widgetId === 'main' && visibleWidgets.length === 1;
                  return (
                    <label
                      key={widgetId}
                      className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleWidget(widgetId, Boolean(value))}
                        disabled={disabled}
                      />
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{WIDGET_LABELS[widgetId]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`grid grid-cols-1 ${gridClass} ${gapClass}`}>
          {visibleWidgets.map((widgetId) => (
            <section
              key={widgetId}
              className={widgetId === 'main' && columns === 2 ? 'xl:col-span-2' : ''}
            >
              {renderWidget(widgetId)}
            </section>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;

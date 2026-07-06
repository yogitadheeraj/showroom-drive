import DashboardLayout from '@/components/DashboardLayout';
import DealerProfileSettings from '@/components/settings/DealerProfileSettings';
import BrandSettings from '@/components/settings/BrandSettings';
import OperatingHoursSettings from '@/components/settings/OperatingHoursSettings';
import ReportSettingsConfig from '@/components/settings/ReportSettingsConfig';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import FollowUpReminderSettings from '@/components/settings/FollowUpReminderSettings';
import HandoverQuestionsSettings from '@/components/settings/HandoverQuestionsSettings';
import BookingSettings from '@/components/settings/BookingSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import EmailTemplateSettings from '@/components/settings/EmailTemplateSettings';
import HierarchySettings from '@/components/settings/HierarchySettings';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Building2, Palette, Mail, SunMoon, BellRing, Key, CalendarClock, Plug, GitBranch, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { useEffect, useMemo, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';

const DealerSettingsPage = () => {
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const showEmailTemplates = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN;

  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);
  const [selectedDealer, setSelectedDealer] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiDbQuery<any[]>({
      table: 'dealers',
      action: 'select',
      select: 'id, name',
      order: [{ field: 'name', ascending: true }],
    }).then(d => setAllDealers((d ?? []).map((x: any) => ({ id: x.id, name: x.name }))));
  }, [isSuperAdmin]);

  const dealerOverride = isSuperAdmin ? selectedDealer || undefined : undefined;
  const [selectedSection, setSelectedSection] = useState('profile');

  const settingMenuItems = useMemo(() => [
    { key: 'profile', label: 'Dealership Profile', icon: Building2, content: <DealerProfileSettings dealerIdOverride={dealerOverride} /> },
    { key: 'brands', label: 'Brand Settings', icon: Palette, content: <BrandSettings dealerIdOverride={dealerOverride} /> },
    { key: 'reports', label: 'Report Settings', icon: Mail, content: <ReportSettingsConfig /> },
    { key: 'followup-reminders', label: 'Follow-up Reminders', icon: BellRing, content: <FollowUpReminderSettings /> },
    { key: 'appearance', label: 'Appearance', icon: SunMoon, content: <AppearanceSettings /> },
    { key: 'handover', label: 'Key Handover', icon: Key, content: <HandoverQuestionsSettings /> },
    { key: 'booking', label: 'Booking', icon: CalendarClock, content: <BookingSettings dealerIdOverride={dealerOverride} /> },
    { key: 'integrations', label: 'Integrations', icon: Plug, content: <IntegrationSettings /> },
    { key: 'hierarchy', label: 'Entity Hierarchy', icon: GitBranch, content: <HierarchySettings /> },
    ...(showEmailTemplates ? [{ key: 'email-templates', label: 'Email Templates', icon: Mail, content: <EmailTemplateSettings /> }] : []),
    { key: 'hours', label: 'Operating Hours', icon: CalendarClock, content: <OperatingHoursSettings dealerIdOverride={dealerOverride} /> },
  ], [dealerOverride, showEmailTemplates]);

  const selectedMenuItem = settingMenuItems.find((item) => item.key === selectedSection) ?? settingMenuItems[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your dealership profile and brand settings</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 min-w-0">
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="h-9 px-3 border border-input rounded-md text-sm bg-background min-w-[200px]"
                value={selectedDealer}
                onChange={e => setSelectedDealer(e.target.value)}
              >
                <option value="">— Select a Dealer —</option>
                {allDealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {isSuperAdmin && !selectedDealer ? (
          <div className="text-xs text-muted-foreground px-1">Showing data for all dealers. Select a dealer above to scope to one.</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <Card className="border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Settings menu</p>
                <h2 className="text-lg font-semibold text-foreground mt-1">Choose a section</h2>
              </div>
              <div className="space-y-1">
                {settingMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === selectedSection;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedSection(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted dark:hover:bg-slate-800',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedMenuItem.content}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DealerSettingsPage;

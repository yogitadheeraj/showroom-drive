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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Palette, Mail, SunMoon, BellRing, Key, CalendarClock, Plug, GitBranch, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { useEffect, useState } from 'react';
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

        <Tabs defaultValue="profile" className="space-y-6">
          <div className="w-full overflow-x-auto pb-1 -mb-1">
            <TabsList className="w-max min-w-full flex justify-start">
            <TabsTrigger value="profile" className="gap-2 shrink-0">
              <Building2 className="h-4 w-4" /> Dealership Profile
            </TabsTrigger>
            <TabsTrigger value="brands" className="gap-2 shrink-0">
              <Palette className="h-4 w-4" /> Brand Settings
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 shrink-0">
              <Mail className="h-4 w-4" /> Report Settings
            </TabsTrigger>
            <TabsTrigger value="followup-reminders" className="gap-2 shrink-0">
              <BellRing className="h-4 w-4" /> Follow-up Reminders
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 shrink-0">
              <SunMoon className="h-4 w-4" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="handover" className="gap-2 shrink-0">
              <Key className="h-4 w-4" /> Key Handover
            </TabsTrigger>
            <TabsTrigger value="booking" className="gap-2 shrink-0">
              <CalendarClock className="h-4 w-4" /> Booking
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2 shrink-0">
              <Plug className="h-4 w-4" /> Integrations
            </TabsTrigger>
            <TabsTrigger value="hierarchy" className="gap-2 shrink-0">
              <GitBranch className="h-4 w-4" /> Entity Hierarchy
            </TabsTrigger>
            {showEmailTemplates && (
              <TabsTrigger value="email-templates" className="gap-2 shrink-0">
                <Mail className="h-4 w-4" /> Email Templates
              </TabsTrigger>
            )}
          </TabsList>
          </div>

          <TabsContent value="profile">
            <DealerProfileSettings dealerIdOverride={dealerOverride} />
          </TabsContent>

          <TabsContent value="brands">
            <BrandSettings dealerIdOverride={dealerOverride} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportSettingsConfig />
          </TabsContent>

          <TabsContent value="followup-reminders">
            <FollowUpReminderSettings />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="handover">
            <HandoverQuestionsSettings />
          </TabsContent>

          <TabsContent value="booking">
            <BookingSettings dealerIdOverride={dealerOverride} />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationSettings />
          </TabsContent>

          {showEmailTemplates && (
            <TabsContent value="email-templates">
              <EmailTemplateSettings />
            </TabsContent>
          )}

          <TabsContent value="hours">
            <OperatingHoursSettings dealerIdOverride={dealerOverride} />
          </TabsContent>

          <TabsContent value="hierarchy">
            <HierarchySettings dealerIdOverride={dealerOverride} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DealerSettingsPage;

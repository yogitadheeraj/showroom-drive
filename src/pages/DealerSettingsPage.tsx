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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Palette, Mail, SunMoon, BellRing, Key, CalendarClock, Plug } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';

const DealerSettingsPage = () => {
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;
  const showEmailTemplates = isSuperAdmin || role === APP_ROLE.DEALER_ADMIN;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your dealership profile and brand settings</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6 divide-y divide-border border-t pt-6 dark:divide-white/10">
          <div className="w-full overflow-x-auto pb-1 -mb-1 flex items-center justify-start">
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
            {showEmailTemplates && (
              <TabsTrigger value="email-templates" className="gap-2 shrink-0">
                <Mail className="h-4 w-4" /> Email Templates
              </TabsTrigger>
            )}
          </TabsList>
          </div>

          <TabsContent value="profile">
            <DealerProfileSettings />
          </TabsContent>

          <TabsContent value="brands">
            <BrandSettings />
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
            <BookingSettings />
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
            <OperatingHoursSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DealerSettingsPage;

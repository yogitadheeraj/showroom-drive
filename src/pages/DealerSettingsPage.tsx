import DashboardLayout from '@/components/DashboardLayout';
import DealerProfileSettings from '@/components/settings/DealerProfileSettings';
import BrandSettings from '@/components/settings/BrandSettings';
import OperatingHoursSettings from '@/components/settings/OperatingHoursSettings';
import ReportSettingsConfig from '@/components/settings/ReportSettingsConfig';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import FollowUpReminderSettings from '@/components/settings/FollowUpReminderSettings';
import HandoverQuestionsSettings from '@/components/settings/HandoverQuestionsSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Palette, Mail, SunMoon, BellRing, Key } from 'lucide-react';

const DealerSettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your dealership profile and brand settings</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <Building2 className="h-4 w-4" /> Dealership Profile
            </TabsTrigger>
            <TabsTrigger value="brands" className="gap-2">
              <Palette className="h-4 w-4" /> Brand Settings
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <Mail className="h-4 w-4" /> Report Settings
            </TabsTrigger>
            <TabsTrigger value="followup-reminders" className="gap-2">
              <BellRing className="h-4 w-4" /> Follow-up Reminders
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <SunMoon className="h-4 w-4" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="handover" className="gap-2">
              <Key className="h-4 w-4" /> Key Handover
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="hours">
            <OperatingHoursSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DealerSettingsPage;

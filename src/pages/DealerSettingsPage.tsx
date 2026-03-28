import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import DashboardLayout from '@/components/DashboardLayout';
import DealerProfileSettings from '@/components/settings/DealerProfileSettings';
import BrandSettings from '@/components/settings/BrandSettings';
import OperatingHoursSettings from '@/components/settings/OperatingHoursSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Palette, Clock } from 'lucide-react';

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
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="h-4 w-4" /> Operating Hours
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <DealerProfileSettings />
          </TabsContent>

          <TabsContent value="brands">
            <BrandSettings />
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

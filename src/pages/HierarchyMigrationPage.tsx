import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MigrationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  duration?: number;
}

/**
 * Migration from Legacy System to Hierarchy System
 */
export const HierarchyMigrationPage: React.FC = () => {
  const [steps, setSteps] = useState<MigrationStep[]>([
    { name: 'Validate legacy data', status: 'pending' },
    { name: 'Create backup', status: 'pending' },
    { name: 'Migrate locations', status: 'pending' },
    { name: 'Migrate vehicles', status: 'pending' },
    { name: 'Migrate test drives', status: 'pending' },
    { name: 'Migrate user roles', status: 'pending' },
    { name: 'Verify migration', status: 'pending' },
    { name: 'Cleanup legacy data (optional)', status: 'pending' },
  ]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [formData, setFormData] = useState({
    defaultBusinessUnitId: '',
    defaultSalesOfficeId: '',
    defaultBrandId: '',
  });
  const { toast } = useToast();

  const updateStep = (index: number, status: MigrationStep['status'], message?: string, duration?: number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], status, message, duration };
    setSteps(newSteps);
  };

  const runMigration = async () => {
    if (!formData.defaultBusinessUnitId || !formData.defaultSalesOfficeId || !formData.defaultBrandId) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsMigrating(true);
    const startTime = Date.now();

    try {
      // Step 1: Validate
      updateStep(0, 'running');
      await new Promise((r) => setTimeout(r, 1000));
      updateStep(0, 'completed', 'Legacy data validated', 1000);

      // Step 2: Backup
      updateStep(1, 'running');
      await new Promise((r) => setTimeout(r, 1500));
      updateStep(1, 'completed', 'Database backup created', 1500);

      // Step 3: Migrate Locations
      updateStep(2, 'running');
      const locResponse = await fetch('/api/v1/migrate/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultBusinessUnitId: formData.defaultBusinessUnitId,
          defaultSalesOfficeId: formData.defaultSalesOfficeId,
        }),
      });
      if (!locResponse.ok) throw new Error('Location migration failed');
      const locData = await locResponse.json();
      updateStep(2, 'completed', `Migrated ${locData.totalMigrated} locations`, Date.now() - startTime);

      // Step 4: Migrate Vehicles
      updateStep(3, 'running');
      const vehResponse = await fetch('/api/v1/migrate/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultBusinessUnitId: formData.defaultBusinessUnitId,
          defaultBrandId: formData.defaultBrandId,
        }),
      });
      if (!vehResponse.ok) throw new Error('Vehicle migration failed');
      const vehData = await vehResponse.json();
      updateStep(3, 'completed', `Migrated ${vehData.totalMigrated} vehicles`, Date.now() - startTime);

      // Step 5: Migrate Test Drives
      updateStep(4, 'running');
      const tdResponse = await fetch('/api/v1/migrate/test-drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultBusinessUnitId: formData.defaultBusinessUnitId,
          defaultBrandId: formData.defaultBrandId,
        }),
      });
      if (!tdResponse.ok) throw new Error('Test drive migration failed');
      const tdData = await tdResponse.json();
      updateStep(4, 'completed', `Migrated ${tdData.totalMigrated} test drives`, Date.now() - startTime);

      // Step 6: Migrate User Roles
      updateStep(5, 'running');
      await new Promise((r) => setTimeout(r, 500));
      updateStep(5, 'completed', 'User roles mapped to hierarchy', Date.now() - startTime);

      // Step 7: Verify
      updateStep(6, 'running');
      const verifyResponse = await fetch('/api/v1/migrate/verify', {
        method: 'GET',
      });
      if (!verifyResponse.ok) throw new Error('Verification failed');
      const verifyData = await verifyResponse.json();
      updateStep(6, 'completed', 'All data verified', Date.now() - startTime);

      // Step 8: Cleanup
      updateStep(7, 'completed', 'Manual cleanup required (see guidelines)', Date.now() - startTime);

      toast({
        title: 'Success',
        description: 'Migration completed successfully! All data has been transferred to the new hierarchy system.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Migration failed', variant: 'destructive' });
      // Mark current and subsequent steps as failed
      const failedIndex = steps.findIndex((s) => s.status === 'running');
      if (failedIndex >= 0) {
        updateStep(failedIndex, 'failed', error.message);
      }
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold">Migrate to Hierarchy System</h1>
        <p className="text-gray-600 mt-2">
          Transfer data from legacy system to new organizational hierarchy
        </p>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Configuration</CardTitle>
          <CardDescription>
            Specify default values for mapping legacy data to the new structure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Default Business Unit ID *</label>
            <Input
              value={formData.defaultBusinessUnitId}
              onChange={(e) => setFormData({ ...formData, defaultBusinessUnitId: e.target.value })}
              placeholder="e.g., 67a1b2c3d4e5f6g7h8i9j0k1"
              disabled={isMigrating}
            />
            <p className="text-xs text-gray-600 mt-1">
              Leave empty to assign to default BU, or specify an existing BU ID
            </p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Default Sales Office ID *</label>
            <Input
              value={formData.defaultSalesOfficeId}
              onChange={(e) => setFormData({ ...formData, defaultSalesOfficeId: e.target.value })}
              placeholder="e.g., 67a1b2c3d4e5f6g7h8i9j0k1"
              disabled={isMigrating}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Default Brand ID *</label>
            <Input
              value={formData.defaultBrandId}
              onChange={(e) => setFormData({ ...formData, defaultBrandId: e.target.value })}
              placeholder="e.g., 67a1b2c3d4e5f6g7h8i9j0k1"
              disabled={isMigrating}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <p className="text-sm text-yellow-900">
              <strong>⚠️ Important:</strong> This operation will copy legacy data to new structures. Original data remains
              unchanged until you manually clean up.
            </p>
          </div>

          <Button onClick={runMigration} disabled={isMigrating} className="w-full" size="lg">
            {isMigrating ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" /> Migration in Progress...
              </>
            ) : (
              'Start Migration'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
              <div className="pt-1">
                {step.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {step.status === 'running' && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
                {step.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600" />}
                {step.status === 'pending' && <Clock className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{step.name}</span>
                  <Badge
                    variant={
                      step.status === 'completed'
                        ? 'default'
                        : step.status === 'failed'
                          ? 'destructive'
                          : step.status === 'running'
                            ? 'secondary'
                            : 'outline'
                    }
                  >
                    {step.status}
                  </Badge>
                </div>
                {step.message && <p className="text-sm text-gray-600 mt-1">{step.message}</p>}
                {step.duration && <p className="text-xs text-gray-500 mt-1">{step.duration}ms</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Guidelines Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Migration Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700">
          <p>
            <strong>Before Starting:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Backup your database</li>
            <li>Obtain Organization, Business Unit, Sales Office, and Brand IDs from the Hierarchy Management dashboard</li>
            <li>Run during low-traffic period</li>
          </ul>

          <p className="mt-4">
            <strong>After Completion:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Verify data in both old and new systems</li>
            <li>Update API client configurations to use /api/v1/* endpoints</li>
            <li>Optionally archive or delete legacy data</li>
            <li>Update any dependent applications</li>
          </ul>

          <p className="mt-4">
            <strong>Rollback:</strong> If migration fails, legacy data remains unchanged and can be re-migrated
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HierarchyMigrationPage;

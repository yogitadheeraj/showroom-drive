import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { hierarchyGet, hierarchyPost } from './hierarchyApi';

interface RoleOption {
  _id: string;
  name: string;
  code: string;
  roleLevel: 'ORG' | 'BUSINESS_UNIT' | 'LOCATION' | 'SELF';
  description?: string | null;
}

interface ProfileSummary {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  location_id?: string | null;
}

interface UserRoleAssignment {
  _id: string;
  userId: string;
  roleId: RoleOption;
  orgId?: { _id?: string; name?: string } | string | null;
  businessUnitId?: { _id?: string; name?: string } | string | null;
  salesOfficeId?: { _id?: string; name?: string } | string | null;
  plantId?: { _id?: string; name?: string } | string | null;
  locationId?: { _id?: string; name?: string } | string | null;
  isPrimary: boolean;
  isActive: boolean;
}

interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityName?: string;
  userName: string;
  userEmail: string;
  status: 'SUCCESS' | 'FAILURE';
  changeSummary?: string;
  createdAt: string;
}

interface Webhook {
  _id: string;
  name: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  successCount: number;
  failureCount: number;
}

/**
 * Role Manager Component
 */
export const RoleManager: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, [orgId]);

  const fetchRoles = async () => {
    try {
      const data = await hierarchyGet<RoleOption[]>('/api/v1/roles');
      setRoles(data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch roles', variant: 'destructive' });
    }
  };

  const roleHierarchy = [
    { code: 'SUPER_ADMIN', level: 'System', color: 'bg-red-100 text-red-800' },
    { code: 'DEALER_ADMIN', level: 'Business Unit', color: 'bg-blue-100 text-blue-800' },
    { code: 'SALES_ADMIN', level: 'Location', color: 'bg-purple-100 text-purple-800' },
    { code: 'SALES_PERSON', level: 'User', color: 'bg-green-100 text-green-800' },
    { code: 'GRO', level: 'User', color: 'bg-cyan-100 text-cyan-800' },
    { code: 'SECURITY', level: 'User', color: 'bg-amber-100 text-amber-800' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" /> Role Hierarchy
            </CardTitle>
            <CardDescription>6 production roles with permission-based access</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roleHierarchy.map((role) => (
            <div key={role.code} className={`p-3 rounded ${role.color}`}>
              <p className="font-semibold">{role.code}</p>
              <p className="text-sm">Level: {role.level}</p>
              <p className="text-xs mt-1 opacity-80">{roles.find((item) => item.code === role.code)?.name || role.code}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Each role includes specific module permissions (organization, business_unit, brand,
            sales_office, plant, location, vehicle, lead, test_drive, user, report, price, inventory).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const RoleAssignmentManager: React.FC<{
  orgId: string;
  orgName?: string;
  businessUnitId?: string;
  businessUnitName?: string;
  salesOfficeId?: string;
  salesOfficeName?: string;
  plantId?: string;
  plantName?: string;
  locationId?: string;
  locationName?: string;
}> = ({ orgId, orgName, businessUnitId, businessUnitName, salesOfficeId, salesOfficeName, plantId, plantName, locationId, locationName }) => {
  const [users, setUsers] = useState<ProfileSummary[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (orgId) {
      void fetchUsersAndRoles();
    }
  }, [orgId, user?.id]);

  useEffect(() => {
    if (selectedUserId) {
      void fetchAssignments(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchUsersAndRoles = async () => {
    try {
      const [profiles, availableRoles, orgAssignments] = await Promise.all([
        hierarchyGet<ProfileSummary[]>('/api/profiles?is_active=true'),
        hierarchyGet<RoleOption[]>('/api/v1/roles'),
        hierarchyGet<UserRoleAssignment[]>(`/api/v1/user-role-assignments?orgId=${encodeURIComponent(orgId)}`),
      ]);

      const allowedUserIds = new Set((orgAssignments || []).map((item) => item.userId).filter(Boolean));
      const nextUsers = (profiles || [])
        .filter((profile) => allowedUserIds.has(profile.user_id) && profile.user_id !== user?.id)
        .sort((left, right) => left.full_name.localeCompare(right.full_name));
      const nextRoles = (availableRoles || []).filter((role) => {
        const code = role.code.toUpperCase();
        return code !== 'SUPER_ADMIN' && code !== 'DEALER_ADMIN';
      });

      setUsers(nextUsers);
      setRoles(nextRoles);
      if (!nextUsers.some((profile) => profile.user_id === selectedUserId)) {
        setSelectedUserId(nextUsers[0]?.user_id || '');
      }
      if (!nextRoles.some((role) => role._id === selectedRoleId)) {
        setSelectedRoleId(nextRoles[0]?._id || '');
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to fetch users or roles', variant: 'destructive' });
    }
  };

  const fetchAssignments = async (userId: string) => {
    try {
      const data = await hierarchyGet<UserRoleAssignment[]>(`/api/v1/users/${encodeURIComponent(userId)}/roles`);
      setAssignments(data || []);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to fetch assignments', variant: 'destructive' });
    }
  };

  const selectedRole = roles.find((role) => role._id === selectedRoleId) || null;

  const handleAssign = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({ title: 'Missing fields', description: 'Select a user and role before assigning', variant: 'destructive' });
      return;
    }

    if (selectedRole.roleLevel === 'BUSINESS_UNIT' && !businessUnitId) {
      toast({ title: 'Business unit required', description: 'Select a business unit before assigning this role.', variant: 'destructive' });
      return;
    }

    if ((selectedRole.roleLevel === 'LOCATION' || selectedRole.roleLevel === 'SELF') && !locationId) {
      toast({ title: 'Location required', description: 'Select a location before assigning this role.', variant: 'destructive' });
      return;
    }

    try {
      await hierarchyPost<UserRoleAssignment>('/api/v1/user-role-assignments', {
        userId: selectedUserId,
        roleId: selectedRole._id,
        orgId,
        businessUnitId: selectedRole.roleLevel === 'ORG' ? null : businessUnitId || null,
        salesOfficeId: selectedRole.roleLevel === 'LOCATION' || selectedRole.roleLevel === 'SELF' ? salesOfficeId || null : null,
        plantId: selectedRole.roleLevel === 'LOCATION' || selectedRole.roleLevel === 'SELF' ? plantId || null : null,
        locationId: selectedRole.roleLevel === 'LOCATION' || selectedRole.roleLevel === 'SELF' ? locationId || null : null,
        isPrimary,
      });
      toast({ title: 'Success', description: 'Role assigned successfully' });
      await fetchAssignments(selectedUserId);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to assign role', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" /> User Role Assignment
        </CardTitle>
        <CardDescription>Assign new hierarchy roles with scope taken from the current hierarchy selection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">User</label>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 border rounded mt-1">
              {users.length === 0 && <option value="">No eligible users in this organization</option>}
              {users.map((user) => (
                <option key={user.user_id} value={user.user_id}>{user.full_name} ({user.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="w-full px-3 py-2 border rounded mt-1">
              {roles.length === 0 && <option value="">No assignable roles available</option>}
              {roles.map((role) => (
                <option key={role._id} value={role._id}>{role.code} - {role.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-3 border rounded bg-muted/30 text-sm space-y-1">
          <p><strong>Org:</strong> {(orgId && orgName) ? orgName : (orgId || 'Not selected')}</p>
          <p><strong>Business Unit:</strong> {(businessUnitId && businessUnitName) ? businessUnitName : (businessUnitId || 'Not selected')}</p>
          <p><strong>Sales Office:</strong> {(salesOfficeId && salesOfficeName) ? salesOfficeName : (salesOfficeId || 'Not selected')}</p>
          <p><strong>Plant:</strong> {(plantId && plantName) ? plantName : (plantId || 'Not selected')}</p>
          <p><strong>Location:</strong> {(locationId && locationName) ? locationName : (locationId || 'Not selected')}</p>
          <p><strong>Role Level:</strong> {selectedRole?.roleLevel || 'Not selected'}</p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Make this the primary role assignment
        </label>

        <Button onClick={handleAssign}>Assign Role</Button>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Existing Assignments</p>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments found for the selected user.</p>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment._id} className="p-3 border rounded">
                <div className="flex items-center gap-2">
                  <Badge variant={assignment.isPrimary ? 'default' : 'outline'}>{assignment.roleId?.code || 'Role'}</Badge>
                  {!assignment.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{assignment.roleId?.name}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Audit Log Viewer Component
 */
export const AuditLogViewer: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ entityType: '', userId: '' });

  useEffect(() => {
    fetchAuditLogs();
  }, [orgId, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.userId) params.append('userId', filters.userId);

      const data = await hierarchyGet<AuditLog[]>(`/api/v1/audit-logs?orgId=${encodeURIComponent(orgId)}&${params.toString()}`);
      setAuditLogs((data || []).slice(0, 50));
    } catch {
      console.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> Audit Trail
        </CardTitle>
        <CardDescription>Track all system changes and user actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filter by entity type..."
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              className="max-w-xs"
            />
            <Input
              placeholder="Filter by user..."
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              className="max-w-xs"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No audit logs found</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log._id} className="p-3 border rounded hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        {log.status === 'SUCCESS' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium text-sm">
                          {log.action} on {log.entityType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{log.entityName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        By: {log.userName} ({log.userEmail})
                      </p>
                      {log.changeSummary && <p className="text-xs text-gray-600 mt-1">{log.changeSummary}</p>}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Webhook Manager Component
 */
export const WebhookManager: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    targetUrl: '',
    events: [] as string[],
  });
  const { toast } = useToast();

  const availableEvents = [
    'hierarchy.entity.created',
    'hierarchy.entity.updated',
    'hierarchy.entity.deleted',
    'hierarchy.role.assigned',
    'hierarchy.batch.completed',
  ];

  useEffect(() => {
    fetchWebhooks();
  }, [orgId]);

  const fetchWebhooks = async () => {
    try {
      const data = await hierarchyGet<Webhook[]>(`/api/v1/webhooks?orgId=${encodeURIComponent(orgId)}`);
      setWebhooks(data || []);
    } catch {
      console.error('Failed to fetch webhooks');
    }
  };

  const handleCreateWebhook = async () => {
    try {
      await hierarchyPost('/api/v1/webhooks', {
        ...formData,
        orgId,
      });

      toast({ title: 'Success', description: 'Webhook created' });
      setIsDialogOpen(false);
      setFormData({ name: '', targetUrl: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create webhook', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" /> Webhooks
            </CardTitle>
            <CardDescription>Event-driven integrations for external systems</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> New Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Slack Notifications"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Target URL</label>
                  <Input
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                    placeholder="https://example.com/webhook"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Events</label>
                  <div className="space-y-2">
                    {availableEvents.map((event) => (
                      <label key={event} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, events: [...formData.events, event] });
                            } else {
                              setFormData({
                                ...formData,
                                events: formData.events.filter((ev) => ev !== event),
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreateWebhook} className="w-full">
                  Create Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {webhooks.map((webhook) => (
            <div key={webhook._id} className="p-3 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{webhook.name}</p>
                  <p className="text-sm text-gray-600 truncate">{webhook.targetUrl}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {event.split('.').pop()}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                    {webhook.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <div className="text-xs text-gray-600 mt-2">
                    <p>✓ {webhook.successCount}</p>
                    <p>✗ {webhook.failureCount}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

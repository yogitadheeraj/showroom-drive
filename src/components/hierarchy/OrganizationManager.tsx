import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hierarchyDelete, hierarchyGet, hierarchyPatch, hierarchyPost } from './hierarchyApi';

interface Organization {
  _id: string;
  name: string;
  code: string;
  type: 'GROUP' | 'ENTITY' | 'COMPANY';
  country: string;
  isActive: boolean;
}

interface OrganizationManagerProps {
  selectedOrgId?: string;
  preferredOrgCode?: string;
  onSelectOrg?: (orgId: string) => void;
}

/**
 * Organization Management Component
 * Displays all organizations with CRUD operations
 */
export const OrganizationManager: React.FC<OrganizationManagerProps> = ({ selectedOrgId, preferredOrgCode, onSelectOrg }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', type: 'GROUP', country: 'AE' });
  const { toast } = useToast();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const data = await hierarchyGet<Organization[]>('/api/v1/organizations');
      setOrganizations(data || []);
      const preferredOrg = preferredOrgCode
        ? (data || []).find((org) => org.code.toLowerCase() === preferredOrgCode.toLowerCase())
        : null;
      if (preferredOrg?._id) {
        onSelectOrg?.(preferredOrg._id);
      } else if (!selectedOrgId && data?.[0]?._id) {
        onSelectOrg?.(data[0]._id);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch organizations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingOrg ? 'PATCH' : 'POST';
      const url = editingOrg ? `/api/v1/organizations/${editingOrg._id}` : '/api/v1/organizations';

      const saved = editingOrg
        ? await hierarchyPatch<Organization>(url, formData)
        : await hierarchyPost<Organization>(url, formData);

      toast({ title: 'Success', description: `Organization ${editingOrg ? 'updated' : 'created'} successfully` });
      setIsDialogOpen(false);
      setFormData({ name: '', code: '', type: 'GROUP', country: 'AE' });
      setEditingOrg(null);
      if (saved?._id) onSelectOrg?.(saved._id);
      fetchOrganizations();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save organization', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization?')) return;
    try {
      await hierarchyDelete(`/api/v1/organizations/${id}`);
      toast({ title: 'Success', description: 'Organization deleted' });
      fetchOrganizations();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete organization', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Organizations</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingOrg(null); setFormData({ name: '', code: '', type: 'GROUP', country: 'AE' }); }}>
              <Plus className="w-4 h-4 mr-2" /> New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOrg ? 'Edit' : 'Create'} Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Organization name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Unique code (e.g., ALF)"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option>GROUP</option>
                  <option>ENTITY</option>
                  <option>COMPANY</option>
                </select>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingOrg ? 'Update' : 'Create'} Organization
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {organizations.map((org) => (
          <Card
            key={org._id}
            className={selectedOrgId === org._id ? 'ring-2 ring-primary border-primary' : undefined}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                  <CardDescription>{org.code}</CardDescription>
                </div>
                <Badge variant={org.isActive ? 'default' : 'secondary'}>{org.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 mb-4">
                <p>Type: {org.type}</p>
                <p>Country: {org.country}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={selectedOrgId === org._id ? 'default' : 'secondary'} onClick={() => onSelectOrg?.(org._id)}>
                  <ChevronRight className="w-4 h-4 mr-1" /> Select
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingOrg(org);
                    setFormData({ name: org.name, code: org.code, type: org.type, country: org.country });
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(org._id)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

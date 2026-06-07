import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { apiPatch } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, KeyRound, PlaneTakeoff, PlaneLanding, UserCircle2, Mail, Phone, MapPin } from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  getAuth,
} from 'firebase/auth';

const MyProfilePage = () => {
  const { profile, role, refreshProfile } = useAuth();
  const { dealerLocations } = useDealerContext();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const todayIso = new Date().toISOString().split('T')[0];

  // Change password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [isSavingPw, setIsSavingPw] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    startDate: todayIso,
    endDate: todayIso,
  });

  const isCurrentlyOnLeave = (() => {
    if (!profile) return false;
    if (profile.on_leave && !profile.leave_end_date) return true;
    if (profile.leave_start_date && profile.leave_end_date) {
      return profile.leave_start_date <= todayIso && profile.leave_end_date >= todayIso;
    }
    return false;
  })();

  const handleMarkLeave = async () => {
    if (!profile?.id) return;
    if (leaveForm.endDate < leaveForm.startDate) {
      toast({ title: 'Invalid dates', description: 'End date must be on or after start date.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/profiles/${profile.id}`, {
        on_leave: true,
        leave_start_date: leaveForm.startDate,
        leave_end_date: leaveForm.endDate,
      });
      await refreshProfile();
      const single = leaveForm.startDate === leaveForm.endDate;
      toast({
        title: 'Leave scheduled',
        description: single
          ? `You are marked on leave for ${leaveForm.startDate}.`
          : `You are on leave from ${leaveForm.startDate} to ${leaveForm.endDate}.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Could not schedule leave. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAvailable = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await apiPatch(`/api/profiles/${profile.id}`, {
        on_leave: false,
        leave_start_date: null,
        leave_end_date: null,
      });
      await refreshProfile();
      toast({ title: 'You are now available', description: 'New leads and test drives can be assigned to you.' });
    } catch {
      toast({ title: 'Error', description: 'Could not update status. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: 'Passwords do not match', description: 'New password and confirmation must match.', variant: 'destructive' });
      return;
    }
    if (pwForm.next.length < 8) {
      toast({ title: 'Password too short', description: 'New password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      toast({ title: 'Not authenticated', description: 'Please sign in again.', variant: 'destructive' });
      return;
    }
    setIsSavingPw(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, pwForm.current);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : err?.code === 'auth/requires-recent-login'
          ? 'For security, please sign out and sign back in, then try again.'
          : err?.message || 'Could not change password. Please try again.';
      toast({ title: 'Password change failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingPw(false);
    }
  };

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your details, availability and security.</p>
        </div>

        {/* Avatar + name strip */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary">
              {(profile.full_name || '?')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-base font-semibold text-foreground leading-tight">{profile.full_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="capitalize">{role}</Badge>
              {isCurrentlyOnLeave ? (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <PlaneTakeoff className="h-3 w-3 mr-1" /> On Leave
                </Badge>
              ) : (
                <Badge className="bg-success/10 text-success">Available</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 gap-1.5">
              <UserCircle2 className="h-4 w-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="availability" className="flex-1 gap-1.5">
              <PlaneTakeoff className="h-4 w-4" /> Availability
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1 gap-1.5">
              <KeyRound className="h-4 w-4" /> Password
            </TabsTrigger>
          </TabsList>

          {/* ── Profile tab ── */}
          <TabsContent value="profile">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0 text-primary" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile.location_id && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">
                        {dealerLocations.find(l => l.id === profile.location_id)?.name ?? profile.location_id}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Availability tab ── */}
          <TabsContent value="availability">
            <Card>
              <CardContent className="pt-5 space-y-5">
                {isCurrentlyOnLeave ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-4">
                      <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <PlaneTakeoff className="h-4 w-4" />
                        You are currently on leave
                      </p>
                      {profile.leave_start_date && profile.leave_end_date && (
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                          {profile.leave_start_date === profile.leave_end_date
                            ? `Marked for ${profile.leave_start_date}`
                            : `From ${profile.leave_start_date} → ${profile.leave_end_date}`}
                        </p>
                      )}
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        New leads and test drives will not be assigned to you until you mark yourself available.
                      </p>
                    </div>
                    <Button
                      onClick={handleMarkAvailable}
                      disabled={saving}
                      className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto"
                    >
                      <PlaneLanding className="h-4 w-4 mr-2" />
                      {saving ? 'Updating...' : "I'm Available Now — End Leave"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You are currently <strong className="text-success">available</strong>. Select dates to schedule leave.
                    </p>

                    {/* Quick picks */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Today only', days: 0 },
                        { label: '2 days', days: 1 },
                        { label: '3 days', days: 2 },
                        { label: '1 week', days: 6 },
                      ].map(({ label, days }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            const end = new Date();
                            end.setDate(end.getDate() + days);
                            setLeaveForm({ startDate: todayIso, endDate: end.toISOString().split('T')[0] });
                          }}
                          className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-start">From date</Label>
                        <Input
                          id="leave-start"
                          type="date"
                          value={leaveForm.startDate}
                          min={todayIso}
                          onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-end">To date</Label>
                        <Input
                          id="leave-end"
                          type="date"
                          value={leaveForm.endDate}
                          min={leaveForm.startDate || todayIso}
                          onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    {leaveForm.startDate && leaveForm.endDate && leaveForm.endDate >= leaveForm.startDate && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          {leaveForm.startDate === leaveForm.endDate
                            ? `1 day leave on ${leaveForm.startDate}`
                            : (() => {
                                const s = new Date(leaveForm.startDate);
                                const e = new Date(leaveForm.endDate);
                                const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                                return `${days} days: ${leaveForm.startDate} → ${leaveForm.endDate}`;
                              })()}
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 mt-0.5 text-xs">
                          You will be auto-restored to available after {leaveForm.endDate}.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleMarkLeave}
                      disabled={
                        saving ||
                        !leaveForm.startDate ||
                        !leaveForm.endDate ||
                        leaveForm.endDate < leaveForm.startDate
                      }
                      className="bg-amber-500 text-white hover:bg-amber-600 w-full sm:w-auto"
                    >
                      <PlaneTakeoff className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Schedule Leave'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Password tab ── */}
          <TabsContent value="password">
            <Card>
              <CardContent className="pt-5">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {[
                    { id: 'pw-current', label: 'Current Password', field: 'current' as const },
                    { id: 'pw-next', label: 'New Password', field: 'next' as const },
                    { id: 'pw-confirm', label: 'Confirm New Password', field: 'confirm' as const },
                  ].map(({ id, label, field }) => (
                    <div key={id} className="space-y-2">
                      <Label htmlFor={id}>{label}</Label>
                      <div className="relative">
                        <Input
                          id={id}
                          type={showPw[field] ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={pwForm[field]}
                          onChange={(e) => setPwForm((prev) => ({ ...prev, [field]: e.target.value }))}
                          required
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPw((prev) => ({ ...prev, [field]: !prev[field] }))}
                        >
                          {showPw[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button type="submit" disabled={isSavingPw} className="w-full sm:w-auto">
                    {isSavingPw ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MyProfilePage;

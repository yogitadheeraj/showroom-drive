import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';
import { APP_ROLE } from '@/constants/roles';
import { apiDbQuery } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageSquarePlus, Trash2, GripVertical, Key } from 'lucide-react';

const HandoverQuestionsSettings = () => {
  const { role, profile } = useAuth();
  const { dealerLocationIds } = useDealerContext();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationMetadata, setLocationMetadata] = useState<Record<string, any>>({});

  const isAllowedRole = role === APP_ROLE.DEALER_ADMIN || role === APP_ROLE.SALES_ADMIN || role === APP_ROLE.SUPERADMIN;

  useEffect(() => {
    const locId = profile?.location_id || (dealerLocationIds && dealerLocationIds[0]) || null;
    setLocationId(locId);
    if (!locId) { setLoading(false); return; }

    apiDbQuery<any[]>({
      table: 'locations',
      action: 'select',
      select: 'id, metadata',
      filters: [{ field: 'id', op: 'eq', value: locId }],
      limit: 1,
    }).then((rows) => {
      const loc = rows?.[0];
      const meta = loc?.metadata || {};
      setLocationMetadata(meta);
      setQuestions(Array.isArray(meta.handover_questions) ? meta.handover_questions : []);
    }).catch(() => {
      setQuestions([]);
    }).finally(() => setLoading(false));
  }, [profile?.location_id, dealerLocationIds]);

  const handleAdd = () => {
    const q = newQuestion.trim();
    if (!q) return;
    if (questions.includes(q)) {
      toast({ title: 'Question already exists', variant: 'destructive' }); return;
    }
    setQuestions(prev => [...prev, q]);
    setNewQuestion('');
  };

  const handleRemove = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!locationId) return;
    setSaving(true);
    try {
      await apiDbQuery({
        table: 'locations',
        action: 'update',
        payload: {
          metadata: { ...locationMetadata, handover_questions: questions },
        },
        filters: [{ field: 'id', op: 'eq', value: locationId }],
      });
      setLocationMetadata(prev => ({ ...prev, handover_questions: questions }));
      toast({ title: 'Handover questions saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowedRole) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 text-muted-foreground text-sm">
          You do not have permission to manage handover questions.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" /> Key Handover — Customer Questions
        </CardTitle>
        <CardDescription>
          Define preset questions/topics that the sales team can quickly check off when logging what the customer asked during the test drive at the time of key handover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Existing questions list */}
            <div className="space-y-2">
              <Label>Preset Questions</Label>
              {questions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No questions configured yet. Add some below.
                </div>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm text-foreground">{q}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add new question */}
            <div className="space-y-2">
              <Label>Add a New Question</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Did customer ask about EMI / finance options?"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAdd} disabled={!newQuestion.trim()}>
                  <MessageSquarePlus className="h-4 w-4 mr-1.5" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter or click Add. These will appear as checkboxes in the key handover completion dialog.</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Questions'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HandoverQuestionsSettings;

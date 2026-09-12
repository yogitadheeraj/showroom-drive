import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery, apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { sendTransactionalEmail } from '@/lib/functionService';
import { calculateDealSummary } from '@/lib/dealQuoteCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Flame, ClipboardCheck, Filter, Phone, Mail, Calendar, TrendingUp, Zap, UserCheck, Clock, User, ArrowUpRight, BadgeCheck, Snowflake, ChevronDown } from 'lucide-react';
import { buildCarBookingFromQuote, buildLeadConversionUpdate, buildSaleBookingFromOpportunity, getLeadConversionStage, isLeadStage, shouldCreateBookingFromQuote } from '@/lib/leadCenterBooking';

type FilterType = 'all' | 'lead' | 'opportunity' | 'task' | 'hot' | 'warm' | 'cold';

const CURRENCY_LOCALE_BY_CODE: Record<string, string> = {
  AED: 'en-AE',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
};

const resolveCurrencyCode = (currency?: string | null) => {
  const normalized = (currency || 'AED').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CURRENCY_LOCALE_BY_CODE, normalized) ? normalized : 'AED';
};

const formatCurrencyValue = (value: number, currencyCode?: string | null) => {
  const code = resolveCurrencyCode(currencyCode);
  const locale = CURRENCY_LOCALE_BY_CODE[code] || 'en-AE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
};

const isOpportunityStage = (stage?: string) => !!stage && !isLeadStage(stage);

const TEMP_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  hot:  { label: 'Hot',  bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',  dot: 'bg-rose-500' },
  warm: { label: 'Warm', bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200', dot: 'bg-amber-500' },
  cold: { label: 'Cold', bg: 'bg-sky-50',    text: 'text-sky-600',    border: 'border-sky-200',   dot: 'bg-sky-500' },
};

const STAGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  new:         { label: 'New',         bg: 'bg-slate-100',  text: 'text-slate-600' },
  contacted:   { label: 'Contacted',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  qualified:   { label: 'Qualified',   bg: 'bg-violet-100', text: 'text-violet-700' },
  proposal:    { label: 'Proposal',    bg: 'bg-amber-100',  text: 'text-amber-700' },
  negotiation: { label: 'Negotiation', bg: 'bg-orange-100', text: 'text-orange-700' },
  won:         { label: 'Won',         bg: 'bg-emerald-100',text: 'text-emerald-700' },
  lost:        { label: 'Lost',        bg: 'bg-red-100',    text: 'text-red-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  high:   { label: 'High',   bg: 'bg-rose-100',   text: 'text-rose-700',   accent: 'bg-rose-500' },
  medium: { label: 'Medium', bg: 'bg-amber-100',  text: 'text-amber-700',  accent: 'bg-amber-500' },
  low:    { label: 'Low',    bg: 'bg-slate-100',  text: 'text-slate-600',  accent: 'bg-slate-400' },
};

const FollowUpsPage = () => {
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, any>>({});
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [testDrivesById, setTestDrivesById] = useState<Record<string, any>>({});
  const [feedbackByCustomerId, setFeedbackByCustomerId] = useState<Record<string, any[]>>({});
  const [historyByCustomerId, setHistoryByCustomerId] = useState<Record<string, any[]>>({});
  const [dealQuotes, setDealQuotes] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [dealOptions, setDealOptions] = useState({
    insuranceProviders: ['AXA', 'Allianz', 'MetLife', 'Bupa'],
    financeProviders: ['Emirates NBD', 'ADCB', 'Mashreq', 'Other'],
    financingPlans: ['24 months', '36 months', '48 months', '60 months'],
    dealStatuses: ['proposal', 'finance_review', 'approved', 'won', 'lost'],
  });
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    vehiclePrice: '0',
    accessoriesTotal: '0',
    discounts: '0',
    vatRate: '5',
    registrationAndInsurance: '0',
    serviceContract: '0',
    warranty: '0',
    financeCharges: '0',
    tradeInValue: '0',
    downPayment: '0',
    insuranceProvider: '',
    financeProvider: '',
    financingPlan: '',
    dealStatus: 'proposal',
  });
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [locationCurrencyCode, setLocationCurrencyCode] = useState('AED');

  const fetchData = async () => {
    const locationFilter = profile?.location_id
      ? [{ field: 'location_id', op: 'eq' as const, value: profile.location_id }]
      : [];

    let nextCurrencyCode = 'AED';
    if (profile?.location_id) {
      try {
        const locations = await apiGet<any[]>(`/api/locations?ids=${encodeURIComponent(profile.location_id)}&is_active=true`);
        const location = Array.isArray(locations) ? locations[0] : null;
        nextCurrencyCode = resolveCurrencyCode(location?.currency_type || 'AED');
      } catch {
        nextCurrencyCode = 'AED';
      }
    }
    setLocationCurrencyCode(nextCurrencyCode);

    const [oppRows, taskRows] = await Promise.all([
      apiDbQuery<any[]>({
        table: 'sales_opportunities',
        action: 'select',
        select: 'id, customer_id, temperature, stage, updated_at, notes, owner_profile_id, location_id',
        filters: [
          ...locationFilter,
          { field: 'stage', op: 'not_in', value: ['won', 'lost'] },
        ],
        order: [{ field: 'updated_at', ascending: false }],
        limit: 500,
      }),
      apiDbQuery<any[]>({
        table: 'sales_tasks',
        action: 'select',
        select: 'id, title, due_at, status, priority, customer_id, assigned_to_profile_id, opportunity_id, created_at',
        filters: [{ field: 'status', op: 'eq', value: 'open' }],
        order: [{ field: 'due_at', ascending: true }],
        limit: 500,
      }),
    ]);

    const customerIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.customer_id),
      ...(taskRows || []).map((t: any) => t.customer_id),
    ].filter(Boolean)));

    const profileIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.owner_profile_id),
      ...(taskRows || []).map((t: any) => t.assigned_to_profile_id),
    ].filter(Boolean)));

    const driveIds = Array.from(new Set([
      ...(oppRows || []).map((o: any) => o.latest_test_drive_id),
      ...(taskRows || []).map((t: any) => t.test_drive_id),
    ].filter(Boolean)));

    const [customers, profiles, drives, feedbackRows, activityEvents] = await Promise.all([
      customerIds.length
        ? apiGet<any[]>(`/api/customers?ids=${encodeURIComponent(customerIds.join(','))}`)
        : Promise.resolve([]),
      profileIds.length
        ? apiDbQuery<any[]>({
            table: 'profiles',
            action: 'select',
            select: 'id, full_name, email, phone',
            filters: [{ field: 'id', op: 'in', value: profileIds }],
          })
        : Promise.resolve([]),
      driveIds.length
        ? apiGet<any[]>(`/api/test-drives?ids=${encodeURIComponent(driveIds.join(','))}`)
        : Promise.resolve([]),
      customerIds.length
        ? apiDbQuery<any[]>({
            table: 'test_drive_feedback',
            action: 'select',
            select: 'id, test_drive_id, customer_id, customer_name, rating, experience_badge, total_duration_minutes, feedback_text, would_recommend, created_at',
            filters: [{ field: 'customer_id', op: 'in', value: customerIds }],
            order: [{ field: 'created_at', ascending: false }],
            limit: 200,
          })
        : Promise.resolve([]),
      apiGet<any[]>(`/api/activity/events?limit=400`),
    ]);

    const customerMap = (customers || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const profileMap = (profiles || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const driveMap = (drives || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const feedbackMap = (feedbackRows || []).reduce((acc: Record<string, any[]>, row: any) => {
      const customerId = row.customer_id;
      if (!customerId) return acc;
      acc[customerId] = [...(acc[customerId] || []), row];
      return acc;
    }, {});

    const eventProfileIds = Array.from(new Set((activityEvents || []).map((event: any) => event.profile_id).filter(Boolean)));
    const activityProfileRows = eventProfileIds.length
      ? await apiDbQuery<any[]>({
          table: 'profiles',
          action: 'select',
          select: 'id, full_name',
          filters: [{ field: 'id', op: 'in', value: eventProfileIds }],
        })
      : [];

    const activityProfileMap = (activityProfileRows || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.id] = row;
      return acc;
    }, {});

    const historyMap = (activityEvents || []).reduce((acc: Record<string, any[]>, event: any) => {
      const meta = event?.metadata ?? {};
      const customerId = meta.customerId || meta.customer_id || null;
      if (!customerId || !customerIds.includes(customerId)) return acc;
      acc[customerId] = [...(acc[customerId] || []), {
        ...event,
        profile_name: activityProfileMap[event.profile_id]?.full_name || 'Team',
      }];
      return acc;
    }, {});

    setCustomersById(customerMap);
    setProfilesById({ ...profileMap, ...activityProfileMap });
    setTestDrivesById(driveMap);
    setFeedbackByCustomerId(feedbackMap);
    setHistoryByCustomerId(historyMap);
    setOpportunities((oppRows || []).map((opp: any) => ({
      ...opp,
      linked_drive: driveMap[opp.latest_test_drive_id] || null,
      owner_profile: profileMap[opp.owner_profile_id] || null,
    })));
    setTasks((taskRows || []).map((task: any) => ({
      ...task,
      linked_drive: task.test_drive_id ? driveMap[task.test_drive_id] || null : null,
      assigned_profile: profileMap[task.assigned_to_profile_id] || null,
    })));
  };

  useEffect(() => {
    void fetchData();
  }, [profile?.id]);

  const takeFollowUp = async (task: any) => {
    if (!profile?.id || !task?.id) return;
    await apiDbQuery({
      table: 'sales_tasks',
      action: 'update',
      payload: { assigned_to_profile_id: profile.id },
      filters: [{ field: 'id', op: 'eq', value: task.id }],
    });
    await fetchData();
  };

  const mergedItems = useMemo(() => {
    const visibleTasks = tasks
      .filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id)
      .map((t) => ({ ...t, _type: 'task' as const }));

    const oppItems = opportunities.map((o) => ({ ...o, _type: 'opportunity' as const }));

    if (filter === 'task') return visibleTasks;
    if (filter === 'lead') return oppItems.filter((o) => isLeadStage(o.stage));
    if (filter === 'opportunity') return oppItems.filter((o) => isOpportunityStage(o.stage));
    if (filter === 'hot') return oppItems.filter((o) => o.temperature === 'hot');
    if (filter === 'warm') return oppItems.filter((o) => o.temperature === 'warm');
    if (filter === 'cold') return oppItems.filter((o) => o.temperature === 'cold');

    const allItems = [...visibleTasks, ...oppItems];
    allItems.sort((a, b) => {
      const aTime = a._type === 'task'
        ? (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : (a.updated_at ? new Date(a.updated_at).getTime() : 0);
      const bTime = b._type === 'task'
        ? (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER)
        : (b.updated_at ? new Date(b.updated_at).getTime() : 0);
      return aTime - bTime;
    });

    return allItems;
  }, [opportunities, tasks, filter, profile?.id]);

  const oppCount = opportunities.length;
  const leadCount = opportunities.filter((o) => isLeadStage(o.stage)).length;
  const opportunityCount = opportunities.filter((o) => isOpportunityStage(o.stage)).length;
  const taskCount = tasks.filter((t) => !t.assigned_to_profile_id || t.assigned_to_profile_id === profile?.id).length;
  const hotCount = opportunities.filter((o) => o.temperature === 'hot').length;
  const warmCount = opportunities.filter((o) => o.temperature === 'warm').length;
  const coldCount = opportunities.filter((o) => o.temperature === 'cold').length;

  const filterCards: Array<{ key: FilterType; label: string; count: number; activeClass: string; inactiveClass: string; dotClass: string }> = [
    { key: 'all', label: 'All', count: oppCount + taskCount, activeClass: 'bg-slate-900 text-white border-slate-900', inactiveClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300', dotClass: 'bg-slate-500' },
    { key: 'lead', label: 'Leads', count: leadCount, activeClass: 'bg-sky-600 text-white border-sky-600', inactiveClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-300', dotClass: 'bg-sky-500' },
    { key: 'opportunity', label: 'Opportunities', count: opportunityCount, activeClass: 'bg-violet-600 text-white border-violet-600', inactiveClass: 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-300', dotClass: 'bg-violet-500' },
    { key: 'task', label: 'Tasks', count: taskCount, activeClass: 'bg-emerald-600 text-white border-emerald-600', inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300', dotClass: 'bg-emerald-500' },
    { key: 'hot', label: 'Hot', count: hotCount, activeClass: 'bg-rose-600 text-white border-rose-600', inactiveClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300', dotClass: 'bg-rose-500' },
    { key: 'warm', label: 'Warm', count: warmCount, activeClass: 'bg-amber-500 text-white border-amber-500', inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300', dotClass: 'bg-amber-500' },
    { key: 'cold', label: 'Cold', count: coldCount, activeClass: 'bg-sky-600 text-white border-sky-600', inactiveClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-300', dotClass: 'bg-sky-500' },
  ];

  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
    if (diffH < 0) return { label: 'Overdue', cls: 'text-rose-600 font-semibold' };
    if (diffH < 24) return { label: `Due in ${diffH}h`, cls: 'text-amber-600 font-semibold' };
    return { label: d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), cls: 'text-muted-foreground' };
  };

  const selectedQuote = useMemo(() => {
    if (!dealQuotes.length) return null;
    if (selectedQuoteId) {
      return dealQuotes.find((quote) => quote.id === selectedQuoteId) ?? dealQuotes[0];
    }
    return dealQuotes[0];
  }, [dealQuotes, selectedQuoteId]);

  const quotePreview = useMemo(() => calculateDealSummary({
    vehiclePrice: Number(quoteForm.vehiclePrice) || 0,
    accessoriesTotal: Number(quoteForm.accessoriesTotal) || 0,
    discounts: Number(quoteForm.discounts) || 0,
    vatRate: Number(quoteForm.vatRate) || 0,
    registrationAndInsurance: Number(quoteForm.registrationAndInsurance) || 0,
    serviceContract: Number(quoteForm.serviceContract) || 0,
    warranty: Number(quoteForm.warranty) || 0,
    financeCharges: Number(quoteForm.financeCharges) || 0,
    tradeInValue: Number(quoteForm.tradeInValue) || 0,
    downPayment: Number(quoteForm.downPayment) || 0,
  }), [quoteForm]);

  useEffect(() => {
    if (!dealQuotes.length) {
      setSelectedQuoteId(null);
      return;
    }

    if (!selectedQuoteId || !dealQuotes.some((quote) => quote.id === selectedQuoteId)) {
      setSelectedQuoteId(dealQuotes[0].id || null);
    }
  }, [dealQuotes, selectedQuoteId]);

  useEffect(() => {
    setShowMoreInfo(false);
  }, [selectedItem?.id, selectedItem?._type]);

  useEffect(() => {
    const loadDealOptions = async () => {
      try {
        const rows = await apiDbQuery<any[]>({
          table: 'dealer_settings',
          action: 'select',
          select: '*',
          filters: [{ field: 'dealer_id', op: 'eq', value: profile?.dealer_id || '' }],
          order: [{ field: 'updated_at', ascending: false }],
        });

        const settingsMap = (rows || []).reduce((acc: Record<string, any>, row: any) => {
          acc[row.key] = row.value;
          return acc;
        }, {});76
        const normalizeList = (value: unknown, fallback: string[]) => {
          if (Array.isArray(value)) return value.filter(Boolean).map(String);
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
            } catch {
              // fallback to comma split
            }
            return value.split(',').map((item) => item.trim()).filter(Boolean);
          }
          return fallback;
        };

        setDealOptions({
          insuranceProviders: normalizeList(settingsMap.insurance_providers, ['AXA', 'Allianz', 'MetLife', 'Bupa']),
          financeProviders: normalizeList(settingsMap.finance_providers, ['Emirates NBD', 'ADCB', 'Mashreq', 'Other']),
          financingPlans: normalizeList(settingsMap.financing_plans, ['24 months', '36 months', '48 months', '60 months']),
          dealStatuses: normalizeList(settingsMap.deal_statuses, ['proposal', 'finance_review', 'approved', 'won', 'lost']),
        });
      } catch {
        // keep defaults
      }
    };

    if (profile?.dealer_id) {
      void loadDealOptions();
    }
  }, [profile?.dealer_id]);

  useEffect(() => {
    if (!selectedItem || selectedItem._type !== 'opportunity') {
      setDealQuotes([]);
      return;
    }

    const loadDealQuotes = async () => {
      try {
        const rows = await apiGet<any[]>(`/api/deal-quotes?opportunity_id=${encodeURIComponent(selectedItem.id)}`);
        const quoteList = Array.isArray(rows) ? rows : rows?.data || [];
        setDealQuotes(quoteList || []);
      } catch {
        setDealQuotes([]);
      }
    };

    void loadDealQuotes();
  }, [selectedItem?.id, selectedItem?._type]);

  const applyQuoteForm = (quote: any) => {
    setSelectedQuoteId(quote?.id || null);
    setEditingQuoteId(quote?.id || null);
    setQuoteForm({
      vehiclePrice: String(quote?.vehicle_price ?? 0),
      accessoriesTotal: String(quote?.accessories_total ?? 0),
      discounts: String(quote?.discounts ?? 0),
      vatRate: String(quote?.vat_rate ?? 5),
      registrationAndInsurance: String(quote?.registration_and_insurance ?? 0),
      serviceContract: String(quote?.service_contract ?? 0),
      warranty: String(quote?.warranty ?? 0),
      financeCharges: String(quote?.finance_charges ?? 0),
      tradeInValue: String(quote?.trade_in_value ?? 0),
      downPayment: String(quote?.down_payment ?? 0),
      insuranceProvider: quote?.insurance_provider || '',
      financeProvider: quote?.finance_provider || '',
      financingPlan: quote?.financing_plan || '',
      dealStatus: quote?.status || 'proposal',
    });
    setShowQuoteForm(true);
  };

  const handleSelectQuote = (quote: any) => {
    setSelectedQuoteId(quote?.id || null);
    setEditingQuoteId(quote?.id || null);
    setQuoteForm({
      vehiclePrice: String(quote?.vehicle_price ?? 0),
      accessoriesTotal: String(quote?.accessories_total ?? 0),
      discounts: String(quote?.discounts ?? 0),
      vatRate: String(quote?.vat_rate ?? 5),
      registrationAndInsurance: String(quote?.registration_and_insurance ?? 0),
      serviceContract: String(quote?.service_contract ?? 0),
      warranty: String(quote?.warranty ?? 0),
      financeCharges: String(quote?.finance_charges ?? 0),
      tradeInValue: String(quote?.trade_in_value ?? 0),
      downPayment: String(quote?.down_payment ?? 0),
      insuranceProvider: quote?.insurance_provider || '',
      financeProvider: quote?.finance_provider || '',
      financingPlan: quote?.financing_plan || '',
      dealStatus: quote?.status || 'proposal',
    });
    setShowQuoteForm(true);
  };

  const convertLeadToOpportunity = async (item: any) => {
    if (!item?.id || !profile?.id) return;

    const update = buildLeadConversionUpdate({
      stage: item.stage,
      notes: item.notes,
      timestamp: new Date(),
    });

    try {
      await apiDbQuery({
        table: 'sales_opportunities',
        action: 'update',
        payload: {
          stage: update.stage,
          notes: update.notes,
          updated_at: update.updated_at,
        },
        filters: [{ field: 'id', op: 'eq', value: item.id }],
      });

      await fetchData();
      setSelectedItem((prev) => prev && prev.id === item.id ? { ...prev, stage: update.stage, notes: update.notes } : prev);
      window.alert('Lead converted to opportunity successfully');
    } catch (error: any) {
      window.alert(error?.message || 'Unable to convert lead to opportunity');
    }
  };

  const markOpportunityAsSale = async (item: any) => {
    if (!item?.id || !profile?.id) return;

    const quote = dealQuotes.find((row) => row.opportunity_id === item.id) || dealQuotes[0];
    if (!quote) {
      window.alert('Create a quote before marking this opportunity as sold');
      return;
    }

    const salePayload = buildSaleBookingFromOpportunity({
      opportunityId: item.id,
      customerId: item.customer_id,
      vehicleId: item.linked_drive?.vehicle_id || null,
      testDriveId: item.latest_test_drive_id || item.linked_drive?.id || null,
      locationId: profile?.location_id || null,
      salesPersonProfileId: profile?.id || null,
      quote: {
        final_payable: quote.final_payable ?? quote.finalPayable,
        status: 'won',
        insurance_provider: quote.insurance_provider,
        finance_provider: quote.finance_provider,
        financing_plan: quote.financing_plan,
      },
    });

    try {
      await apiPost('/api/car-bookings', salePayload);
      await apiDbQuery({
        table: 'sales_opportunities',
        action: 'update',
        payload: {
          stage: 'won',
          updated_at: new Date().toISOString(),
        },
        filters: [{ field: 'id', op: 'eq', value: item.id }],
      });
      await fetchData();
      window.alert('Opportunity marked as sold and booking created');
    } catch (error: any) {
      window.alert(error?.message || 'Unable to mark this opportunity as sold');
    }
  };

  const saveDealQuote = async () => {
    if (!selectedItem || selectedItem._type !== 'opportunity') return;

    const quoteStatus = quoteForm.dealStatus || 'proposal';
    const payload = {
      opportunity_id: selectedItem.id,
      customer_id: selectedItem.customer_id,
      test_drive_id: selectedItem.latest_test_drive_id || null,
      location_id: profile?.location_id || null,
      created_by_profile_id: profile?.id || null,
      vehicle_price: Number(quoteForm.vehiclePrice) || 0,
      accessories_total: Number(quoteForm.accessoriesTotal) || 0,
      discounts: Number(quoteForm.discounts) || 0,
      vat_rate: Number(quoteForm.vatRate) || 0,
      registration_and_insurance: Number(quoteForm.registrationAndInsurance) || 0,
      service_contract: Number(quoteForm.serviceContract) || 0,
      warranty: Number(quoteForm.warranty) || 0,
      finance_charges: Number(quoteForm.financeCharges) || 0,
      trade_in_value: Number(quoteForm.tradeInValue) || 0,
      down_payment: Number(quoteForm.downPayment) || 0,
      insurance_provider: quoteForm.insuranceProvider.trim(),
      finance_provider: quoteForm.financeProvider.trim(),
      financing_plan: quoteForm.financingPlan.trim(),
      status: quoteStatus,
    };

    try {
      let savedQuote: any = null;
      if (editingQuoteId) {
        const updated = await apiPatch<any>(`/api/deal-quotes/${encodeURIComponent(editingQuoteId)}`, payload);
        savedQuote = Array.isArray(updated) ? updated[0] : updated;
        setDealQuotes((prev) => [savedQuote, ...prev.filter((row) => row.id !== editingQuoteId)]);
        setSelectedQuoteId(savedQuote?.id || editingQuoteId);
      } else {
        const created = await apiPost<any>('/api/deal-quotes', payload);
        savedQuote = created && Array.isArray(created) ? created[0] : created;
        setDealQuotes((prev) => [savedQuote, ...prev]);
        setSelectedQuoteId(savedQuote?.id || null);
      }

      const finalQuote = savedQuote ?? {
        ...payload,
        id: editingQuoteId || 'draft-quote',
        final_payable: calculateDealSummary({
          vehiclePrice: Number(quoteForm.vehiclePrice) || 0,
          accessoriesTotal: Number(quoteForm.accessoriesTotal) || 0,
          discounts: Number(quoteForm.discounts) || 0,
          vatRate: Number(quoteForm.vatRate) || 0,
          registrationAndInsurance: Number(quoteForm.registrationAndInsurance) || 0,
          serviceContract: Number(quoteForm.serviceContract) || 0,
          warranty: Number(quoteForm.warranty) || 0,
          financeCharges: Number(quoteForm.financeCharges) || 0,
          tradeInValue: Number(quoteForm.tradeInValue) || 0,
          downPayment: Number(quoteForm.downPayment) || 0,
        }).finalPayable,
        status: quoteStatus,
      };

      if (shouldCreateBookingFromQuote(finalQuote)) {
        try {
          const bookingPayload = buildCarBookingFromQuote({
            opportunityId: selectedItem.id,
            customerId: selectedItem.customer_id,
            vehicleId: selectedItem.linked_drive?.vehicle_id || null,
            testDriveId: selectedItem.latest_test_drive_id || selectedItem.linked_drive?.id || null,
            locationId: profile?.location_id || null,
            salesPersonProfileId: profile?.id || null,
            quote: finalQuote,
          });

          if (bookingPayload.location_id && bookingPayload.booking_amount > 0) {
            await apiPost('/api/car-bookings', bookingPayload);
          }
        } catch {
          // don't block the quote save if the booking handoff fails
        }
      }

      setShowQuoteForm(false);
      setEditingQuoteId(null);
      if (savedQuote) {
        setQuoteForm({
          vehiclePrice: String(savedQuote.vehicle_price ?? 0),
          accessoriesTotal: String(savedQuote.accessories_total ?? 0),
          discounts: String(savedQuote.discounts ?? 0),
          vatRate: String(savedQuote.vat_rate ?? 5),
          registrationAndInsurance: String(savedQuote.registration_and_insurance ?? 0),
          serviceContract: String(savedQuote.service_contract ?? 0),
          warranty: String(savedQuote.warranty ?? 0),
          financeCharges: String(savedQuote.finance_charges ?? 0),
          tradeInValue: String(savedQuote.trade_in_value ?? 0),
          downPayment: String(savedQuote.down_payment ?? 0),
          insuranceProvider: savedQuote.insurance_provider || '',
          financeProvider: savedQuote.finance_provider || '',
          financingPlan: savedQuote.financing_plan || '',
          dealStatus: savedQuote.status || 'proposal',
        });
      }
    } catch (error: any) {
      window.alert(error?.message || 'Unable to save quote');
    }
  };

  const sendQuoteEmail = async (quote: any) => {
    const customer = customersById[selectedItem?.customer_id || quote?.customer_id];
    const email = customer?.email;
    if (!email) {
      window.alert('No customer email found for this quote');
      return;
    }

    const summary = `
      <p>Hi ${customer?.full_name || 'Customer'},</p>
      <p>Here is your updated deal summary for your vehicle purchase.</p>
      <ul>
        <li>Vehicle price: ${formatCurrencyValue(Number(quote?.vehicle_price || 0), locationCurrencyCode)}</li>
        <li>Accessories: ${formatCurrencyValue(Number(quote?.accessories_total || 0), locationCurrencyCode)}</li>
        <li>VAT: ${formatCurrencyValue(Number(quote?.vat_amount || 0), locationCurrencyCode)}</li>
        <li>Final payable: ${formatCurrencyValue(Number(quote?.final_payable || 0), locationCurrencyCode)}</li>
        <li>Balance after down payment: ${formatCurrencyValue(Number(quote?.balance_after_down_payment || 0), locationCurrencyCode)}</li>
        <li>Insurance: ${quote?.insurance_provider || '—'}</li>
        <li>Finance: ${quote?.finance_provider || '—'}</li>
        <li>Plan: ${quote?.financing_plan || '—'}</li>
      </ul>
      <p>Please reply to this email if you would like to review the package or request changes.</p>
    `;

    try {
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: `Your deal quote for ${customer?.full_name || 'your purchase'}`,
        html: summary,
        text: `Your deal quote summary is ready. Final payable: ${formatCurrencyValue(Number(quote?.final_payable || 0), locationCurrencyCode)}`,
        sendDirectly: true,
      });
      window.alert('Quote email sent to customer');
    } catch (error: any) {
      window.alert(error?.message || 'Unable to send quote email');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-background via-background to-violet-50/60 p-5 shadow-sm dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3">
              <div>   <h1 className="text-3xl font-bold tracking-tight text-foreground">Lead Center</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage Leads and open tasks for your team</p>
           </div>
              <div className=" inline-flex gap-2">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
                <ClipboardCheck className="h-3 w-3" />
                Sales pipeline
              </div>
            
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
              </div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <Flame className="h-3 w-3" />
                Hot leads {hotCount}
              </div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                <Snowflake className="h-3 w-3" />
                Cold leads {coldCount}
              </div>
              </div>
             </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Clock className="h-3.5 w-3.5 text-violet-600" />
              Prioritized queue
            </div>
          </div>
         <div className="grid gap-3 md:grid-cols-3 hidden md:gap-4 lg:grid-cols-6">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-violet-700 dark:text-violet-200">Pipeline</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{oppCount}</p>
            <p className="text-xs text-muted-foreground">Active leads</p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-sky-700 dark:text-sky-200">Open</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{taskCount}</p>
            <p className="text-xs text-muted-foreground">Follow-up tasks</p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900 dark:bg-rose-950/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-rose-700 dark:text-rose-200">Priority</span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{hotCount}</p>
            <p className="text-xs text-muted-foreground">Hot leads</p>
          </div>
        </div>
        </div>

    

        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filter queue
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {filterCards.map((item) => {
              const isActive = filter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all ${isActive ? item.activeClass : item.inactiveClass}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </div>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/15 text-current' : 'bg-white/80 text-current'}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {mergedItems.length === 0 ? (
            <Card className="border-dashed border-border bg-muted/20 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No items found for the selected filter.
              </CardContent>
            </Card>
          ) : mergedItems.map((item) => {
            const customer = customersById[item.customer_id];
            const phone = customer?.phone;
            const email = customer?.email;
            const isSelected = selectedItem && selectedItem.id === item.id && selectedItem._type === item._type;

            if (item._type === 'opportunity') {
              const temp = TEMP_CONFIG[item.temperature] ?? TEMP_CONFIG.cold;
              const stage = STAGE_CONFIG[item.stage] ?? STAGE_CONFIG.new;
              return (
                <div
                  key={`opp-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={`flex cursor-pointer overflow-hidden rounded-2xl border bg-background shadow-sm transition-all hover:shadow-md dark:bg-slate-950 ${temp.border} ${isSelected ? 'ring-2 ring-violet-300 ring-offset-1' : ''}`}
                >
                  <div className={`w-1.5 shrink-0 ${temp.dot}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Flame className={`h-3.5 w-3.5 ${temp.text}`} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Opportunity</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${temp.bg} ${temp.text} ${temp.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${temp.dot}`} />
                        {temp.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stage.bg} ${stage.text}`}>
                        {stage.label}
                      </span>
                      {item.updated_at && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{customer?.full_name || 'Customer'}</p>
                        {(phone || email) && (
                          <p className="mt-1 text-xs text-muted-foreground">{[phone, email].filter(Boolean).join(' · ')}</p>
                        )}
                        {item.notes && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground italic">“{item.notes}”</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {phone && (
                          <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200" title={`Call ${phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {email && (
                          <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition hover:bg-sky-200" title={`Email ${email}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low;
            const dueInfo = formatDue(item.due_at);
            const isOverdue = dueInfo?.label === 'Overdue';
            return (
              <div
                key={`task-${item.id}`}
                onClick={() => setSelectedItem(item)}
                className={`flex cursor-pointer overflow-hidden rounded-2xl border bg-background shadow-sm transition-all hover:shadow-md dark:bg-slate-950 ${isOverdue ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/10' : 'border-border bg-card/90'} ${isSelected ? 'ring-2 ring-primary/40 ring-offset-1' : ''}`}
              >
                <div className={`w-1.5 shrink-0 ${prio.accent}`} />
                <div className="flex-1 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Task</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prio.bg} ${prio.text}`}>
                      {prio.label}
                    </span>
                    {dueInfo && (
                      <span className={`ml-auto flex items-center gap-1 text-[10px] ${dueInfo.cls}`}>
                        <Calendar className="h-3 w-3" />
                        {dueInfo.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{customer?.full_name || 'Customer'}</p>
                      {(phone || email) && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{[phone, email].filter(Boolean).join(' · ')}</p>
                      )}
                      {item.notes && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground italic">“{item.notes}”</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {phone && (
                        <a href={`tel:${phone}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200" title={`Call ${phone}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {email && (
                        <a href={`mailto:${email}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition hover:bg-sky-200" title={`Email ${email}`}>
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!item.assigned_to_profile_id && (
                        <Button size="sm" className="h-8 px-3 text-xs" onClick={(e) => { e.stopPropagation(); void takeFollowUp(item); }}>
                          Take
                        </Button>
                      )}
                      {item.assigned_to_profile_id === profile?.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                          <UserCheck className="h-3 w-3" />
                          Mine
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-left text-base">
              {selectedItem?._type === 'opportunity' ? (
                isLeadStage(selectedItem.stage) ? <UserCheck className="h-4 w-4 text-sky-500" /> : <Flame className="h-4 w-4 text-rose-500" />
              ) : <ClipboardCheck className="h-4 w-4 text-primary" />}
              {selectedItem?._type === 'opportunity'
                ? (isLeadStage(selectedItem.stage) ? 'Lead details' : 'Opportunity details')
                : 'Task details'}
            </SheetTitle>
            <SheetDescription>
              {selectedItem?._type === 'opportunity'
                ? (isLeadStage(selectedItem.stage) ? 'Lead status and contact information' : 'Pipeline status and contact information')
                : 'Task follow-up and due date'}
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-5 p-5">
              {selectedItem._type === 'opportunity' && isLeadStage(selectedItem.stage) && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Lead status</div>
                      <div className="mt-1 text-sm font-medium text-sky-900 dark:text-sky-100">This record is still a lead and can be converted to an opportunity.</div>
                    </div>
                    <Button size="sm" onClick={() => void convertLeadToOpportunity(selectedItem)}>Convert</Button>
                  </div>
                </div>
              )}

              {selectedItem._type === 'opportunity' && !isLeadStage(selectedItem.stage) && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Sale action</div>
                      <div className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">This opportunity is ready to close as a sale.</div>
                    </div>
                    <Button size="sm" onClick={() => void markOpportunityAsSale(selectedItem)}>Mark sale</Button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {customersById[selectedItem.customer_id]?.full_name || 'Customer'}
                  </div>
                  {selectedItem._type === 'opportunity' ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TEMP_CONFIG[selectedItem.temperature]?.bg ?? 'bg-sky-50'} ${TEMP_CONFIG[selectedItem.temperature]?.text ?? 'text-sky-600'}`}>
                      {TEMP_CONFIG[selectedItem.temperature]?.label ?? 'Cold'}
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_CONFIG[selectedItem.priority]?.bg ?? 'bg-slate-100'} ${PRIORITY_CONFIG[selectedItem.priority]?.text ?? 'text-slate-600'}`}>
                      {PRIORITY_CONFIG[selectedItem.priority]?.label ?? 'Low'}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {customersById[selectedItem.customer_id]?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${customersById[selectedItem.customer_id].phone}`} className="text-foreground hover:underline">{customersById[selectedItem.customer_id].phone}</a>
                    </div>
                  )}
                  {customersById[selectedItem.customer_id]?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${customersById[selectedItem.customer_id].email}`} className="text-foreground hover:underline">{customersById[selectedItem.customer_id].email}</a>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                {selectedItem._type === 'opportunity' ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owner</span>
                      <span className="text-foreground font-medium text-right">{(selectedItem.owner_profile || profilesById[selectedItem.owner_profile_id])?.full_name || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stage</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_CONFIG[selectedItem.stage]?.bg ?? 'bg-slate-100'} ${STAGE_CONFIG[selectedItem.stage]?.text ?? 'text-slate-600'}`}>
                        {STAGE_CONFIG[selectedItem.stage]?.label ?? 'New'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="text-foreground">{selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Title</span>
                      <span className="text-foreground font-medium text-right">{selectedItem.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Due</span>
                      <span className="text-foreground">{selectedItem.due_at ? new Date(selectedItem.due_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No date'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="text-foreground">{(selectedItem.assigned_profile || profilesById[selectedItem.assigned_to_profile_id])?.full_name || 'Unassigned'}</span>
                    </div>
                  </>
                )}
              </div>

              {selectedItem._type === 'opportunity' && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <button
                    type="button"
                    onClick={() => setShowMoreInfo((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="text-sm font-semibold text-foreground">More info</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showMoreInfo ? 'rotate-180' : ''}`} />
                  </button>

                  {showMoreInfo && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer details</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Name</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.full_name || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Phone</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.phone || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2 col-span-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Email</span><strong className="mt-1 block text-sm text-foreground break-all">{customersById[selectedItem.customer_id]?.email || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Country</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.country || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">City</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.city || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Source</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.source || '—'}</strong></div>
                          <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Created</span><strong className="mt-1 block text-sm text-foreground">{customersById[selectedItem.customer_id]?.created_at ? new Date(customersById[selectedItem.customer_id].created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</strong></div>
                        </div>
                      </div>

                      {selectedQuote && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Finance details</div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Vehicle price</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.vehicle_price || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Final payable</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.final_payable || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Trade-in</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.trade_in_value || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Down payment</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.down_payment || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Insurance</span><strong className="mt-1 block text-sm text-foreground">{selectedQuote.insurance_provider || '—'}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Finance</span><strong className="mt-1 block text-sm text-foreground">{selectedQuote.finance_provider || '—'}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2 col-span-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Plan</span><strong className="mt-1 block text-sm text-foreground">{selectedQuote.financing_plan || '—'}</strong></div>
                            <div className="rounded-md border border-violet-200 bg-background/70 p-2 col-span-2"><span className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Balance after down payment</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.balance_after_down_payment || 0), locationCurrencyCode)}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(selectedItem._type === 'opportunity' ? (selectedItem.linked_drive || testDrivesById[selectedItem.latest_test_drive_id]) : (selectedItem.linked_drive || testDrivesById[selectedItem.test_drive_id])) && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calendar className="h-4 w-4 text-violet-600" />
                    Linked test drive
                  </div>
                  {(() => {
                    const linkedDrive = selectedItem._type === 'opportunity'
                      ? (selectedItem.linked_drive || testDrivesById[selectedItem.latest_test_drive_id])
                      : (selectedItem.linked_drive || testDrivesById[selectedItem.test_drive_id]);
                    const vehicleName = linkedDrive?.vehicles ? `${linkedDrive.vehicles.brand || ''} ${linkedDrive.vehicles.model || ''}`.trim() : linkedDrive?.vehicle_name || 'Vehicle';
                    return (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Test Drive ID</span>
                          <a
                            href="/test-drives"
                            onClick={(e) => e.stopPropagation()}
                            className="text-foreground font-medium text-right underline underline-offset-2 hover:text-violet-600"
                            title={linkedDrive?.id || 'Test drive ID'}
                          >
                            {linkedDrive?.id ? `#${linkedDrive.id.slice(0, 8)}` : '—'}
                          </a>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Drive</span>
                          <span className="text-foreground font-medium text-right">{vehicleName || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <span className="text-foreground">{linkedDrive?.status || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Date</span>
                          <span className="text-foreground">{linkedDrive?.scheduled_date ? new Date(linkedDrive.scheduled_date).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {(() => {
                const customerId = selectedItem.customer_id;
                const feedbackHistory = customerId ? (feedbackByCustomerId[customerId] || []).slice(0, 3) : [];
                return feedbackHistory.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                      Customer feedback
                    </div>
                    <div className="space-y-3">
                      {feedbackHistory.map((item: any) => (
                        <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>{item.experience_badge || 'Experience'}</span>
                            <span>{item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                          </div>
                          <div className="mb-1 flex items-center gap-1 text-amber-500">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span key={index} className={index < (item.rating || 0) ? 'text-amber-500' : 'text-slate-300'}>★</span>
                            ))}
                          </div>
                          {item.feedback_text && <p className="text-sm leading-6 text-muted-foreground">“{item.feedback_text}”</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {selectedItem._type === 'opportunity' && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                      Deal journey
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowQuoteForm((prev) => !prev)}>
                      {showQuoteForm ? 'Hide' : 'Create quote'}
                    </Button>
                  </div>

                  {showQuoteForm && (
                    <div className="mb-4 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="space-y-1"><span className="text-muted-foreground">Vehicle price</span><input value={quoteForm.vehiclePrice} onChange={(e) => setQuoteForm((prev) => ({ ...prev, vehiclePrice: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Accessories</span><input value={quoteForm.accessoriesTotal} onChange={(e) => setQuoteForm((prev) => ({ ...prev, accessoriesTotal: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Discounts</span><input value={quoteForm.discounts} onChange={(e) => setQuoteForm((prev) => ({ ...prev, discounts: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">VAT %</span><input value={quoteForm.vatRate} onChange={(e) => setQuoteForm((prev) => ({ ...prev, vatRate: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Reg + Ins</span><input value={quoteForm.registrationAndInsurance} onChange={(e) => setQuoteForm((prev) => ({ ...prev, registrationAndInsurance: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Service contract</span><input value={quoteForm.serviceContract} onChange={(e) => setQuoteForm((prev) => ({ ...prev, serviceContract: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Warranty</span><input value={quoteForm.warranty} onChange={(e) => setQuoteForm((prev) => ({ ...prev, warranty: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Finance charges</span><input value={quoteForm.financeCharges} onChange={(e) => setQuoteForm((prev) => ({ ...prev, financeCharges: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Trade-in value</span><input value={quoteForm.tradeInValue} onChange={(e) => setQuoteForm((prev) => ({ ...prev, tradeInValue: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1"><span className="text-muted-foreground">Down payment</span><input value={quoteForm.downPayment} onChange={(e) => setQuoteForm((prev) => ({ ...prev, downPayment: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground" type="number" /></label>
                        <label className="space-y-1 col-span-2"><span className="text-muted-foreground">Deal status</span><select value={quoteForm.dealStatus} onChange={(e) => setQuoteForm((prev) => ({ ...prev, dealStatus: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"><option value="">Select status</option>{dealOptions.dealStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label>
                        <label className="space-y-1 col-span-2"><span className="text-muted-foreground">Insurance provider</span><select value={quoteForm.insuranceProvider} onChange={(e) => setQuoteForm((prev) => ({ ...prev, insuranceProvider: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"><option value="">Select provider</option>{dealOptions.insuranceProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label>
                        <label className="space-y-1 col-span-2"><span className="text-muted-foreground">Finance provider</span><select value={quoteForm.financeProvider} onChange={(e) => setQuoteForm((prev) => ({ ...prev, financeProvider: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"><option value="">Select provider</option>{dealOptions.financeProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label>
                        <label className="space-y-1 col-span-2"><span className="text-muted-foreground">Financing plan</span><select value={quoteForm.financingPlan} onChange={(e) => setQuoteForm((prev) => ({ ...prev, financingPlan: e.target.value }))} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"><option value="">Select term</option>{dealOptions.financingPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select></label>
                      </div>

                      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                        <div className="flex items-center justify-between"><span>Subtotal</span><strong>{formatCurrencyValue(quotePreview.subtotal, locationCurrencyCode)}</strong></div>
                        <div className="flex items-center justify-between"><span>VAT</span><strong>{formatCurrencyValue(quotePreview.vatAmount, locationCurrencyCode)}</strong></div>
                        <div className="flex items-center justify-between"><span>Final payable</span><strong>{formatCurrencyValue(quotePreview.finalPayable, locationCurrencyCode)}</strong></div>
                        <div className="flex items-center justify-between"><span>Balance after down payment</span><strong>{formatCurrencyValue(quotePreview.balanceAfterDownPayment, locationCurrencyCode)}</strong></div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setShowQuoteForm(false); setEditingQuoteId(null); }}>Cancel</Button>
                        <Button onClick={() => void saveDealQuote()}>{editingQuoteId ? 'Update quote' : 'Save quote'}</Button>
                      </div>
                    </div>
                  )}

                  {dealQuotes.length > 0 && (
                    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Quote history</span>
                        <span className="text-[10px] text-muted-foreground">{dealQuotes.length} record{dealQuotes.length === 1 ? '' : 's'}</span>
                      </div>

                      <div className="space-y-2">
                        {dealQuotes.map((quote) => {
                          const isSelected = quote.id === selectedQuote?.id;
                          return (
                            <button
                              key={quote.id}
                              type="button"
                              onClick={() => handleSelectQuote(quote)}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition ${isSelected ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200' : 'border-border bg-background text-foreground hover:border-violet-200'}`}
                            >
                              <div>
                                <div className="font-semibold">{quote.status || 'proposal'}</div>
                                <div className="text-[10px] opacity-80">{formatCurrencyValue(Number(quote.final_payable || 0), locationCurrencyCode)}</div>
                              </div>
                              <div className="text-[10px] opacity-80">{quote.updated_at ? new Date(quote.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}</div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedQuote && (
                        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 shadow-sm dark:border-violet-900 dark:from-violet-950/40 dark:via-slate-950 dark:to-sky-950/20">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Selected quote</div>
                              <div className="mt-1 text-base font-semibold text-foreground">{selectedQuote.status || 'proposal'}</div>
                            </div>
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">{selectedQuote.status || 'proposal'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Vehicle price</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.vehicle_price || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Accessories</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.accessories_total || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Discounts</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.discounts || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">VAT</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.vat_amount || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Reg + Ins</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.registration_and_insurance || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Finance</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.finance_charges || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Trade-in</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.trade_in_value || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Down payment</span><strong className="mt-1 block text-sm text-foreground">{formatCurrencyValue(Number(selectedQuote.down_payment || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2 col-span-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Final payable</span><strong className="mt-1 block text-lg text-foreground">{formatCurrencyValue(Number(selectedQuote.final_payable || 0), locationCurrencyCode)}</strong></div>
                            <div className="rounded-md border border-border bg-background/70 p-2 col-span-2"><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Balance after down payment</span><strong className="mt-1 block text-lg text-foreground">{formatCurrencyValue(Number(selectedQuote.balance_after_down_payment || 0), locationCurrencyCode)}</strong></div>
                          </div>

                          {(selectedQuote.insurance_provider || selectedQuote.finance_provider || selectedQuote.financing_plan) && (
                            <div className="mt-3 rounded-md border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
                              {selectedQuote.insurance_provider && <div><span className="font-medium text-foreground">Insurance:</span> {selectedQuote.insurance_provider}</div>}
                              {selectedQuote.finance_provider && <div><span className="font-medium text-foreground">Finance:</span> {selectedQuote.finance_provider}</div>}
                              {selectedQuote.financing_plan && <div><span className="font-medium text-foreground">Plan:</span> {selectedQuote.financing_plan}</div>}
                            </div>
                          )}

                          <div className="mt-3 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => applyQuoteForm(selectedQuote)}>Edit quote</Button>
                            <Button size="sm" onClick={() => void sendQuoteEmail(selectedQuote)}>Send email</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {dealQuotes.length === 0 && !showQuoteForm && (
                    <p className="text-sm text-muted-foreground">No deal quote yet. Build the first finance and insurance package for this customer.</p>
                  )}
                </div>
              )}

              {selectedItem.notes && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    {selectedItem._type === 'opportunity' ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-violet-600" />}
                    {selectedItem._type === 'opportunity' ? 'Opportunity notes' : 'Task notes'}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedItem.notes}</p>
                </div>
              )}
              {(() => {
                const customerId = selectedItem.customer_id;
                const eventHistory = customerId ? (historyByCustomerId[customerId] || []).slice(0, 8) : [];
                return eventHistory.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock className="h-4 w-4 text-violet-600" />
                      Test drive history
                    </div>
                    <div className="space-y-3">
                      {eventHistory.map((event: any) => (
                        <div key={`${event.id}-${event.happened_at}`} className="flex gap-3 rounded-xl border border-border bg-muted/20 p-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{event.event_label || event.event_type || 'Activity'}</p>
                              <span className="text-[10px] text-muted-foreground">{event.happened_at ? new Date(event.happened_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{event.profile_name || 'Team'} · {event.happened_at ? new Date(event.happened_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default FollowUpsPage;


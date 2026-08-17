import { useEffect, useState } from 'react';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { listBusinessUnits, listSalesOffices, listPlants } from '@/lib/hierarchyService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Briefcase, Factory, MapPin, Tag,
  ChevronDown, ChevronRight, Settings, LayoutGrid,
  TrendingUp, Layers3, Workflow, Sparkles,
} from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import type { AppRole } from '@/constants/roles';
import { cn } from '@/lib/utils';

interface BU   { id: string; name: string; code: string; isActive: boolean; orgId?: string | null }
interface SO   { id: string; name: string; salesOfficeCode: string; businessUnitId: string; isActive: boolean; orgId?: string | null }
interface Pl   { id: string; name: string; plantCode: string; salesOfficeId: string; businessUnitId: string; isActive: boolean; orgId?: string | null }
interface Loc  { id: string; name: string; city: string | null; is_active: boolean; businessUnitId?: string | null; dealer_id?: string | null; orgId?: string | null }
interface Br   { id: string; name: string; code: string | null; is_active: boolean; dealer_id?: string | null; orgId?: string | null }
interface DealerRow { id: string; name: string }
type LocationRow = Pick<Loc, 'id' | 'name' | 'city' | 'is_active' | 'businessUnitId' | 'dealer_id' | 'orgId'>;
type BrandRow = Pick<Br, 'id' | 'name' | 'code' | 'is_active' | 'dealer_id' | 'orgId'>;

/* ─── Stat pill ─────────────────────────────────────────────────────────── */
function StatPill({
  icon: Icon, label, count, colorClass, bgClass,
}: {
  icon: React.ElementType; label: string; count: number;
  colorClass: string; bgClass: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 border shadow-sm backdrop-blur-sm', bgClass)}>
      <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-background/80 shadow-sm ring-1 ring-border/60 shrink-0">
        <Icon className={cn('h-4 w-4', colorClass)} />
      </span>
      <div className="min-w-0">
        <p className={cn('text-xl font-bold leading-none tracking-tight', colorClass)}>{count}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

/* ─── Tree node ──────────────────────────────────────────────────────────── */
function TreeNode({
  icon: Icon, label, name, code, isActive, colorClass, bgClass, borderClass,
  depth = 0, children, defaultOpen = true,
}: {
  icon: React.ElementType; label: string; name: string; code?: string;
  isActive: boolean; colorClass: string; bgClass: string; borderClass: string;
  depth?: number; children?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  const depthIndent = depth * 22;

  return (
    <div className="relative">
      {depth > 0 && (
        <span
          className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-border/80 via-border/40 to-transparent"
          style={{ left: `${Math.max(depthIndent - 12, 10)}px` }}
        />
      )}

      <div
        className={cn(
          'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-sm transition-all duration-200',
          hasChildren ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'hover:shadow-md',
          bgClass,
        )}
        style={{ marginLeft: `${depthIndent}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <span className={cn('flex items-center justify-center h-7 w-7 rounded-lg border shrink-0 ring-1 ring-inset', borderClass, bgClass)}>
          <Icon className={cn('h-3.5 w-3.5', colorClass)} />
        </span>

        <span className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="text-sm font-semibold text-foreground truncate">{name}</span>
          {code && (
            <span className="font-mono text-[10px] text-muted-foreground bg-background/80 border border-border/60 px-1.5 py-0.5 rounded-md shrink-0">
              {code}
            </span>
          )}
        </span>

        <span className={cn('hidden md:block text-[10px] font-semibold uppercase tracking-[0.18em] shrink-0', colorClass)}>
          {label}
        </span>

        <Badge
          variant={isActive ? 'default' : 'secondary'}
          className={cn(
            'text-[10px] px-2 py-0.5 shrink-0 border',
            isActive
              ? 'bg-success/10 text-success border-success/20 hover:bg-success/10'
              : 'bg-muted text-muted-foreground border-border/70 hover:bg-muted',
          )}
        >
          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', isActive ? 'bg-success' : 'bg-muted-foreground/60')} />
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {hasChildren && open && (
        <div className="mt-1.5 space-y-1">{children}</div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
const HierarchyOverview = () => {
  const { dealerId, dealerName } = useDealerContext();
  const { role } = useAuth();
  const isSuperAdmin = role === APP_ROLE.SUPERADMIN;

  const [busUnits,     setBusUnits]     = useState<BU[]>([]);
  const [salesOffices, setSalesOffices] = useState<SO[]>([]);
  const [plants,       setPlants]       = useState<Pl[]>([]);
  const [locations,    setLocations]    = useState<Loc[]>([]);
  const [brands,       setBrands]       = useState<Br[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [allDealers,   setAllDealers]   = useState<DealerRow[]>([]);
  const [filterDealer, setFilterDealer] = useState('');

  const hierarchyAllowedRoles: AppRole[] = [
    APP_ROLE.SUPERADMIN,
    APP_ROLE.DEALER_ADMIN,
    APP_ROLE.BRAND_ADMIN,
    APP_ROLE.SALES_ADMIN,
  ];

  const currentRole = role as AppRole | null;
  const canView = currentRole
    ? hierarchyAllowedRoles.includes(currentRole)
    : false;

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    if (!isSuperAdmin && !dealerId) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      if (isSuperAdmin) {
        const [bu, so, pl, locs, brs, dealers] = await Promise.all([
          listBusinessUnits().catch(() => []),
          listSalesOffices().catch(() => []),
          listPlants().catch(() => []),
          apiDbQuery<LocationRow[]>({
            table: 'locations', action: 'select',
            select: 'id, name, city, is_active, businessUnitId, dealer_id, orgId',
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<BrandRow[]>({
            table: 'brands', action: 'select',
            select: 'id, name, code, is_active, dealer_id, orgId',
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<DealerRow[]>({
            table: 'dealers', action: 'select',
            select: 'id, name',
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
        ]);
        setBusUnits(bu ?? []);
        setSalesOffices(so ?? []);
        setPlants(pl ?? []);
        setLocations(locs ?? []);
        setBrands(brs ?? []);
        setAllDealers(dealers ?? []);
      } else {
        const [bu, so, pl, locs, brs] = await Promise.all([
          listBusinessUnits(dealerId!).catch(() => []),
          listSalesOffices({ orgId: dealerId! }).catch(() => []),
          listPlants({ orgId: dealerId! }).catch(() => []),
          apiDbQuery<LocationRow[]>({
            table: 'locations', action: 'select',
            select: 'id, name, city, is_active, businessUnitId, dealer_id, orgId',
            filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<BrandRow[]>({
            table: 'brands', action: 'select',
            select: 'id, name, code, is_active, dealer_id, orgId',
            filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
        ]);
        setBusUnits(bu ?? []);
        setSalesOffices(so ?? []);
        setPlants(pl ?? []);
        setLocations(locs ?? []);
        setBrands(brs ?? []);
      }
      setLoading(false);
    };
    void load();
  }, [dealerId, canView, isSuperAdmin]);

  if (!canView) return null;

  // For superadmin: scope tree data by selected dealer filter
  const scopedDealerId = isSuperAdmin ? filterDealer : null;
  const belongsToDealer = (row: { dealer_id?: string | null; orgId?: string | null }, dealer: string) =>
    row.dealer_id === dealer || row.orgId === dealer;

  const scopedBUs       = scopedDealerId ? busUnits.filter((b) => b.orgId === scopedDealerId) : busUnits;
  const scopedSOs       = scopedDealerId ? salesOffices.filter((s) => s.orgId === scopedDealerId) : salesOffices;
  const scopedPlants    = scopedDealerId ? plants.filter((p) => p.orgId === scopedDealerId) : plants;
  const scopedLocations = scopedDealerId ? locations.filter((l) => belongsToDealer(l, scopedDealerId)) : locations;
  const scopedBrands    = scopedDealerId ? brands.filter((b) => belongsToDealer(b, scopedDealerId)) : brands;

  const displayName = isSuperAdmin
    ? (filterDealer ? (allDealers.find(d => d.id === filterDealer)?.name ?? 'All Dealers') : 'All Dealers')
    : (dealerName ?? 'Organization');

  const isEmpty = scopedBUs.length === 0 && scopedLocations.length === 0 && scopedBrands.length === 0;

  const summaryCards = [
    { icon: Building2, label: 'Business Units', value: scopedBUs.length, tone: 'violet' },
    { icon: Briefcase, label: 'Sales Offices', value: scopedSOs.length, tone: 'emerald' },
    { icon: Factory, label: 'Plants', value: scopedPlants.length, tone: 'amber' },
    { icon: MapPin, label: 'Locations', value: scopedLocations.length, tone: 'rose' },
    { icon: Tag, label: 'Brands', value: scopedBrands.length, tone: 'pink' },
  ] as const;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-cyan-500 to-emerald-500" />
      <div className="pointer-events-none absolute -right-20 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-44 w-44 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-b from-muted/50 to-background/20 px-5 py-5 sm:px-6">
        <div className="min-w-0 flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <Layers3 className="h-5 w-5 text-primary" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground font-heading tracking-wide">Entity Hierarchy</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" /> Structured view
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {displayName} organization structure across business units, sales offices, plants, locations, and brands.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSuperAdmin && (
            <select
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs shadow-sm outline-none ring-0 transition focus:border-primary/40"
              value={filterDealer}
              onChange={e => setFilterDealer(e.target.value)}
            >
              <option value="">All Dealers</option>
              {allDealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <a href="/settings?tab=hierarchy">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-border/70 px-3 text-xs shadow-sm">
              <Settings className="h-3.5 w-3.5" /> Configure
            </Button>
          </a>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {summaryCards.map(({ icon, label, value, tone }) => {
            const toneClasses = {
              violet: 'text-violet-600 dark:text-violet-400 bg-violet-50/80 dark:bg-violet-950/30 border-violet-200/80 dark:border-violet-800/60',
              emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60',
              amber: 'text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/80 dark:border-orange-800/60',
              rose: 'text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60',
              pink: 'text-pink-600 dark:text-pink-400 bg-pink-50/80 dark:bg-pink-950/30 border-pink-200/80 dark:border-pink-800/60',
            } as const;

            const [colorClass, ...bgParts] = toneClasses[tone].split(' ');

            return (
              <StatPill
                key={label}
                icon={icon}
                label={label}
                count={value}
                colorClass={colorClass}
                bgClass={bgParts.join(' ')}
              />
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-11 rounded-xl bg-muted/80 animate-pulse"
                style={{ marginLeft: `${(i % 3) * 22}px`, opacity: 1 - i * 0.12 }}
              />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
              <Workflow className="h-7 w-7 text-muted-foreground/60" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">No hierarchy set up yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Go to <strong>Settings → Entity Hierarchy</strong> to add Business Units, Sales Offices &amp; Plants.
              </p>
            </div>
            <a href="/settings?tab=hierarchy">
              <Button size="sm" variant="outline" className="mt-1 h-9 gap-1.5 rounded-xl border-border/70 px-4 shadow-sm">
                <Settings className="h-3.5 w-3.5" /> Set up now
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/10 p-3 sm:p-4">
            <TreeNode
              icon={Building2} label="Organization"
              name={displayName} isActive
              colorClass="text-primary"
              bgClass="bg-primary/5 dark:bg-primary/10"
              borderClass="border-primary/15"
              depth={0} defaultOpen
            >
              {scopedBUs.map(bu => {
                const buSOs = scopedSOs.filter(so => so.businessUnitId === bu.id);
                const buLocs = scopedLocations.filter(l => l.businessUnitId === bu.id);

                return (
                  <TreeNode
                    key={bu.id}
                    icon={Building2} label="Business Unit"
                    name={bu.name} code={bu.code} isActive={bu.isActive}
                    colorClass="text-violet-600 dark:text-violet-400"
                    bgClass="bg-violet-50/70 dark:bg-violet-950/20"
                    borderClass="border-violet-200/80 dark:border-violet-800/70"
                    depth={1} defaultOpen
                  >
                    {buSOs.map(so => {
                      const soPlants = scopedPlants.filter(p => p.salesOfficeId === so.id);
                      return (
                        <TreeNode
                          key={so.id}
                          icon={Briefcase} label="Sales Office"
                          name={so.name} code={so.salesOfficeCode} isActive={so.isActive}
                          colorClass="text-emerald-600 dark:text-emerald-400"
                          bgClass="bg-emerald-50/70 dark:bg-emerald-950/20"
                          borderClass="border-emerald-200/80 dark:border-emerald-800/70"
                          depth={2} defaultOpen
                        >
                          {soPlants.map(pl => (
                            <TreeNode
                              key={pl.id}
                              icon={Factory} label="Plant"
                              name={pl.name} code={pl.plantCode} isActive={pl.isActive}
                              colorClass="text-orange-600 dark:text-orange-400"
                              bgClass="bg-orange-50/70 dark:bg-orange-950/20"
                              borderClass="border-orange-200/80 dark:border-orange-800/70"
                              depth={3} defaultOpen={false}
                            />
                          ))}
                        </TreeNode>
                      );
                    })}

                    {buLocs.map(loc => (
                      <TreeNode
                        key={loc.id}
                        icon={MapPin} label="Location"
                        name={loc.city ? `${loc.name} · ${loc.city}` : loc.name}
                        isActive={loc.is_active}
                        colorClass="text-rose-600 dark:text-rose-400"
                        bgClass="bg-rose-50/70 dark:bg-rose-950/20"
                        borderClass="border-rose-200/80 dark:border-rose-800/70"
                        depth={2}
                      />
                    ))}
                  </TreeNode>
                );
              })}

              {scopedLocations.filter((l) => !l.businessUnitId).map(loc => (
                <TreeNode
                  key={loc.id}
                  icon={MapPin} label="Location"
                  name={loc.city ? `${loc.name} · ${loc.city}` : loc.name}
                  isActive={loc.is_active}
                  colorClass="text-rose-600 dark:text-rose-400"
                  bgClass="bg-rose-50/70 dark:bg-rose-950/20"
                  borderClass="border-rose-200/80 dark:border-rose-800/70"
                  depth={1}
                />
              ))}

              {scopedBrands.map(b => (
                <TreeNode
                  key={b.id}
                  icon={Tag} label="Brand"
                  name={b.name} code={b.code ?? undefined}
                  isActive={b.is_active}
                  colorClass="text-pink-600 dark:text-pink-400"
                  bgClass="bg-pink-50/70 dark:bg-pink-950/20"
                  borderClass="border-pink-200/80 dark:border-pink-800/70"
                  depth={1}
                />
              ))}
            </TreeNode>
          </div>
        )}
      </div>
    </div>
  );
};

export default HierarchyOverview;

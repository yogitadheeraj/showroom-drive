import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDealerContext } from '@/hooks/useDealerContext';
import { useAuth } from '@/hooks/useAuth';
import { apiDbQuery } from '@/lib/apiClient';
import { listBusinessUnits, listSalesOffices, listPlants } from '@/lib/hierarchyService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Briefcase, Factory, MapPin, Tag,
  ChevronDown, ChevronRight, Settings, LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import { APP_ROLE } from '@/constants/roles';
import { cn } from '@/lib/utils';

interface BU   { id: string; name: string; code: string; isActive: boolean }
interface SO   { id: string; name: string; salesOfficeCode: string; businessUnitId: string; isActive: boolean }
interface Pl   { id: string; name: string; plantCode: string; salesOfficeId: string; businessUnitId: string; isActive: boolean }
interface Loc  { id: string; name: string; city: string | null; is_active: boolean; businessUnitId?: string | null }
interface Br   { id: string; name: string; code: string | null; is_active: boolean }

/* ─── Stat pill ─────────────────────────────────────────────────────────── */
function StatPill({
  icon: Icon, label, count, colorClass, bgClass,
}: {
  icon: React.ElementType; label: string; count: number;
  colorClass: string; bgClass: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border', bgClass)}>
      <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-background/70 shadow-sm shrink-0">
        <Icon className={cn('h-4 w-4', colorClass)} />
      </span>
      <div className="min-w-0">
        <p className={cn('text-lg font-bold leading-none', colorClass)}>{count}</p>
        <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">{label}</p>
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

  return (
    <div className="relative">
      {/* Vertical connector line for depth > 0 */}
      {depth > 0 && (
        <span
          className="absolute left-0 top-0 bottom-0 w-px bg-border/60"
          style={{ left: `${(depth - 1) * 20 + 10}px` }}
        />
      )}

      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 group transition-colors',
          hasChildren ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30',
          bgClass,
        )}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        <span className={cn('flex items-center justify-center h-6 w-6 rounded-md border shrink-0', borderClass, bgClass)}>
          <Icon className={cn('h-3.5 w-3.5', colorClass)} />
        </span>

        {/* Name + code */}
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{name}</span>
          {code && (
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {code}
            </span>
          )}
        </span>

        {/* Type label (hidden on small screens) */}
        <span className={cn('hidden sm:block text-[10px] font-semibold uppercase tracking-wide shrink-0', colorClass)}>
          {label}
        </span>

        {/* Status */}
        <Badge
          variant={isActive ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 shrink-0"
        >
          {isActive ? '● Active' : '● Off'}
        </Badge>
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div className="mt-0.5 space-y-0.5">{children}</div>
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
  const [allDealers,   setAllDealers]   = useState<{ id: string; name: string }[]>([]);
  const [filterDealer, setFilterDealer] = useState('');

  const canView = [
    APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.BRAND_ADMIN, APP_ROLE.SALES_ADMIN,
  ].includes(role as any);

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
          apiDbQuery<any[]>({
            table: 'locations', action: 'select',
            select: 'id, name, city, is_active, businessUnitId, dealer_id',
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<any[]>({
            table: 'brands', action: 'select',
            select: 'id, name, code, is_active, dealer_id',
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<any[]>({
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
        setAllDealers((dealers ?? []).map((d: any) => ({ id: d.id, name: d.name })));
      } else {
        const [bu, so, pl, locs, brs] = await Promise.all([
          listBusinessUnits(dealerId!).catch(() => []),
          listSalesOffices({ orgId: dealerId! }).catch(() => []),
          listPlants({ orgId: dealerId! }).catch(() => []),
          apiDbQuery<any[]>({
            table: 'locations', action: 'select',
            select: 'id, name, city, is_active, businessUnitId',
            filters: [{ field: 'dealer_id', op: 'eq', value: dealerId }],
            order: [{ field: 'name', ascending: true }],
          }).catch(() => []),
          apiDbQuery<any[]>({
            table: 'brands', action: 'select',
            select: 'id, name, code, is_active',
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
  const scopedDealerId = isSuperAdmin ? filterDealer : dealerId;
  const scopedBUs        = scopedDealerId ? busUnits.filter((b: any) => b.orgId === scopedDealerId) : busUnits;
  const scopedSOs        = scopedDealerId ? salesOffices.filter((s: any) => s.orgId === scopedDealerId) : salesOffices;
  const scopedPlants     = scopedDealerId ? plants.filter((p: any) => p.orgId === scopedDealerId) : plants;
  const scopedLocations  = scopedDealerId ? locations.filter((l: any) => (l as any).dealer_id === scopedDealerId) : locations;
  const scopedBrands     = scopedDealerId ? brands.filter((b: any) => (b as any).dealer_id === scopedDealerId) : brands;

  const displayName = isSuperAdmin
    ? (filterDealer ? (allDealers.find(d => d.id === filterDealer)?.name ?? 'All Dealers') : 'All Dealers')
    : (dealerName ?? 'Organization');

  const isEmpty = scopedBUs.length === 0 && scopedLocations.length === 0 && scopedBrands.length === 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground font-heading">Entity Hierarchy</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <select
              className="h-7 px-2 border border-input rounded-md text-xs bg-background"
              value={filterDealer}
              onChange={e => setFilterDealer(e.target.value)}
            >
              <option value="">All Dealers</option>
              {allDealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <Link to="/settings?tab=hierarchy">
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Settings className="h-3 w-3" /> Configure
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatPill icon={Building2} label="Business Units"  count={scopedBUs.length}        colorClass="text-violet-600 dark:text-violet-400" bgClass="bg-violet-50/60 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800" />
          <StatPill icon={Briefcase} label="Sales Offices"   count={scopedSOs.length}        colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" />
          <StatPill icon={Factory}   label="Plants"          count={scopedPlants.length}     colorClass="text-orange-600 dark:text-orange-400" bgClass="bg-orange-50/60 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" />
          <StatPill icon={MapPin}    label="Locations"       count={scopedLocations.length}  colorClass="text-rose-600 dark:text-rose-400"   bgClass="bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800" />
          <StatPill icon={Tag}       label="Brands"          count={scopedBrands.length}     colorClass="text-pink-600 dark:text-pink-400"   bgClass="bg-pink-50/60 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800" />
        </div>

        {/* Tree */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-10 rounded-lg bg-muted animate-pulse"
                style={{ marginLeft: `${(i % 3) * 20}px`, opacity: 1 - i * 0.15 }}
              />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 border border-dashed rounded-xl text-center">
            <span className="flex items-center justify-center h-12 w-12 rounded-full bg-muted">
              <TrendingUp className="h-6 w-6 text-muted-foreground/50" />
            </span>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No hierarchy set up yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go to <strong>Settings → Entity Hierarchy</strong> to add Business Units, Sales Offices &amp; Plants.
              </p>
            </div>
            <Link to="/settings?tab=hierarchy">
              <Button size="sm" variant="outline" className="gap-1.5 mt-1">
                <Settings className="h-3.5 w-3.5" /> Set up now
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Organization root node */}
            <TreeNode
              icon={Building2} label="Organization"
              name={displayName} isActive
              colorClass="text-blue-600 dark:text-blue-400"
              bgClass="bg-blue-50/60 dark:bg-blue-950/20"
              borderClass="border-blue-200 dark:border-blue-800"
              depth={0} defaultOpen
            >
              {/* Business Units */}
              {scopedBUs.map(bu => {
                const buSOs = scopedSOs.filter(so => so.businessUnitId === bu.id);
                const buLocs = scopedLocations.filter(l => l.businessUnitId === bu.id);

                return (
                  <TreeNode
                    key={bu.id}
                    icon={Building2} label="Business Unit"
                    name={bu.name} code={bu.code} isActive={bu.isActive}
                    colorClass="text-violet-600 dark:text-violet-400"
                    bgClass="bg-violet-50/40 dark:bg-violet-950/10"
                    borderClass="border-violet-200 dark:border-violet-800"
                    depth={1} defaultOpen
                  >
                    {/* Sales Offices under this BU */}
                    {buSOs.map(so => {
                      const soPlants = scopedPlants.filter(p => p.salesOfficeId === so.id);
                      return (
                        <TreeNode
                          key={so.id}
                          icon={Briefcase} label="Sales Office"
                          name={so.name} code={so.salesOfficeCode} isActive={so.isActive}
                          colorClass="text-emerald-600 dark:text-emerald-400"
                          bgClass="bg-emerald-50/40 dark:bg-emerald-950/10"
                          borderClass="border-emerald-200 dark:border-emerald-800"
                          depth={2} defaultOpen
                        >
                          {soPlants.map(pl => (
                            <TreeNode
                              key={pl.id}
                              icon={Factory} label="Plant"
                              name={pl.name} code={pl.plantCode} isActive={pl.isActive}
                              colorClass="text-orange-600 dark:text-orange-400"
                              bgClass="bg-orange-50/40 dark:bg-orange-950/10"
                              borderClass="border-orange-200 dark:border-orange-800"
                              depth={3} defaultOpen={false}
                            />
                          ))}
                        </TreeNode>
                      );
                    })}

                    {/* Locations under this BU */}
                    {buLocs.map(loc => (
                      <TreeNode
                        key={loc.id}
                        icon={MapPin} label="Location"
                        name={loc.city ? `${loc.name} · ${loc.city}` : loc.name}
                        isActive={loc.is_active}
                        colorClass="text-rose-600 dark:text-rose-400"
                        bgClass="bg-rose-50/40 dark:bg-rose-950/10"
                        borderClass="border-rose-200 dark:border-rose-800"
                        depth={2}
                      />
                    ))}
                  </TreeNode>
                );
              })}

              {/* Locations not linked to any BU */}
              {scopedLocations.filter(l => !l.businessUnitId).map(loc => (
                <TreeNode
                  key={loc.id}
                  icon={MapPin} label="Location"
                  name={loc.city ? `${loc.name} · ${loc.city}` : loc.name}
                  isActive={loc.is_active}
                  colorClass="text-rose-600 dark:text-rose-400"
                  bgClass="bg-rose-50/40 dark:bg-rose-950/10"
                  borderClass="border-rose-200 dark:border-rose-800"
                  depth={1}
                />
              ))}

              {/* Brands */}
              {scopedBrands.map(b => (
                <TreeNode
                  key={b.id}
                  icon={Tag} label="Brand"
                  name={b.name} code={b.code ?? undefined}
                  isActive={b.is_active}
                  colorClass="text-pink-600 dark:text-pink-400"
                  bgClass="bg-pink-50/40 dark:bg-pink-950/10"
                  borderClass="border-pink-200 dark:border-pink-800"
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

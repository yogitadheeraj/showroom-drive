import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  helperText?: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  trendText?: string;
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'border-border bg-card',
  info: 'border-info/20 bg-info/5',
  success: 'border-success/20 bg-success/5',
  warning: 'border-warning/20 bg-warning/5',
  danger: 'border-destructive/20 bg-destructive/5',
};

const KpiCard = ({
  label,
  value,
  icon,
  helperText,
  tone = 'neutral',
  trendText,
}: KpiCardProps) => {
  return (
    <Card className={`shadow-card border ${toneClasses[tone]}`}>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-heading font-bold leading-none text-foreground">{value}</p>
          {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          {trendText ? <Badge variant="secondary" className="text-[10px]">{trendText}</Badge> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardContent>
    </Card>
  );
};

export default KpiCard;

import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  meta?: ReactNode;
}

const SectionHeader = ({ title, subtitle, action, meta }: SectionHeaderProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-heading font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        {meta ? <div className="pt-1">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
};

export default SectionHeader;

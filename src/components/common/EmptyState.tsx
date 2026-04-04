import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

const EmptyState = ({
  title,
  description = 'No records found for the selected filters.',
  icon,
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) => {
  return (
    <Card className="shadow-card border-border/80">
      <CardContent className="py-10 text-center space-y-3">
        {icon ? <div className="mx-auto w-fit text-muted-foreground">{icon}</div> : null}
        <h3 className="text-base font-heading font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        {ctaLabel && onCtaClick ? (
          <Button onClick={onCtaClick} variant="outline" size="sm">
            {ctaLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default EmptyState;

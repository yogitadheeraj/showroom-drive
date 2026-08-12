import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingStateProps = {
  message?: string;
  className?: string;
};

const LoadingState = ({ message = 'Loading...', className }: LoadingStateProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground', className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
};

export default LoadingState;

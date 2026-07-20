import { Trans } from '@lingui/react/macro';

import { cn } from '@documenso/ui/lib/utils';

type ComingSoonPlaceholderProps = {
  className?: string;
};

export const ComingSoonPlaceholder = ({ className }: ComingSoonPlaceholderProps) => {
  return (
    <div
      className={cn(
        'flex min-h-[40vh] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center',
        className,
      )}
    >
      <p className="text-3xl font-semibold tracking-tight">
        <Trans>Coming soon !!!</Trans>
      </p>
    </div>
  );
};

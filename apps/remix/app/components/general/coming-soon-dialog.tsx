import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

type ComingSoonDialogProps = {
  trigger: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
};

export const ComingSoonDialog = ({
  trigger,
  title,
  description,
}: ComingSoonDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? <Trans>Coming soon</Trans>}</DialogTitle>
          <DialogDescription>
            {description ?? (
              <Trans>This feature is not available for your account yet.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary">
              <Trans>Close</Trans>
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

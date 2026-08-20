import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { SendIcon } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopesBulkResendDialogProps = {
  envelopeIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopesBulkResendDialog = ({
  envelopeIds,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkResendDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const { mutateAsync: bulkRedistributeEnvelopes, isPending } =
    trpc.envelope.bulk.redistribute.useMutation({
      onSuccess: async (result) => {
        await trpcUtils.document.findDocumentsInternal.invalidate();

        if (result.queuedCount === 0) {
          toast({
            title: t`No reminders sent`,
            description: t`None of the selected document(s) were eligible for a reminder.`,
            variant: 'destructive',
          });
        } else if (result.skippedCount > 0) {
          toast({
            title: t`Reminders are being sent`,
            description: t`Reminders are being sent for ${result.queuedCount} document(s) in the background. ${result.skippedCount} document(s) were skipped. You'll get an email summary once it's done.`,
            variant: 'default',
          });
        } else {
          toast({
            title: t`Reminders are being sent`,
            description: t`Reminders are being sent for ${result.queuedCount} document(s) in the background. You'll get an email summary once it's done.`,
            variant: 'default',
          });
        }

        onSuccess?.();
        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: t`Error`,
          description: t`An error occurred while sending the reminders.`,
          variant: 'destructive',
        });
      },
    });

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Resend Documents</Trans>
          </DialogTitle>

          <DialogDescription>
            <Plural
              value={envelopeIds.length}
              one="You are about to resend the selected document."
              other="You are about to resend # documents."
            />
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <Trans>
            A reminder invitation will be sent to every recipient who has not completed signing yet.
            Recipients who have already signed will not be emailed.
          </Trans>
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void bulkRedistributeEnvelopes({ envelopeIds });
            }}
            loading={isPending}
          >
            <SendIcon className="mr-2 h-4 w-4" />
            <Trans>Send reminders</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

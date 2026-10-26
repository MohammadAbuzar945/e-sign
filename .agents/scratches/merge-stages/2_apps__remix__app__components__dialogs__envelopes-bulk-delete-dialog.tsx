import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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

import {
  EnvelopesBulkSelectionLimitAlert,
  isBulkSelectionOverLimit,
  MAX_ENVELOPE_IDS_PER_REQUEST,
} from '~/components/dialogs/envelopes-bulk-selection-limit-alert';

export type EnvelopesBulkDeleteDialogProps = {
  envelopeIds: string[];
  envelopeType: EnvelopeType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopesBulkDeleteDialog = ({
  envelopeIds,
  envelopeType,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkDeleteDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const trpcUtils = trpc.useUtils();

  const isDocument = envelopeType === EnvelopeType.DOCUMENT;
  const isOverLimit = isBulkSelectionOverLimit(envelopeIds.length);

  const { mutateAsync: bulkDeleteEnvelopes, isPending } = trpc.envelope.bulk.delete.useMutation({
    onSuccess: async (result) => {
      // Invalidate the appropriate query based on envelope type.
      if (isDocument) {
        await Promise.all([
          trpcUtils.document.findDocumentsInternal.invalidate(),
          trpcUtils.document.inbox.getCount.invalidate(),
          trpcUtils.document.inbox.find.invalidate(),
        ]);
      } else {
        await trpcUtils.template.findTemplates.invalidate();
      }

      if (result.failedIds.length > 0) {
        toast({
          title: isDocument ? t`Documents partially deleted` : t`Templates partially deleted`,
          description: t`${result.deletedCount} item(s) deleted. ${result.failedIds.length} item(s) could not be deleted.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: isDocument ? t`Documents deleted` : t`Templates deleted`,
          description: t`${result.deletedCount} item(s) have been deleted.`,
          variant: 'default',
        });
      }

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => {
      const error = AppError.parseError(err);

      toast({
        title: t`Too many items selected`,
        description: isBulkSelectionOverLimit(envelopeIds.length)
          ? t`You can only delete up to ${MAX_ENVELOPE_IDS_PER_REQUEST} items at a time. Please deselect some items and try again.`
          : error.message || t`An error occurred while deleting the items.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDocument ? <Trans>Delete Documents</Trans> : <Trans>Delete Templates</Trans>}
          </DialogTitle>

          <DialogDescription>
            {isDocument ? (
              <Plural
                value={envelopeIds.length}
                one="You are about to delete the selected document."
                other="You are about to delete # documents."
              />
            ) : (
              <Plural
                value={envelopeIds.length}
                one="You are about to delete the selected template."
                other="You are about to delete # templates."
              />
            )}
          </DialogDescription>
        </DialogHeader>

        <EnvelopesBulkSelectionLimitAlert selectedCount={envelopeIds.length} />

        {!isOverLimit && (
        <Alert variant="warning">
          <AlertDescription>
            <p>
              <Trans>
                Please note that this action is <strong>irreversible</strong>.
              </Trans>
            </p>

            <p className="mt-1">
              <Trans>Once confirmed, the following will occur:</Trans>
            </p>

            <ul className="mt-0.5 list-inside list-disc">
              {isDocument ? (
                <>
                  <li>
                    <Trans>Selected documents will be permanently deleted</Trans>
                  </li>
                  <li>
                    <Trans>Pending documents will have their signing process cancelled</Trans>
                  </li>
                  <li>
                    <Trans>All recipients will be notified</Trans>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Trans>Selected templates will be permanently deleted</Trans>
                  </li>
                  <li>
                    <Trans>Direct links associated with templates will be removed</Trans>
                  </li>
                </>
              )}
            </ul>
          </AlertDescription>
        </Alert>
        )}

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
            onClick={(e) => {
              e.preventDefault();
              void bulkDeleteEnvelopes({ envelopeIds });
            }}
            loading={isPending}
            variant="destructive"
            disabled={isOverLimit}
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

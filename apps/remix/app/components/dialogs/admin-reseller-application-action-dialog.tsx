import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

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
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

type ResellerApplicationAction = 'reject' | 'cancel';

type AdminResellerApplicationActionDialogProps = {
  action: ResellerApplicationAction;
  applicationId: string | null;
  organisationName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
};

export const AdminResellerApplicationActionDialog = ({
  action,
  applicationId,
  organisationName,
  open,
  onOpenChange,
  onSuccess,
}: AdminResellerApplicationActionDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  const { mutateAsync: rejectApplication, isPending: isRejecting } =
    trpc.admin.resellerApplications.reject.useMutation();

  const { mutateAsync: cancelApplication, isPending: isCancelling } =
    trpc.admin.resellerApplications.cancel.useMutation();

  const isPending = isRejecting || isCancelling;

  useEffect(() => {
    if (!open) {
      setReason('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!applicationId) {
      return;
    }

    try {
      if (action === 'reject') {
        await rejectApplication({
          applicationId,
          rejectionReason: reason.trim() || undefined,
        });

        toast({
          title: t`Application rejected`,
          description: t`The reseller application has been rejected.`,
        });
      }

      if (action === 'cancel') {
        await cancelApplication({
          applicationId,
          cancellationReason: reason.trim() || undefined,
        });

        toast({
          title: t`Application cancelled`,
          description: t`The reseller application has been cancelled.`,
        });
      }

      onOpenChange(false);
      await onSuccess();
    } catch (error) {
      toast({
        title: action === 'reject' ? t`Rejection failed` : t`Cancellation failed`,
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    }
  };

  const title =
    action === 'reject' ? (
      <Trans>Reject application</Trans>
    ) : (
      <Trans>Cancel application</Trans>
    );

  const description =
    action === 'reject' ? (
      <Trans>
        Reject the reseller application for {organisationName ?? 'this organisation'}. The
        organisation may apply again later.
      </Trans>
    ) : (
      <Trans>
        Cancel the reseller application for {organisationName ?? 'this organisation'}. The
        organisation may apply again later.
      </Trans>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            {action === 'reject' ? (
              <Trans>This marks the application as rejected and stops the onboarding process.</Trans>
            ) : (
              <Trans>This marks the application as cancelled and stops the onboarding process.</Trans>
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reseller-application-action-reason">
            <Trans>Reason (optional)</Trans>
          </label>
          <Textarea
            id="reseller-application-action-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t`Add an internal note about why this application was ${action === 'reject' ? 'rejected' : 'cancelled'}.`}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            <Trans>Close</Trans>
          </Button>
          <Button variant="destructive" loading={isPending} onClick={handleSubmit}>
            {action === 'reject' ? <Trans>Reject application</Trans> : <Trans>Cancel application</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

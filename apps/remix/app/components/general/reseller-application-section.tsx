import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ResellerApplicationSection = () => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const organisation = useCurrentOrganisation();
  const [isOpen, setIsOpen] = useState(false);

  const isResellerFeatureAllowed = user.email
    ? isResellerFeatureAllowedEmail(user.email)
    : false;

  const { data: eligibility, isLoading } = trpc.organisation.reseller.getEligibility.useQuery(
    {
      organisationId: organisation.id,
    },
    {
      enabled: isResellerFeatureAllowed,
    },
  );

  const utils = trpc.useUtils();

  const { mutateAsync: applyReseller, isPending } = trpc.organisation.reseller.apply.useMutation({
    onSuccess: async () => {
      await utils.organisation.reseller.getEligibility.invalidate({
        organisationId: organisation.id,
      });

      toast({
        title: _(msg`Application submitted`),
        description: _(
          msg`Your reseller application has been submitted. Our team will review it shortly.`,
        ),
      });

      setIsOpen(false);
    },
    onError: (error) => {
      const parsed = AppError.parseError(error);

      toast({
        title: _(msg`Unable to apply`),
        description: parsed.message,
        variant: 'destructive',
      });
    },
  });

  const isDisabled = isLoading || !eligibility?.isEligible || isPending;

  if (!isResellerFeatureAllowed) {
    return null;
  }

  return (
    <>
      <hr className="my-4" />

      <Alert
        className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 sm:mb-0">
          <AlertTitle>
            <Trans>Apply to resell e-sign credits</Trans>
          </AlertTitle>

          <AlertDescription className="mr-2">
            <Trans>
              To qualify you must first have used 50 e-sign credits and been a subscriber for 2
              months to ensure you are familiar with the platform.
            </Trans>
            {eligibility && eligibility.reasons.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {eligibility.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button disabled={isDisabled} variant="outline">
              <Trans>Apply to resell</Trans>
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Apply to become a reseller</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Submit your organisation for review. If approved, you will receive reseller terms
                  for e-signing before your reseller account is activated.
                </Trans>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                loading={isPending}
                onClick={async () => {
                  await applyReseller({ organisationId: organisation.id });
                }}
              >
                <Trans>Submit application</Trans>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Alert>
    </>
  );
};

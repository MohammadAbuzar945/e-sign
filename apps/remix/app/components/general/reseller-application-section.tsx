import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckCircle2Icon, CircleIcon, Clock3Icon, StoreIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isDemoFeatureVisible } from '@documenso/lib/constants/demo-feature-flags';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { AppError } from '@documenso/lib/errors/app-error';
import { cn } from '@documenso/ui/lib/utils';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ResellerApplicationTimeline } from '~/components/general/reseller-application-timeline';
import { ComingSoonPlaceholder } from '~/components/general/coming-soon-placeholder';

type EligibilityRequirementProps = {
  isMet: boolean;
  title: ReactNode;
  description: ReactNode;
  progressLabel?: ReactNode;
  progressValue?: number;
};

const EligibilityRequirement = ({
  isMet,
  title,
  description,
  progressLabel,
  progressValue = 0,
}: EligibilityRequirementProps) => {
  const clampedProgress = Math.min(Math.max(progressValue, 0), 100);

  return (
    <div className="rounded-lg border bg-background/80 p-4">
      <div className="flex items-start gap-3">
        {isMet ? (
          <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        ) : (
          <CircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>

          {progressLabel ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{clampedProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isMet ? 'bg-green-600' : 'bg-primary',
                  )}
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

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

  if (!isResellerFeatureAllowed) {
    return null;
  }

  if (!isDemoFeatureVisible('RESELLER_USER_FACING')) {
    return (
      <>
        <hr className="my-8" />
        <section className="overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 via-background to-background shadow-sm">
          <div className="px-6 py-8">
            <ComingSoonPlaceholder className="min-h-[24vh] border-0 bg-transparent" />
          </div>
        </section>
      </>
    );
  }

  const creditsProgress = eligibility
    ? Math.round((eligibility.creditsUsed / eligibility.requiredCredits) * 100)
    : 0;

  const hasMetCredits =
    eligibility !== undefined &&
    eligibility.creditsUsed >= eligibility.requiredCredits;

  const hasMetSubscription = eligibility?.hasSubscriptionTenure ?? false;

  const isActiveReseller = eligibility?.hasActiveResellerProfile ?? false;
  const hasActiveApplication = eligibility?.hasActiveApplication ?? false;
  const canApply = eligibility?.isEligible ?? false;

  const statusBadge = (() => {
    if (isLoading) {
      return null;
    }

    if (isActiveReseller) {
      return (
        <Badge variant="default">
          <Trans>Active reseller</Trans>
        </Badge>
      );
    }

    if (hasActiveApplication) {
      return (
        <Badge variant="secondary">
          <Clock3Icon className="mr-1 h-3.5 w-3.5" />
          <Trans>Application in review</Trans>
        </Badge>
      );
    }

    if (canApply) {
      return (
        <Badge variant="default">
          <Trans>Ready to apply</Trans>
        </Badge>
      );
    }

    return (
      <Badge variant="warning">
        <Trans>Requirements in progress</Trans>
      </Badge>
    );
  })();

  return (
    <>
      <hr className="my-8" />

      <section className="overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 via-background to-background shadow-sm">
        <div className="border-b bg-muted/20 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <StoreIcon className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    <Trans>Reseller programme</Trans>
                  </h3>
                  {statusBadge}
                </div>

                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  <Trans>
                    Resell Nomia e-sign credits to your clients with your own affiliate page,
                    pricing packages, and Paystack checkout.
                  </Trans>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
              {isActiveReseller ? (
                <Button asChild className="whitespace-nowrap">
                  <Link to={`/o/${organisation.url}/settings/reseller`}>
                    <Trans>Manage reseller settings</Trans>
                  </Link>
                </Button>
              ) : hasActiveApplication ? (
                <Button disabled variant="secondary" className="whitespace-nowrap">
                  <Trans>Application submitted</Trans>
                </Button>
              ) : (
                <Button
                  disabled={isLoading || !canApply || isPending}
                  className="whitespace-nowrap px-6"
                  onClick={() => setIsOpen(true)}
                >
                  <StoreIcon className="mr-2 h-4 w-4" />
                  <Trans>Apply to resell</Trans>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {isActiveReseller ? (
            <p className="text-sm text-muted-foreground">
              <Trans>
                Your reseller account is active. Manage your affiliate link, packages, and Paystack
                settings from reseller settings.
              </Trans>
            </p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-foreground">
                  <Trans>Qualification requirements</Trans>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Trans>
                    Complete the steps below before applying so we know you are familiar with the
                    platform.
                  </Trans>
                </p>
              </div>

              {isLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Skeleton className="h-28 rounded-lg" />
                  <Skeleton className="h-28 rounded-lg" />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <EligibilityRequirement
                    isMet={hasMetCredits}
                    title={<Trans>Use platform credits</Trans>}
                    description={
                      <Trans>
                        Use at least {eligibility?.requiredCredits ?? 50} e-sign credits before applying.
                      </Trans>
                    }
                    progressLabel={`${eligibility?.creditsUsed ?? 0} / ${eligibility?.requiredCredits ?? 50} credits`}
                    progressValue={creditsProgress}
                  />

                  <EligibilityRequirement
                    isMet={hasMetSubscription}
                    title={<Trans>Subscription tenure</Trans>}
                    description={
                      <Trans>
                        Stay subscribed for at least {eligibility?.requiredSubscriptionMonths ?? 2}{' '}
                        months.
                      </Trans>
                    }
                    progressLabel={
                      hasMetSubscription ? (
                        <Trans>Requirement met</Trans>
                      ) : (
                        <Trans>Keep your subscription active</Trans>
                      )
                    }
                    progressValue={hasMetSubscription ? 100 : 25}
                  />
                </div>
              )}

              {!isLoading && eligibility && eligibility.reasons.length > 0 && !canApply ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-foreground">
                    <Trans>Before you can apply</Trans>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {eligibility.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2">
                        <span className="text-amber-600">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!isLoading && canApply && !hasActiveApplication ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    You meet the requirements. Submit your application and our team will send reseller
                    terms for review.
                  </Trans>
                </p>
              ) : null}

              {!isLoading && eligibility?.application ? (
                <ResellerApplicationTimeline application={eligibility.application} />
              ) : null}
            </>
          )}
        </div>
      </section>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Apply to become a reseller</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Submit {organisation.name} for review. If approved, you will receive reseller terms
                for e-signing before your account is activated.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="font-medium text-foreground">
              <Trans>Your organisation snapshot</Trans>
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Trans>Credits used: {eligibility?.creditsUsed ?? 0}</Trans>
              </li>
              <li>
                <Trans>
                  Subscription requirement:{' '}
                  {hasMetSubscription ? (
                    <span className="text-foreground">
                      <Trans>Met</Trans>
                    </span>
                  ) : (
                    <span className="text-foreground">
                      <Trans>Not met yet</Trans>
                    </span>
                  )}
                </Trans>
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
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
    </>
  );
};

import { Trans } from '@lingui/react/macro';
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@documenso/ui/primitives/collapsible';

export type ResellerSetupSection =
  | 'payouts'
  | 'packages'
  | 'branding'
  | 'share';

type ResellerOnboardingChecklistProps = {
  organisationId: string;
  affiliateUrl: string;
  payoutMode: 'OWN_PAYSTACK' | 'NOMIA_SUBACCOUNT';
  hasPaystackConfigured: boolean;
  hasNomiaSubaccountConfigured: boolean;
  hasEnabledPackage: boolean;
  hasCustomizedBranding: boolean;
  onCopySuccess?: () => void;
  onGoToStep?: (section: ResellerSetupSection) => void;
};

type ChecklistStep = {
  key: ResellerSetupSection;
  title: ReactNode;
  description: ReactNode;
  isComplete: boolean;
  action?: ReactNode;
};

const getAffiliateLinkCopiedKey = (organisationId: string) =>
  `reseller-affiliate-link-copied:${organisationId}`;

export const ResellerOnboardingChecklist = ({
  organisationId,
  affiliateUrl,
  payoutMode,
  hasPaystackConfigured,
  hasNomiaSubaccountConfigured,
  hasEnabledPackage,
  hasCustomizedBranding,
  onCopySuccess,
  onGoToStep,
}: ResellerOnboardingChecklistProps) => {
  const [hasCopiedAffiliateLink, setHasCopiedAffiliateLink] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setHasCopiedAffiliateLink(
      window.localStorage.getItem(getAffiliateLinkCopiedKey(organisationId)) === 'true',
    );
  }, [organisationId]);

  const steps = useMemo<ChecklistStep[]>(
    () => [
      payoutMode === 'NOMIA_SUBACCOUNT'
        ? {
            key: 'payouts',
            title: <Trans>Add bank details for payouts</Trans>,
            description: (
              <Trans>
                Enter your bank account so Nomia can settle affiliate purchases to you via Paystack.
              </Trans>
            ),
            isComplete: hasNomiaSubaccountConfigured,
          }
        : {
            key: 'payouts',
            title: <Trans>Configure Paystack keys</Trans>,
            description: (
              <Trans>
                Add your Paystack public and secret keys so affiliate purchases go to your account.
              </Trans>
            ),
            isComplete: hasPaystackConfigured,
          },
      {
        key: 'packages',
        title: <Trans>Enable credit packages</Trans>,
        description: (
          <Trans>Turn on at least one package size that you want to sell through your affiliate page.</Trans>
        ),
        isComplete: hasEnabledPackage,
      },
      {
        key: 'branding',
        title: <Trans>Customize slug & branding</Trans>,
        description: (
          <Trans>
            Set your affiliate slug, logo, and page content so clients recognize your brand.
          </Trans>
        ),
        isComplete: hasCustomizedBranding,
      },
      {
        key: 'share',
        title: <Trans>Share your affiliate link</Trans>,
        description: (
          <Trans>Copy your link and share it with clients who should buy credits from you.</Trans>
        ),
        isComplete: hasCopiedAffiliateLink,
        action: (
          <CopyTextButton
            value={affiliateUrl}
            onCopySuccess={() => {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(getAffiliateLinkCopiedKey(organisationId), 'true');
              }

              setHasCopiedAffiliateLink(true);
              onCopySuccess?.();
            }}
          />
        ),
      },
    ],
    [
      affiliateUrl,
      hasCopiedAffiliateLink,
      hasCustomizedBranding,
      hasEnabledPackage,
      hasNomiaSubaccountConfigured,
      hasPaystackConfigured,
      onCopySuccess,
      organisationId,
      payoutMode,
    ],
  );

  const completedCount = steps.filter((step) => step.isComplete).length;
  const progressValue = Math.round((completedCount / steps.length) * 100);
  const isFullyComplete = completedCount === steps.length;

  if (isFullyComplete) {
    return null;
  }

  return (
    <Collapsible defaultOpen={false}>
      <section className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group w-full border-b bg-muted/20 px-5 py-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      <Trans>Getting started checklist</Trans>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <Trans>
                        Complete these steps to start selling credits through your affiliate page.
                      </Trans>
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-foreground">
                    <Trans>
                      {completedCount} of {steps.length} complete
                    </Trans>
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>

              <ChevronDownIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 p-5">
        {steps.map((step) => (
          <div
            key={step.key}
            className={cn(
              'rounded-lg border p-4 transition-colors',
              step.isComplete ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/10' : 'bg-background',
            )}
          >
            <div className="flex items-start gap-3">
              {step.isComplete ? (
                <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <CircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!step.isComplete && step.key !== 'share' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onGoToStep?.(step.key)}
                    >
                      <Trans>Go to step</Trans>
                    </Button>
                  )}

                  {step.key === 'share' && (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
                        {affiliateUrl}
                      </code>
                      {step.action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};

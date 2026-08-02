import { Trans } from '@lingui/react/macro';
import { ResellerApplicationStatus } from '@prisma/client';
import { CheckCircle2Icon, CircleIcon, XCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ResellerApplicationSummary } from '@documenso/lib/server-only/reseller/get-reseller-eligibility';
import { isResellerTermsRejectionReason } from '@documenso/lib/constants/reseller-application-status';
import { cn } from '@documenso/ui/lib/utils';

type TimelineStep = {
  key: string;
  title: ReactNode;
  description: ReactNode;
  date: Date | null;
  state: 'complete' | 'current' | 'upcoming' | 'failed';
};

type ResellerApplicationTimelineProps = {
  application: ResellerApplicationSummary;
};

const formatTimelineDate = (date: Date | null) => {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const buildTimelineSteps = (application: ResellerApplicationSummary): TimelineStep[] => {
  const { status } = application;

  if (status === ResellerApplicationStatus.REJECTED) {
    const rejectedByReseller = isResellerTermsRejectionReason(application.rejectionReason);

    return [
      {
        key: 'applied',
        title: <Trans>Application submitted</Trans>,
        description: <Trans>Your application was received by our team.</Trans>,
        date: application.appliedAt,
        state: 'complete',
      },
      {
        key: 'review',
        title: <Trans>Terms & conditions sent</Trans>,
        description: <Trans>We sent reseller terms for you to review and sign.</Trans>,
        date: application.termsSentAt ?? application.rejectedAt,
        state: 'complete',
      },
      {
        key: 'rejected',
        title: rejectedByReseller ? (
          <Trans>Terms rejected</Trans>
        ) : (
          <Trans>Application rejected</Trans>
        ),
        description: application.rejectionReason ? (
          application.rejectionReason
        ) : rejectedByReseller ? (
          <Trans>You declined the reseller terms. You may apply again.</Trans>
        ) : (
          <Trans>Your application was not approved. You may apply again.</Trans>
        ),
        date: application.rejectedAt,
        state: 'failed',
      },
    ];
  }

  if (status === ResellerApplicationStatus.CANCELLED) {
    return [
      {
        key: 'applied',
        title: <Trans>Application submitted</Trans>,
        description: <Trans>Your application was received by our team.</Trans>,
        date: application.appliedAt,
        state: 'complete',
      },
      {
        key: 'cancelled',
        title: <Trans>Application cancelled</Trans>,
        description: <Trans>This application was withdrawn. You may apply again.</Trans>,
        date: application.rejectedAt,
        state: 'failed',
      },
    ];
  }

  const isApproved = status === ResellerApplicationStatus.APPROVED;
  const isTermsCompleted =
    status === ResellerApplicationStatus.TERMS_COMPLETED || isApproved;
  const isTermsSent =
    status === ResellerApplicationStatus.TERMS_SENT ||
    isTermsCompleted;

  return [
    {
      key: 'applied',
      title: <Trans>Application submitted</Trans>,
      description: <Trans>Your application is in our review queue.</Trans>,
      date: application.appliedAt,
      state: 'complete',
    },
    {
      key: 'terms-sent',
      title: <Trans>Terms & conditions sent</Trans>,
      description: isTermsSent ? (
        <Trans>Check your email for the reseller terms to review and sign.</Trans>
      ) : (
        <Trans>We will send reseller terms for you to sign once approved.</Trans>
      ),
      date: application.termsSentAt,
      state: isTermsSent ? 'complete' : status === ResellerApplicationStatus.PENDING ? 'current' : 'upcoming',
    },
    {
      key: 'terms-signed',
      title: <Trans>Terms signed</Trans>,
      description: isTermsCompleted ? (
        <Trans>Your signed terms have been received.</Trans>
      ) : (
        <Trans>Sign the terms we send to complete this step.</Trans>
      ),
      date: application.termsCompletedAt ?? (isApproved ? application.approvedAt : null),
      state: isTermsCompleted
        ? 'complete'
        : isTermsSent
          ? 'current'
          : 'upcoming',
    },
    {
      key: 'activated',
      title: <Trans>Reseller activated</Trans>,
      description: isApproved ? (
        <Trans>Your reseller account is active. Configure your settings to start selling.</Trans>
      ) : (
        <Trans>Your account activates automatically after terms are signed.</Trans>
      ),
      date: application.approvedAt,
      state: isApproved ? 'complete' : isTermsCompleted ? 'current' : 'upcoming',
    },
  ];
};

const TimelineStepIcon = ({ state }: { state: TimelineStep['state'] }) => {
  if (state === 'complete') {
    return <CheckCircle2Icon className="h-5 w-5 shrink-0 text-green-600" />;
  }

  if (state === 'failed') {
    return <XCircleIcon className="h-5 w-5 shrink-0 text-destructive" />;
  }

  if (state === 'current') {
    return (
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
        <CircleIcon className="relative h-5 w-5 text-primary" />
      </span>
    );
  }

  return <CircleIcon className="h-5 w-5 shrink-0 text-muted-foreground/50" />;
};

export const ResellerApplicationTimeline = ({ application }: ResellerApplicationTimelineProps) => {
  const steps = buildTimelineSteps(application);

  return (
    <div className="rounded-lg border bg-background/80 p-4">
      <div className="mb-4">
        <p className="text-sm font-medium text-foreground">
          <Trans>Application progress</Trans>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans>Track where your reseller application is in the onboarding process.</Trans>
        </p>
      </div>

      <ol className="space-y-0">
        {steps.map((step, index) => {
          const formattedDate = formatTimelineDate(step.date);
          const isLast = index === steps.length - 1;

          return (
            <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[10px] top-6 h-[calc(100%-12px)] w-px',
                    step.state === 'complete' ? 'bg-green-600/40' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}

              <div className="relative z-[1] bg-background/80">
                <TimelineStepIcon state={step.state} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.state === 'upcoming' && 'text-muted-foreground',
                      step.state === 'failed' && 'text-destructive',
                    )}
                  >
                    {step.title}
                  </p>
                  {formattedDate && (
                    <time className="text-xs text-muted-foreground">{formattedDate}</time>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

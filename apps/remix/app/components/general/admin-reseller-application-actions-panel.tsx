import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { InfoIcon, MoreHorizontalIcon } from 'lucide-react';

import {
  getResellerApplicationStatusLabel,
  isResellerTermsRejectionReason,
} from '@documenso/lib/constants/reseller-application-status';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Label } from '@documenso/ui/primitives/label';
import { Separator } from '@documenso/ui/primitives/separator';
import { Switch } from '@documenso/ui/primitives/switch';

const IN_PROGRESS_APPLICATION_STATUSES = ['PENDING', 'TERMS_SENT', 'TERMS_COMPLETED'] as const;

type ResellerApplicationRow = {
  id: string;
  status: string;
  snapshotOrgName: string;
  snapshotApplicantName: string;
  snapshotApplicantEmail: string;
  appliedAt: Date | string;
  rejectionReason?: string | null;
  resellerProfile?: {
    status: string;
    allowNegativeCredits?: boolean;
  } | null;
};

type AdminResellerApplicationActionsPanelProps = {
  application: ResellerApplicationRow;
  isRetryingActivation: boolean;
  isUpdatingAllowNegativeCredits: boolean;
  onSendTerms: () => void;
  onActivate: () => void;
  onReject: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onAllowNegativeCreditsChange: (allowNegativeCredits: boolean) => void;
};

export const AdminResellerApplicationActionsPanel = ({
  application,
  isRetryingActivation,
  isUpdatingAllowNegativeCredits,
  onSendTerms,
  onActivate,
  onReject,
  onCancel,
  onDeactivate,
  onReactivate,
  onDelete,
  onAllowNegativeCreditsChange,
}: AdminResellerApplicationActionsPanelProps) => {
  const { t } = useLingui();

  const isInProgress = IN_PROGRESS_APPLICATION_STATUSES.includes(
    application.status as (typeof IN_PROGRESS_APPLICATION_STATUSES)[number],
  );

  const canSendTerms = application.status === 'PENDING' || application.status === 'TERMS_SENT';

  const canRetryActivation =
    application.status === 'TERMS_SENT' || application.status === 'TERMS_COMPLETED';

  const canRejectOrCancel = isInProgress;

  const canDeactivate =
    application.status === 'APPROVED' && application.resellerProfile?.status === 'ACTIVE';

  const canConfigureNegativeCredits = canDeactivate;

  const canReactivate =
    application.status === 'APPROVED' &&
    (application.resellerProfile?.status === 'INACTIVE' ||
      application.resellerProfile?.status === 'SUSPENDED');

  const canDelete =
    application.status === 'APPROVED' &&
    application.resellerProfile !== null &&
    application.resellerProfile !== undefined;

  const showActivationNote =
    application.status === 'PENDING' ||
    application.status === 'TERMS_SENT' ||
    application.status === 'TERMS_COMPLETED';

  const moreActions = [
    canRejectOrCancel
      ? {
          key: 'cancel',
          label: t`Cancel application`,
          onSelect: onCancel,
        }
      : null,
  ].filter((action) => action !== null);

  const dangerActions = [
    canRejectOrCancel
      ? {
          key: 'reject',
          label: t`Reject`,
          onSelect: onReject,
        }
      : null,
    canDeactivate
      ? {
          key: 'deactivate',
          label: t`Deactivate`,
          onSelect: onDeactivate,
        }
      : null,
    canDelete
      ? {
          key: 'delete',
          label: t`Delete`,
          onSelect: onDelete,
        }
      : null,
  ].filter((action) => action !== null);

  const hasPrimaryAction = canSendTerms || canReactivate;
  const hasSecondaryAction = moreActions.length > 0;
  const hasAdminTools = canRetryActivation;
  const hasDangerActions = dangerActions.length > 0;
  const hasAnyAction =
    hasPrimaryAction || hasSecondaryAction || hasAdminTools || hasDangerActions;

  const applicationStatusLabel = getResellerApplicationStatusLabel(
    application.status,
    application.rejectionReason,
  );

  const isRejectedByReseller = isResellerTermsRejectionReason(application.rejectionReason);

  return (
    <aside className="animate-in fade-in slide-in-from-right-2 w-full shrink-0 duration-200 lg:w-80">
      <div className="sticky top-6 space-y-5 rounded-lg border bg-background p-5 shadow-sm">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Trans>Selected application</Trans>
            </p>
            <h3 className="mt-1 text-base font-semibold">{application.snapshotOrgName}</h3>
            <p className="text-sm text-muted-foreground">{application.snapshotApplicantName}</p>
            <p className="text-xs text-muted-foreground">{application.snapshotApplicantEmail}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={isRejectedByReseller ? 'destructive' : 'neutral'}>
              {applicationStatusLabel}
            </Badge>
            {application.resellerProfile?.status && (
              <Badge variant="neutral">{application.resellerProfile.status}</Badge>
            )}
          </div>

          {application.status === 'REJECTED' && application.rejectionReason ? (
            <p className="text-xs text-muted-foreground">{application.rejectionReason}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            <Trans>
              Applied {new Date(application.appliedAt).toLocaleDateString()}
            </Trans>
          </p>
        </div>

        {showActivationNote && (
          <Alert variant="secondary" padding="tight">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              <Trans>
                Resellers are automatically activated after signing the Terms & Conditions. The
                Activate button is intended only for administrator testing and exceptional/manual
                cases.
              </Trans>
            </AlertDescription>
          </Alert>
        )}

        {!hasAnyAction && (
          <p className="text-sm text-muted-foreground">
            <Trans>No actions are available for this application status.</Trans>
          </p>
        )}

        {hasPrimaryAction && (
          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Primary action</Trans>
            </p>
            {canSendTerms ? (
              <Button className="w-full" onClick={onSendTerms}>
                <Trans>Send Terms & Conditions</Trans>
              </Button>
            ) : (
              <Button className="w-full" onClick={onReactivate}>
                <Trans>Reactivate</Trans>
              </Button>
            )}
          </section>
        )}

        {hasSecondaryAction && (
          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Secondary actions</Trans>
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full" variant="outline">
                  <MoreHorizontalIcon className="mr-2 h-4 w-4" />
                  <Trans>More actions</Trans>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <Trans>Additional actions</Trans>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moreActions.map((action) => (
                  <DropdownMenuItem key={action.key} onSelect={action.onSelect}>
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </section>
        )}

        {canConfigureNegativeCredits && (
          <>
            <Separator />
            <section className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Credit policy</Trans>
              </p>
              <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="space-y-1">
                  <Label htmlFor="allow-negative-credits" className="text-sm font-medium">
                    <Trans>Allow negative credits</Trans>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    <Trans>
                      When enabled, client purchases will always receive credits even if this
                      reseller balance is insufficient. The reseller account can go below zero.
                    </Trans>
                  </p>
                </div>
                <Switch
                  id="allow-negative-credits"
                  checked={application.resellerProfile?.allowNegativeCredits ?? false}
                  disabled={isUpdatingAllowNegativeCredits}
                  onCheckedChange={onAllowNegativeCreditsChange}
                />
              </div>
            </section>
          </>
        )}

        {hasAdminTools && (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Admin tools</Trans>
              </p>
              <Button
                className="w-full"
                variant="ghost"
                size="sm"
                loading={isRetryingActivation}
                onClick={onActivate}
              >
                <Trans>Activate</Trans>
              </Button>
            </section>
          </>
        )}

        {hasDangerActions && (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="text-xs font-medium text-destructive/80">
                <Trans>Danger zone</Trans>
              </p>
              <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                {dangerActions.map((action) => (
                  <Button
                    key={action.key}
                    className="w-full justify-start text-destructive hover:text-destructive"
                    variant="ghost"
                    size="sm"
                    onClick={action.onSelect}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
};

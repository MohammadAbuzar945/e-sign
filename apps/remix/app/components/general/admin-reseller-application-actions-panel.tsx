import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import {
  getResellerBankAccountTypeLabel,
  getResellerBankDocumentTypeLabel,
} from '@documenso/lib/constants/reseller-bank-verification';
import {
  getResellerApplicationStatusLabel,
  getResellerProfileStatusLabel,
  isResellerTermsRejectionReason,
  RESELLER_ADMIN_VIEW,
  type ResellerAdminView,
} from '@documenso/lib/constants/reseller-application-status';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Label } from '@documenso/ui/primitives/label';
import { Separator } from '@documenso/ui/primitives/separator';
import { Switch } from '@documenso/ui/primitives/switch';

import { AdminResellerCustomBulkRatesPanel } from '~/components/general/admin-reseller-custom-bulk-rates-panel';

type ResellerApplicationRow = {
  id: string;
  status: string;
  snapshotOrgName: string;
  snapshotApplicantName: string;
  snapshotApplicantEmail: string;
  appliedAt: Date | string;
  rejectionReason?: string | null;
  liveCompletedDocCount?: number;
  liveUniqueSignerCount?: number;
  liveOrgUserCount?: number;
  snapshotOrgSignupDate?: Date | string;
  resellerProfile?: {
    id?: string;
    status: string;
    allowNegativeCredits?: boolean;
    isDelinquent?: boolean;
    delinquentAt?: Date | string | null;
    zeroBalanceSince?: Date | string | null;
    availableCredits?: number;
    negativeCreditsUsed?: number;
    payoutMode?: 'OWN_PAYSTACK' | 'NOMIA_SUBACCOUNT';
    bankCode?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    bankAccountType?: 'personal' | 'business' | null;
    bankDocumentType?:
      | 'identityNumber'
      | 'passportNumber'
      | 'businessRegistrationNumber'
      | null;
    physicalAddress?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    vatStatus?: 'NOT_REGISTERED' | 'REGISTERED' | null;
    vatNumber?: string | null;
    bankDetailsConfirmedAt?: Date | string | null;
    paystackSubaccountCode?: string | null;
    subaccountStatus?: 'PENDING' | 'ACTIVE' | 'FAILED' | null;
    subaccountVerifiedAt?: Date | string | null;
    subaccountFailureReason?: string | null;
    payoutReadiness?: {
      canAcceptPayments: boolean;
      hasOwnPaystackConfigured: boolean;
      hasNomiaSubaccountConfigured: boolean;
      blockingReason: string | null;
    };
  } | null;
};

type AdminResellerApplicationActionsPanelProps = {
  application: ResellerApplicationRow;
  view: ResellerAdminView;
  isRetryingActivation: boolean;
  isUpdatingAllowNegativeCredits: boolean;
  isRefreshingBankStatus: boolean;
  isRetryingSubaccount: boolean;
  onSendTerms: () => void;
  onActivate: () => void;
  onReject: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onMarkDelinquent: () => void;
  onClearDelinquency: () => void;
  onAllowNegativeCreditsChange: (allowNegativeCredits: boolean) => void;
  onRefreshBankStatus: () => void;
  onRetrySubaccount: () => void;
};

export const AdminResellerApplicationActionsPanel = ({
  application,
  view,
  isRetryingActivation,
  isUpdatingAllowNegativeCredits,
  isRefreshingBankStatus,
  isRetryingSubaccount,
  onSendTerms,
  onActivate,
  onReject,
  onCancel,
  onDeactivate,
  onReactivate,
  onDelete,
  onMarkDelinquent,
  onClearDelinquency,
  onAllowNegativeCreditsChange,
  onRefreshBankStatus,
  onRetrySubaccount,
}: AdminResellerApplicationActionsPanelProps) => {
  const { t } = useLingui();

  const profile = application.resellerProfile;
  const isQueue = view === RESELLER_ADMIN_VIEW.QUEUE;
  const isAccounts = view === RESELLER_ADMIN_VIEW.ACCOUNTS;
  const isClosed = view === RESELLER_ADMIN_VIEW.CLOSED;

  const canSendTerms = application.status === 'PENDING' || application.status === 'TERMS_SENT';
  const canRetryActivation =
    application.status === 'TERMS_SENT' || application.status === 'TERMS_COMPLETED';
  const canRejectOrCancel =
    application.status === 'PENDING' ||
    application.status === 'TERMS_SENT' ||
    application.status === 'TERMS_COMPLETED';
  const canDeactivate =
    application.status === 'APPROVED' && profile?.status === 'ACTIVE';
  const canReactivate =
    application.status === 'APPROVED' &&
    (profile?.status === 'INACTIVE' || profile?.status === 'SUSPENDED');
  const canDelete = application.status === 'APPROVED' && Boolean(profile);
  const canConfigureNegativeCredits = canDeactivate;
  const canMarkDelinquent = canDeactivate && !profile?.isDelinquent;
  const canClearDelinquency = canDeactivate && Boolean(profile?.isDelinquent);

  const hasBankDetails = Boolean(
    profile?.bankCode && profile.bankAccountNumber && profile.bankAccountName,
  );
  const canManageBankVerification =
    isAccounts &&
    profile?.status === 'ACTIVE' &&
    (profile.payoutMode === 'NOMIA_SUBACCOUNT' || hasBankDetails);
  const canShowManualVerificationHelp =
    canManageBankVerification && hasBankDetails && profile?.subaccountStatus !== 'ACTIVE';

  const applicationStatusLabel = getResellerApplicationStatusLabel(
    application.status,
    application.rejectionReason,
  );
  const isRejectedByReseller = isResellerTermsRejectionReason(application.rejectionReason);

  const payoutReadiness = profile?.payoutReadiness;
  const payoutModeLabel =
    profile?.payoutMode === 'NOMIA_SUBACCOUNT' ? t`Nomia subaccount` : t`Own Paystack`;

  return (
    <aside className="animate-in fade-in slide-in-from-right-2 w-full shrink-0 duration-200 lg:w-96">
      <div className="sticky top-6 space-y-5 rounded-lg border bg-background p-5 shadow-sm">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isAccounts ? <Trans>Selected account</Trans> : <Trans>Selected application</Trans>}
            </p>
            <h3 className="mt-1 text-base font-semibold">{application.snapshotOrgName}</h3>
            <p className="text-sm text-muted-foreground">{application.snapshotApplicantName}</p>
            <p className="text-xs text-muted-foreground">{application.snapshotApplicantEmail}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAccounts && profile?.status ? (
              <Badge variant={profile.status === 'ACTIVE' ? 'default' : 'neutral'}>
                {getResellerProfileStatusLabel(profile.status)}
              </Badge>
            ) : (
              <Badge variant={isRejectedByReseller || application.status === 'REJECTED' ? 'destructive' : 'neutral'}>
                {applicationStatusLabel}
              </Badge>
            )}
            {isAccounts && profile?.isDelinquent ? (
              <Badge variant="destructive">
                <Trans>Delinquent</Trans>
              </Badge>
            ) : null}
          </div>

          {application.status === 'REJECTED' && application.rejectionReason ? (
            <p className="text-xs text-muted-foreground">{application.rejectionReason}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            <Trans>Applied {new Date(application.appliedAt).toLocaleDateString()}</Trans>
          </p>
        </div>

        {isQueue && (
          <>
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Eligibility</Trans>
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs">
                <p>
                  <Trans>Completed docs: {application.liveCompletedDocCount ?? 0}</Trans>
                </p>
                <p>
                  <Trans>Unique signers: {application.liveUniqueSignerCount ?? 0}</Trans>
                </p>
                <p>
                  <Trans>Org users: {application.liveOrgUserCount ?? 0}</Trans>
                </p>
                <p>
                  <Trans>
                    Signup:{' '}
                    {application.snapshotOrgSignupDate
                      ? new Date(application.snapshotOrgSignupDate).toLocaleDateString()
                      : '—'}
                  </Trans>
                </p>
              </div>
            </section>

            <Alert variant="secondary" padding="tight">
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                <Trans>
                  Resellers activate automatically after signing the Terms & Conditions. Use Activate
                  only for testing or exceptional cases.
                </Trans>
              </AlertDescription>
            </Alert>

            <section className="space-y-2">
              {canSendTerms ? (
                <Button className="w-full" onClick={onSendTerms}>
                  <Trans>Send Terms & Conditions</Trans>
                </Button>
              ) : null}

              {canRejectOrCancel ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={onCancel}>
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button variant="destructive" onClick={onReject}>
                    <Trans>Reject</Trans>
                  </Button>
                </div>
              ) : null}

              {canRetryActivation ? (
                <Button
                  className="w-full"
                  variant="ghost"
                  size="sm"
                  loading={isRetryingActivation}
                  onClick={onActivate}
                >
                  <Trans>Activate manually</Trans>
                </Button>
              ) : null}
            </section>
          </>
        )}

        {isAccounts && profile && (
          <>
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Credits</Trans>
              </p>
              <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                <p>
                  <Trans>Available: {profile.availableCredits ?? 0}</Trans>
                </p>
                <p
                  className={
                    (profile.negativeCreditsUsed ?? 0) > 0
                      ? 'font-medium text-amber-700'
                      : 'text-muted-foreground'
                  }
                >
                  <Trans>Negative used: {profile.negativeCreditsUsed ?? 0}</Trans>
                </p>
              </div>
            </section>

            {canConfigureNegativeCredits && (
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
                        Client purchases still receive credits when this reseller balance is
                        insufficient.
                      </Trans>
                    </p>
                  </div>
                  <Switch
                    id="allow-negative-credits"
                    checked={profile.allowNegativeCredits ?? false}
                    disabled={isUpdatingAllowNegativeCredits}
                    onCheckedChange={onAllowNegativeCreditsChange}
                  />
                </div>
              </section>
            )}

            {profile.id ? (
              <>
                <Separator />
                <AdminResellerCustomBulkRatesPanel resellerProfileId={profile.id} />
              </>
            ) : null}

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  <Trans>Payouts</Trans>
                </p>
                <Badge variant={payoutReadiness?.canAcceptPayments ? 'default' : 'neutral'}>
                  {payoutReadiness?.canAcceptPayments ? (
                    <Trans>Ready</Trans>
                  ) : (
                    <Trans>Not ready</Trans>
                  )}
                </Badge>
              </div>

              <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                <p>
                  <Trans>Mode: {payoutModeLabel}</Trans>
                </p>
                {profile.payoutMode === 'OWN_PAYSTACK' ? (
                  <p>
                    {payoutReadiness?.hasOwnPaystackConfigured ? (
                      <Trans>Own Paystack keys configured</Trans>
                    ) : (
                      <Trans>Own Paystack keys missing</Trans>
                    )}
                  </p>
                ) : (
                  <>
                    <p>
                      <Trans>Bank: {profile.bankName ?? '—'}</Trans>
                    </p>
                    <p>
                      <Trans>Account name: {profile.bankAccountName ?? '—'}</Trans>
                    </p>
                    <p>
                      <Trans>Account: {profile.bankAccountNumber ?? '—'}</Trans>
                    </p>
                    {profile.bankAccountType ? (
                      <p>
                        <Trans>
                          Account type: {getResellerBankAccountTypeLabel(profile.bankAccountType)}
                        </Trans>
                      </p>
                    ) : null}
                    {profile.bankDocumentType ? (
                      <p>
                        <Trans>
                          Document: {getResellerBankDocumentTypeLabel(profile.bankDocumentType)}
                        </Trans>
                      </p>
                    ) : null}
                    {profile.physicalAddress ? (
                      <p>
                        <Trans>Address: {profile.physicalAddress}</Trans>
                      </p>
                    ) : null}
                    {profile.contactPhone || profile.contactEmail ? (
                      <p>
                        <Trans>
                          Contact: {[profile.contactPhone, profile.contactEmail]
                            .filter(Boolean)
                            .join(' · ')}
                        </Trans>
                      </p>
                    ) : null}
                    {profile.vatStatus ? (
                      <p>
                        {profile.vatStatus === 'REGISTERED' ? (
                          <Trans>VAT: Registered ({profile.vatNumber ?? '—'})</Trans>
                        ) : (
                          <Trans>VAT: Not registered</Trans>
                        )}
                      </p>
                    ) : null}
                    {profile.bankDetailsConfirmedAt ? (
                      <p>
                        <Trans>Details confirmed by reseller</Trans>
                      </p>
                    ) : null}
                    {profile.paystackSubaccountCode ? (
                      <p className="truncate">
                        <Trans>Subaccount: {profile.paystackSubaccountCode}</Trans>
                      </p>
                    ) : null}
                  </>
                )}
                {payoutReadiness?.blockingReason ? (
                  <p className="text-destructive">{payoutReadiness.blockingReason}</p>
                ) : null}
                {profile.subaccountFailureReason ? (
                  <p className="text-destructive">{profile.subaccountFailureReason}</p>
                ) : null}
              </div>

              {canShowManualVerificationHelp ? (
                <Alert variant="secondary" padding="tight">
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription className="text-xs leading-relaxed">
                    <Trans>
                      Nomia verifies bank accounts manually in Paystack. After verification, use
                      Refresh status to sync the subaccount.
                    </Trans>
                  </AlertDescription>
                </Alert>
              ) : null}

              {canManageBankVerification && hasBankDetails ? (
                <div className="space-y-2">
                  {profile.subaccountStatus === 'FAILED' ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      loading={isRetryingSubaccount}
                      onClick={onRetrySubaccount}
                    >
                      <Trans>Retry subaccount registration</Trans>
                    </Button>
                  ) : null}
                  {profile.paystackSubaccountCode ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      loading={isRefreshingBankStatus}
                      onClick={onRefreshBankStatus}
                    >
                      <Trans>Refresh status</Trans>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {canManageBankVerification && !hasBankDetails ? (
                <p className="text-xs text-muted-foreground">
                  <Trans>This reseller has not submitted Nomia payout bank details yet.</Trans>
                </p>
              ) : null}
            </section>

            <Separator />

            <section className="space-y-2">
              {canReactivate ? (
                <Button className="w-full" onClick={onReactivate}>
                  <Trans>Reactivate</Trans>
                </Button>
              ) : null}

              {(canMarkDelinquent || canClearDelinquency) && (
                <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    <Trans>Delinquency testing</Trans>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Trans>
                      Simulate the 90-day zero-balance lock. Associated buyers will need to reconfirm
                      sticky billing.
                    </Trans>
                  </p>
                  {canMarkDelinquent ? (
                    <Button className="w-full" variant="outline" size="sm" onClick={onMarkDelinquent}>
                      <Trans>Mark delinquent</Trans>
                    </Button>
                  ) : null}
                  {canClearDelinquency ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={onClearDelinquency}
                    >
                      <Trans>Clear delinquency</Trans>
                    </Button>
                  ) : null}
                </div>
              )}

              {(canDeactivate || canDelete) && (
                <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive/80">
                    <Trans>Danger zone</Trans>
                  </p>
                  {canDeactivate ? (
                    <Button
                      className="w-full justify-start text-destructive hover:text-destructive"
                      variant="ghost"
                      size="sm"
                      onClick={onDeactivate}
                    >
                      <Trans>Deactivate</Trans>
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      className="w-full justify-start text-destructive hover:text-destructive"
                      variant="ghost"
                      size="sm"
                      onClick={onDelete}
                    >
                      <Trans>Delete</Trans>
                    </Button>
                  ) : null}
                </div>
              )}
            </section>
          </>
        )}

        {isClosed && (
          <p className="text-sm text-muted-foreground">
            <Trans>This application is closed. No further actions are available.</Trans>
          </p>
        )}
      </div>
    </aside>
  );
};

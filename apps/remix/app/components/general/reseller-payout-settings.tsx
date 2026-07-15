import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import {
  getDefaultResellerBankDocumentType,
  getResellerBankAccountTypeLabel,
  getResellerBankDocumentTypeLabel,
  getResellerBankDocumentTypesForAccountType,
  PAYSTACK_SA_BANK_VALIDATION_FEE_ZAR,
  RESELLER_BANK_ACCOUNT_TYPES,
} from '@documenso/lib/constants/reseller-bank-verification';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { SearchableSelect } from '@documenso/ui/primitives/searchable-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZBankDetailsFormSchema = z
  .object({
    bankCode: z.string().min(1),
    bankName: z.string().min(1),
    bankAccountNumber: z.string().min(5),
    bankAccountName: z.string().min(1),
    accountType: z.enum(['personal', 'business']),
    documentType: z.enum(['identityNumber', 'passportNumber', 'businessRegistrationNumber']),
    documentNumber: z.string().trim().min(5).max(64),
  })
  .superRefine((values, context) => {
    if (values.accountType === 'business' && values.documentType !== 'businessRegistrationNumber') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Business accounts require a business registration number',
        path: ['documentType'],
      });
    }

    if (
      values.accountType === 'personal' &&
      values.documentType === 'businessRegistrationNumber'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Personal accounts require an ID card, CNIC, or passport number',
        path: ['documentType'],
      });
    }
  });

type ResellerPayoutSettingsProps = {
  organisationId: string;
  payoutMode: 'OWN_PAYSTACK' | 'NOMIA_SUBACCOUNT';
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankAccountType: 'personal' | 'business' | null;
  bankDocumentType: 'identityNumber' | 'passportNumber' | 'businessRegistrationNumber' | null;
  bankDocumentNumber: string | null;
  subaccountStatus: 'PENDING' | 'ACTIVE' | 'FAILED' | null;
  subaccountFailureReason: string | null;
  canAcceptAffiliatePayments: boolean;
  payoutBlockingReason: string | null;
  onUpdated: () => Promise<unknown> | unknown;
};
export const ResellerPayoutSettings = ({
  organisationId,
  payoutMode,
  bankCode,
  bankName,
  bankAccountNumber,
  bankAccountName,
  bankAccountType,
  bankDocumentType,
  bankDocumentNumber,
  subaccountStatus,
  subaccountFailureReason,
  canAcceptAffiliatePayments,
  payoutBlockingReason,
  onUpdated,
}: ResellerPayoutSettingsProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState(payoutMode);
  const defaultAccountType = bankAccountType ?? 'personal';

  useEffect(() => {
    setSelectedMode(payoutMode);
  }, [payoutMode]);

  const { data: banksData, isLoading: isLoadingBanks } =
    trpc.organisation.reseller.listBanks.useQuery(
      {},
      {
        enabled: selectedMode === 'NOMIA_SUBACCOUNT',
      },
    );

  const bankForm = useForm<z.infer<typeof ZBankDetailsFormSchema>>({
    resolver: zodResolver(ZBankDetailsFormSchema),
    values: {
      bankCode: bankCode ?? '',
      bankName: bankName ?? '',
      bankAccountNumber: '',
      bankAccountName: bankAccountName ?? '',
      accountType: defaultAccountType,
      documentType: bankDocumentType ?? getDefaultResellerBankDocumentType(defaultAccountType),
      documentNumber: '',
    },
  });

  const { mutateAsync: updatePayoutMode, isPending: isUpdatingMode } =
    trpc.organisation.reseller.updatePayoutMode.useMutation({
      onSuccess: async () => {
        await onUpdated();
        toast({ title: _(msg`Payout mode updated`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Update failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: updateBankDetails, isPending: isUpdatingBank } =
    trpc.organisation.reseller.updateBankDetails.useMutation({
      onSuccess: async () => {
        await onUpdated();
        bankForm.resetField('bankAccountNumber');
        bankForm.resetField('documentNumber');
        toast({
          title: _(msg`Bank details submitted`),
          description: _(
            msg`Your Paystack subaccount has been registered. Nomia will verify your account before affiliate sales begin.`,
          ),
        });
      },
      onError: (error) => {
        toast({
          title: _(msg`Bank update failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: refreshSubaccountStatus, isPending: isRefreshingSubaccountStatus } =
    trpc.organisation.reseller.refreshSubaccountStatus.useMutation({
      onSuccess: async (result) => {
        await onUpdated();
        if (result.subaccountStatus === 'ACTIVE') {
          toast({ title: _(msg`Bank account verified`) });
          return;
        }

        toast({
          title: _(msg`Verification still pending`),
          description: _(
            msg`Paystack has not marked this subaccount as verified yet. Try again after Paystack completes their review.`,
          ),
        });
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not refresh status`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const banks = useMemo(() => banksData?.banks ?? [], [banksData?.banks]);
  const selectedBankCode = bankForm.watch('bankCode');
  const selectedAccountType = bankForm.watch('accountType');
  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === selectedBankCode),
    [banks, selectedBankCode],
  );
  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank.name,
        value: bank.code,
      })),
    [banks],
  );

  const documentTypeOptions = useMemo(
    () => getResellerBankDocumentTypesForAccountType(selectedAccountType),
    [selectedAccountType],
  );

  const statusBadge = (() => {
    if (subaccountStatus === 'ACTIVE') {
      return (
        <Badge variant="default">
          <Trans>Verified</Trans>
        </Badge>
      );
    }

    if (subaccountStatus === 'PENDING') {
      return (
        <Badge variant="neutral">
          <Trans>Pending verification</Trans>
        </Badge>
      );
    }

    if (subaccountStatus === 'FAILED') {
      return (
        <Badge variant="destructive">
          <Trans>Failed</Trans>
        </Badge>
      );
    }

    return (
      <Badge variant="neutral">
        <Trans>Not configured</Trans>
      </Badge>
    );
  })();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          <Trans>How do you want to get paid?</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans>
            Choose your own Paystack account, or enter bank details and let Nomia settle payouts.
          </Trans>
        </p>
      </div>

      {!canAcceptAffiliatePayments && payoutBlockingReason ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Affiliate sales blocked</Trans>
          </AlertTitle>
          <AlertDescription>{payoutBlockingReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={`rounded-lg border p-4 text-left transition-colors ${
            selectedMode === 'OWN_PAYSTACK'
              ? 'border-primary bg-primary/5'
              : 'hover:bg-muted/40'
          }`}
          onClick={() => setSelectedMode('OWN_PAYSTACK')}
        >
          <p className="text-sm font-medium">
            <Trans>My own Paystack account</Trans>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Trans>Clients pay into your Paystack merchant account directly.</Trans>
          </p>
        </button>

        <button
          type="button"
          className={`rounded-lg border p-4 text-left transition-colors ${
            selectedMode === 'NOMIA_SUBACCOUNT'
              ? 'border-primary bg-primary/5'
              : 'hover:bg-muted/40'
          }`}
          onClick={() => setSelectedMode('NOMIA_SUBACCOUNT')}
        >
          <p className="text-sm font-medium">
            <Trans>Bank transfer via Nomia</Trans>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Trans>No Paystack account needed — enter bank details for settlement.</Trans>
          </p>
        </button>
      </div>

      {selectedMode !== payoutMode && (
        <Button
          type="button"
          loading={isUpdatingMode}
          onClick={async () => {
            await updatePayoutMode({
              organisationId,
              payoutMode: selectedMode,
            });
          }}
        >
          <Trans>Save payout mode</Trans>
        </Button>
      )}

      {selectedMode === 'NOMIA_SUBACCOUNT' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                <Trans>Bank details for Nomia payouts</Trans>
              </p>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Enter your South African bank account and identity details. A Paystack subaccount
                  is created when you submit. Nomia verifies your account with Paystack only when
                  your bank supports validation (ZAR {PAYSTACK_SA_BANK_VALIDATION_FEE_ZAR} fee per
                  attempt, paid by Nomia).
                </Trans>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge}
              {subaccountStatus === 'PENDING' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isRefreshingSubaccountStatus}
                  onClick={async () => {
                    await refreshSubaccountStatus({ organisationId });
                  }}
                >
                  <Trans>Refresh status</Trans>
                </Button>
              ) : null}
            </div>
          </div>

          {subaccountStatus === 'PENDING' ? (
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your Paystack subaccount is registered and awaiting Nomia verification. Affiliate
                sales stay blocked until verification completes.
              </Trans>
            </p>
          ) : null}

          {subaccountStatus === 'FAILED' && subaccountFailureReason ? (
            <Alert variant="destructive">
              <AlertTitle>
                <Trans>Registration failed</Trans>
              </AlertTitle>
              <AlertDescription>{subaccountFailureReason}</AlertDescription>
            </Alert>
          ) : null}

          {bankAccountNumber ? (
            <p className="text-xs text-muted-foreground">
              <Trans>Saved account: {bankAccountNumber}</Trans>
            </p>
          ) : null}

          {bankDocumentNumber ? (
            <p className="text-xs text-muted-foreground">
              <Trans>Saved document: {bankDocumentNumber}</Trans>
            </p>
          ) : null}

          <Form {...bankForm}>
            <form
              className="space-y-4"
              onSubmit={bankForm.handleSubmit(async (values) => {
                await updateBankDetails({
                  organisationId,
                  data: values,
                });
              })}
            >
              <fieldset disabled={isUpdatingBank} className="space-y-4">
                <FormField
                  control={bankForm.control}
                  name="bankCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Bank</Trans>
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          disabled={isLoadingBanks}
                          loading={isLoadingBanks}
                          options={bankOptions}
                          placeholder={_(msg`Select bank`)}
                          searchPlaceholder={msg`Search banks...`}
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            const nextBank = banks.find((bank) => bank.code === value);
                            bankForm.setValue('bankName', nextBank?.name ?? '', {
                              shouldValidate: true,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankForm.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Account number</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={
                            bankAccountNumber
                              ? _(msg`Enter a new account number to replace ${bankAccountNumber}`)
                              : _(msg`Enter account number`)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankForm.control}
                  name="bankAccountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Account name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={_(msg`Account holder name`)} />
                      </FormControl>
                      {selectedBankCode ? (
                        <p className="text-xs text-muted-foreground">
                          <Trans>
                            Enter the account holder name exactly as it appears on the bank account.
                          </Trans>
                        </p>
                      ) : null}
                      {selectedBank && !selectedBank.supportsVerification ? (
                        <p className="text-xs text-muted-foreground">
                          <Trans>
                            This bank does not support Paystack account validation. Nomia will
                            register your subaccount without running validation.
                          </Trans>
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankForm.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Account type</Trans>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          bankForm.setValue(
                            'documentType',
                            getDefaultResellerBankDocumentType(
                              value as 'personal' | 'business',
                            ),
                            { shouldValidate: true },
                          );
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESELLER_BANK_ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {getResellerBankAccountTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankForm.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Document type</Trans>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentTypeOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              {getResellerBankDocumentTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankForm.control}
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Document number</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={
                            bankDocumentNumber
                              ? _(msg`Enter document number to update ${bankDocumentNumber}`)
                              : _(msg`ID, passport, or company registration number`)
                          }
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        <Trans>
                          Required for Paystack bank validation. Nomia uses this only for
                          verification.
                        </Trans>
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" loading={isUpdatingBank}>
                  <Trans>Submit for verification</Trans>
                </Button>
              </fieldset>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
};

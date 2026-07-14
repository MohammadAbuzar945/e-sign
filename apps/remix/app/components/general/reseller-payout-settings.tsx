import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  getDefaultResellerBankDocumentType,
  getResellerBankAccountTypeLabel,
  getResellerBankDocumentTypeLabel,
  getResellerBankDocumentTypesForAccountType,
  ZResellerBankAccountTypeSchema,
  ZResellerBankDocumentTypeSchema,
  ZResellerBankVerificationFieldsSchema,
  type ResellerBankAccountType,
  type ResellerBankDocumentType,
} from '@documenso/lib/constants/reseller-bank-verification';
import { AppError } from '@documenso/lib/errors/app-error';
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
    accountType: ZResellerBankAccountTypeSchema,
    documentType: ZResellerBankDocumentTypeSchema,
    documentNumber: z.string().trim().min(5).max(64),
  })
  .superRefine((values, context) => {
    const verificationResult = ZResellerBankVerificationFieldsSchema.safeParse({
      accountType: values.accountType,
      documentType: values.documentType,
      documentNumber: values.documentNumber,
    });

    if (!verificationResult.success) {
      for (const issue of verificationResult.error.issues) {
        context.addIssue(issue);
      }
    }
  });

type ResellerPayoutSettingsProps = {
  organisationId: string;
  payoutMode: 'OWN_PAYSTACK' | 'NOMIA_SUBACCOUNT';
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankAccountType: ResellerBankAccountType | null;
  bankDocumentType: ResellerBankDocumentType | null;
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

  const defaultAccountType = bankAccountType ?? 'personal';
  const defaultDocumentType =
    bankDocumentType ?? getDefaultResellerBankDocumentType(defaultAccountType);

  const bankForm = useForm<z.infer<typeof ZBankDetailsFormSchema>>({
    resolver: zodResolver(ZBankDetailsFormSchema),
    values: {
      bankCode: bankCode ?? '',
      bankName: bankName ?? '',
      bankAccountNumber: '',
      bankAccountName: bankAccountName ?? '',
      accountType: defaultAccountType,
      documentType: defaultDocumentType,
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
        toast({ title: _(msg`Bank details saved and submitted for verification`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Bank update failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: resolveBankAccount, isPending: isResolvingAccount } =
    trpc.organisation.reseller.resolveBankAccount.useMutation({
      onSuccess: (result) => {
        bankForm.setValue('bankAccountName', result.accountName, { shouldValidate: true });
        toast({ title: _(msg`Account name resolved`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not resolve account`),
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
            msg`Paystack has not marked this subaccount as verified yet. Try again after completing verification in Paystack.`,
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
  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank.name,
        value: bank.code,
      })),
    [banks],
  );
  const selectedBankCode = bankForm.watch('bankCode');
  const selectedAccountType = bankForm.watch('accountType');
  const selectedBank = banks.find((bank) => bank.code === selectedBankCode);
  const documentTypeOptions = getResellerBankDocumentTypesForAccountType(selectedAccountType);
  const supportsAccountNameLookup = selectedBank ? selectedBank.currency !== 'ZAR' : false;

  useEffect(() => {
    const currentDocumentType = bankForm.getValues('documentType');

    if (!documentTypeOptions.includes(currentDocumentType)) {
      bankForm.setValue('documentType', getDefaultResellerBankDocumentType(selectedAccountType), {
        shouldValidate: true,
      });
    }
  }, [bankForm, documentTypeOptions, selectedAccountType]);

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
            Choose your own Paystack account, or enter bank details and let Nomia settle payouts via
            Paystack subaccounts. You can keep either option configured.
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
                  Nomia registers your bank as a Paystack subaccount and splits affiliate sales to
                  you. Verification requires your account type and identity document details.
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
                After verifying your bank account in Paystack, refresh this page or click Refresh
                status to update verification here.
              </Trans>
            </p>
          ) : null}

          {subaccountStatus === 'FAILED' && subaccountFailureReason ? (
            <Alert variant="destructive">
              <AlertTitle>
                <Trans>Verification failed</Trans>
              </AlertTitle>
              <AlertDescription>{subaccountFailureReason}</AlertDescription>
            </Alert>
          ) : null}

          {bankAccountNumber ? (
            <p className="text-xs text-muted-foreground">
              <Trans>Saved account: {bankAccountNumber}</Trans>
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
                            const selectedBank = banks.find((bank) => bank.code === value);
                            bankForm.setValue('bankName', selectedBank?.name ?? '', {
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
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder={_(msg`Account holder name`)} />
                        </FormControl>
                        {supportsAccountNameLookup ? (
                          <Button
                            type="button"
                            variant="outline"
                            loading={isResolvingAccount}
                            onClick={async () => {
                              const accountNumber = bankForm.getValues('bankAccountNumber');
                              const code = bankForm.getValues('bankCode');

                              if (!accountNumber || !code) {
                                toast({
                                  title: _(msg`Missing details`),
                                  description: _(
                                    msg`Select a bank and enter the account number first.`,
                                  ),
                                  variant: 'destructive',
                                });
                                return;
                              }

                              await resolveBankAccount({
                                accountNumber,
                                bankCode: code,
                                currency: selectedBank?.currency,
                              });
                            }}
                          >
                            <Trans>Resolve</Trans>
                          </Button>
                        ) : null}
                      </div>
                      {!supportsAccountNameLookup && selectedBankCode ? (
                        <p className="text-xs text-muted-foreground">
                          <Trans>
                            South African banks do not support automatic name lookup. Enter the
                            account holder name exactly as it appears on the bank account.
                          </Trans>
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      <Trans>Verification details</Trans>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Trans>
                        Paystack requires these details to verify the bank account before payouts
                        can begin.
                      </Trans>
                    </p>
                  </div>

                  <FormField
                    control={bankForm.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Account type</Trans>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            bankForm.setValue(
                              'documentType',
                              getDefaultResellerBankDocumentType(
                                value as ResellerBankAccountType,
                              ),
                              { shouldValidate: true },
                            );
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="personal">
                              {getResellerBankAccountTypeLabel('personal')}
                            </SelectItem>
                            <SelectItem value="business">
                              {getResellerBankAccountTypeLabel('business')}
                            </SelectItem>
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
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {documentTypeOptions.map((documentType) => (
                              <SelectItem key={documentType} value={documentType}>
                                {getResellerBankDocumentTypeLabel(documentType)}
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
                                ? _(msg`Enter a new document number to replace ${bankDocumentNumber}`)
                                : _(msg`Enter ID / CNIC / passport / registration number`)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" loading={isUpdatingBank}>
                  <Trans>Save and verify bank details</Trans>
                </Button>
              </fieldset>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
};

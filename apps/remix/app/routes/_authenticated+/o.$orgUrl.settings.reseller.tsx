import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { redirect } from 'react-router';
import { z } from 'zod';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isDemoFeatureVisible } from '@documenso/lib/constants/demo-feature-flags';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { AppError } from '@documenso/lib/errors/app-error';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { buildResellerTransactionsCsv } from '@documenso/lib/utils/build-reseller-transactions-csv';
import {
  calculateResellerNetAmountInCents,
  formatCentsAsDecimal,
  resolveResellerVatAmountInCents,
} from '@documenso/lib/utils/reseller-vat';
import { trpc } from '@documenso/trpc/react';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import {
  ResellerAffiliatePageForm,
  type TResellerAffiliatePageFormSchema,
} from '~/components/forms/reseller-affiliate-page-form';
import { ResellerAffiliateSlugForm } from '~/components/forms/reseller-affiliate-slug-form';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { ComingSoonPlaceholder } from '~/components/general/coming-soon-placeholder';
import {
  ResellerOnboardingChecklist,
  type ResellerSetupSection,
} from '~/components/general/reseller-onboarding-checklist';
import { ResellerPayoutSettings } from '~/components/general/reseller-payout-settings';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.settings.reseller';

const ZResellerProfileFormSchema = z.object({
  paystackPublicKey: z.string().optional(),
  paystackSecretKey: z.string().optional(),
  vatNumber: z.string().optional(),
});

const RESELLER_TAB_TRIGGER_CLASS =
  'rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

export function meta() {
  return appMetaTags('Reseller Settings');
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user?.email || !isResellerFeatureAllowedEmail(user.email)) {
    throw redirect(`/o/${params.orgUrl}/settings/general`);
  }

  return null;
}

export default function OrganisationSettingsResellerPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const organisation = useCurrentOrganisation();
  const [activeTab, setActiveTab] = useState('branding');
  const [transactionQuery, setTransactionQuery] = useState('');
  const [transactionFromDate, setTransactionFromDate] = useState('');
  const [transactionToDate, setTransactionToDate] = useState('');
  const [transactionPage, setTransactionPage] = useState(1);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [transferringTransactionId, setTransferringTransactionId] = useState<string | null>(null);
  const [enabledPackages, setEnabledPackages] = useState<string[]>([]);

  const debouncedTransactionQuery = useDebouncedValue(transactionQuery, 400);

  const transactionFromDateValue = transactionFromDate
    ? new Date(`${transactionFromDate}T00:00:00`)
    : undefined;
  const transactionToDateValue = transactionToDate
    ? new Date(`${transactionToDate}T23:59:59`)
    : undefined;

  const isResellerFeatureAllowed = user.email
    ? isResellerFeatureAllowedEmail(user.email)
    : false;

  const { data: profile, isLoading, refetch } = trpc.organisation.reseller.getProfile.useQuery(
    {
      organisationId: organisation.id,
    },
    {
      enabled: isResellerFeatureAllowed,
    },
  );

  const { data: transactions, isLoading: isTransactionsLoading } =
    trpc.organisation.reseller.findTransactions.useQuery(
      {
        organisationId: organisation.id,
        query: debouncedTransactionQuery || undefined,
        fromDate: transactionFromDateValue,
        toDate: transactionToDateValue,
        page: transactionPage,
        perPage: 20,
      },
      {
        enabled: isResellerFeatureAllowed,
      },
    );

  const utils = trpc.useUtils();

  const form = useForm<z.infer<typeof ZResellerProfileFormSchema>>({
    resolver: zodResolver(ZResellerProfileFormSchema),
    values: {
      paystackPublicKey: profile?.paystackPublicKey ?? '',
      paystackSecretKey: '',
      vatNumber: profile?.vatNumber ?? '',
    },
  });

  const { mutateAsync: updateProfile, isPending: isUpdatingProfile } =
    trpc.organisation.reseller.updateProfile.useMutation({
      onSuccess: async () => {
        await utils.organisation.reseller.getProfile.invalidate({ organisationId: organisation.id });
        toast({ title: _(msg`Reseller settings updated`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Update failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: updatePackages, isPending: isUpdatingPackages } =
    trpc.organisation.reseller.updatePackages.useMutation({
      onSuccess: async () => {
        await refetch();
        toast({ title: _(msg`Packages updated`) });
      },
    });

  const { mutateAsync: completePendingTransaction } =
    trpc.organisation.reseller.completePendingTransaction.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.organisation.reseller.findTransactions.invalidate({
            organisationId: organisation.id,
          }),
          utils.organisation.reseller.getProfile.invalidate({ organisationId: organisation.id }),
        ]);
        toast({ title: _(msg`Credits transferred`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Transfer failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
      onSettled: () => {
        setTransferringTransactionId(null);
      },
    });

  const handleManualTransfer = async (transactionId: string) => {
    setTransferringTransactionId(transactionId);

    await completePendingTransaction({
      organisationId: organisation.id,
      transactionId,
    });
  };

  if (!isResellerFeatureAllowed) {
    return (
      <GenericErrorLayout
        errorCode={401}
        errorCodeMap={{
          401: {
            heading: msg`Unauthorized`,
            subHeading: msg`401 Unauthorized`,
            message: msg`The reseller program is not available for your account.`,
          },
        }}
        primaryButton={null}
        secondaryButton={null}
      />
    );
  }

  if (!isDemoFeatureVisible('RESELLER_USER_FACING')) {
    return (
      <div>
        <SettingsHeader
          title={_(msg`Reseller`)}
          subtitle={_(msg`Reseller programme settings.`)}
        />
        <ComingSoonPlaceholder className="mt-6" />
      </div>
    );
  }

  if (isLoading) {
    return null;
  }

  if (!profile) {
    return (
      <div>
        <SettingsHeader
          title={_(msg`Reseller`)}
          subtitle={_(msg`Reseller settings are available after your application is approved.`)}
        />
      </div>
    );
  }

  const currentEnabledPackages =
    enabledPackages.length > 0
      ? enabledPackages
      : profile.packages.filter((pkg) => pkg.isEnabled).map((pkg) => pkg.catalogPackageId);

  const downloadTransactionsCsv = async () => {
    setIsExportingCsv(true);

    try {
      const exportData = await utils.organisation.reseller.exportTransactions.fetch({
        organisationId: organisation.id,
        query: debouncedTransactionQuery || undefined,
        fromDate: transactionFromDateValue,
        toDate: transactionToDateValue,
      });

      const csv = buildResellerTransactionsCsv({
        resellerOrganisationName: exportData.resellerOrganisationName,
        resellerVatNumber: exportData.resellerVatNumber,
        resellerVatStatus: exportData.resellerVatStatus,
        rows: exportData.data,
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reseller-transactions.csv';
      link.click();
      URL.revokeObjectURL(url);

      if (exportData.truncated) {
        toast({
          title: _(msg`Export limited`),
          description: _(
            msg`Only the most recent 10,000 matching transactions were included in the export.`,
          ),
        });
      } else {
        toast({
          title: _(msg`Export complete`),
          description: `${exportData.count} ${_(msg`transaction records downloaded`)}`,
        });
      }
    } catch (error) {
      toast({
        title: _(msg`Export failed`),
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const clearTransactionFilters = () => {
    setTransactionQuery('');
    setTransactionFromDate('');
    setTransactionToDate('');
    setTransactionPage(1);
  };

  const hasEnabledPackage = profile.packages.some((pkg) => pkg.isEnabled);
  const smallestEnabledPackageCredits = profile.packages
    .filter((pkg) => pkg.isEnabled)
    .reduce<number | null>((min, pkg) => {
      if (min === null || pkg.creditAmount < min) {
        return pkg.creditAmount;
      }

      return min;
    }, null);

  const isCreditsDepleted = !profile.allowNegativeCredits && profile.availableCredits <= 0;
  const isCreditsLow =
    !profile.allowNegativeCredits &&
    profile.availableCredits > 0 &&
    smallestEnabledPackageCredits !== null &&
    profile.availableCredits < smallestEnabledPackageCredits;
  const isCreditsNegative = profile.availableCredits < 0;

  const hasCustomizedBranding =
    profile.affiliateSlug !== profile.organisation.url ||
    profile.brandingEnabled ||
    Boolean(profile.brandingLogo) ||
    Boolean(profile.brandingUrl) ||
    Boolean(profile.brandingCompanyDetails) ||
    Boolean(profile.brandingPrimaryColor) ||
    Boolean(profile.affiliatePageTitle) ||
    Boolean(profile.affiliateAboutText);

  const payoutStatusLabel =
    profile.payoutMode === 'OWN_PAYSTACK'
      ? profile.hasPaystackConfigured
        ? _(msg`Paystack connected`)
        : _(msg`Paystack not configured`)
      : profile.subaccountStatus === 'ACTIVE'
        ? _(msg`Bank verified`)
        : profile.subaccountStatus === 'PENDING'
          ? _(msg`Bank pending`)
          : _(msg`Bank not configured`);

  const handleGoToStep = (section: ResellerSetupSection) => {
    if (section === 'share') {
      return;
    }

    setActiveTab(section);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <SettingsHeader
        title={_(msg`Reseller`)}
        subtitle={_(msg`Manage payouts, your affiliate page, packages, and sales.`)}
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trans>How it works</Trans>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                <Trans>Reseller setup</Trans>
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                  <ol className="list-decimal space-y-3 pl-5">
                    <li>
                      <Trans>
                        Choose how you get paid — your own Paystack account, or bank details via
                        Nomia.
                      </Trans>
                    </li>
                    <li>
                      <Trans>
                        If using your own Paystack, register the Nomia webhook URL in Paystack
                        Dashboard → Settings → API Keys & Webhooks.
                      </Trans>
                    </li>
                    <li>
                      <Trans>Enable the credit packages you want to sell.</Trans>
                    </li>
                    <li>
                      <Trans>Customize your affiliate page, then share your link with clients.</Trans>
                    </li>
                  </ol>
                  {profile.payoutMode === 'OWN_PAYSTACK' &&
                  isDemoFeatureVisible('OWN_PAYSTACK_PAYOUT') ? (
                    <div className="rounded-md border bg-muted/40 p-3">
                      <p className="mb-2 font-medium text-foreground">
                        <Trans>Nomia webhook URL</Trans>
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all text-xs">{profile.paystackWebhookUrl}</code>
                        <CopyTextButton
                          value={profile.paystackWebhookUrl}
                          onCopySuccess={() => toast({ title: _(msg`Webhook URL copied`) })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </SettingsHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Trans>Credits</Trans>
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              isCreditsDepleted || isCreditsLow || isCreditsNegative
                ? 'text-amber-700'
                : 'text-foreground'
            }`}
          >
            {profile.availableCredits}
          </p>
          {profile.allowNegativeCredits ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>Negative balance allowed</Trans>
            </p>
          ) : isCreditsDepleted ? (
            <p className="mt-1 text-xs text-amber-700">
              <Trans>Stock depleted — top up to fulfill sales</Trans>
            </p>
          ) : isCreditsLow ? (
            <p className="mt-1 text-xs text-amber-700">
              <Trans>Stock low — top up before larger packs sell out</Trans>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>Keep a balance for sales</Trans>
            </p>
          )}
          {profile.negativeCreditsUsed > 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              <Trans>Used {profile.negativeCreditsUsed} negative</Trans>
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Trans>Payouts</Trans>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={profile.canAcceptAffiliatePayments ? 'default' : 'neutral'}>
              {payoutStatusLabel}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {profile.payoutMode === 'OWN_PAYSTACK' ? (
              <Trans>Own Paystack account</Trans>
            ) : (
              <Trans>Bank transfer via Nomia</Trans>
            )}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Trans>Affiliate link</Trans>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs">{profile.affiliateUrl}</code>
            <CopyTextButton
              value={profile.affiliateUrl}
              onCopySuccess={() => toast({ title: _(msg`Affiliate link copied`) })}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <Trans>Share this with clients</Trans>
          </p>
        </div>
      </div>

      {!profile.canAcceptAffiliatePayments && profile.payoutBlockingReason ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Affiliate sales blocked</Trans>
          </AlertTitle>
          <AlertDescription>{profile.payoutBlockingReason}</AlertDescription>
        </Alert>
      ) : null}

      {!profile.allowNegativeCredits && isCreditsNegative ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Credits needed</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              Your balance is negative and new affiliate purchases are blocked until you top up
              enough credits. Pending sales can be transferred once your balance is sufficient.
            </Trans>
          </AlertDescription>
        </Alert>
      ) : null}

      {!profile.allowNegativeCredits && isCreditsDepleted ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Stock depleted</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              You have 0 credits in stock. Client purchases will be fulfilled by Nomia until you
              top up.
            </Trans>
          </AlertDescription>
        </Alert>
      ) : null}

      {!profile.allowNegativeCredits && isCreditsLow ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>Stock running low</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              You have {profile.availableCredits} credits left. Larger client packs will be split
              with Nomia until you top up.
            </Trans>
          </AlertDescription>
        </Alert>
      ) : null}

      <ResellerOnboardingChecklist
        organisationId={organisation.id}
        affiliateUrl={profile.affiliateUrl}
        payoutMode={profile.payoutMode}
        hasPaystackConfigured={profile.hasPaystackConfigured}
        hasNomiaSubaccountConfigured={profile.subaccountStatus === 'ACTIVE'}
        hasEnabledPackage={hasEnabledPackage}
        hasCustomizedBranding={hasCustomizedBranding}
        onCopySuccess={() => toast({ title: _(msg`Affiliate link copied`) })}
        onGoToStep={handleGoToStep}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="branding" className={RESELLER_TAB_TRIGGER_CLASS}>
            <Trans>Affiliate page</Trans>
          </TabsTrigger>
          <TabsTrigger value="packages" className={RESELLER_TAB_TRIGGER_CLASS}>
            <Trans>Packages</Trans>
          </TabsTrigger>
          <TabsTrigger value="payouts" className={RESELLER_TAB_TRIGGER_CLASS}>
            <Trans>Payouts</Trans>
          </TabsTrigger>
          <TabsTrigger value="sales" className={RESELLER_TAB_TRIGGER_CLASS}>
            <Trans>Sales</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="space-y-6">
          <ResellerPayoutSettings
            organisationId={organisation.id}
            payoutMode={profile.payoutMode}
            bankCode={profile.bankCode}
            bankName={profile.bankName}
            bankAccountNumber={profile.bankAccountNumber}
            bankAccountName={profile.bankAccountName}
            bankAccountType={profile.bankAccountType}
            bankDocumentType={profile.bankDocumentType}
            bankDocumentNumber={profile.bankDocumentNumber}
            physicalAddress={profile.physicalAddress}
            contactPhone={profile.contactPhone}
            contactEmail={profile.contactEmail}
            vatStatus={profile.vatStatus}
            vatNumber={profile.vatNumber}
            subaccountStatus={profile.subaccountStatus}
            subaccountFailureReason={profile.subaccountFailureReason}
            canAcceptAffiliatePayments={profile.canAcceptAffiliatePayments}
            payoutBlockingReason={null}
            onUpdated={async () => {
              await utils.organisation.reseller.getProfile.invalidate({
                organisationId: organisation.id,
              });
            }}
          />

          {profile.payoutMode === 'OWN_PAYSTACK' && isDemoFeatureVisible('OWN_PAYSTACK_PAYOUT') ? (
            <Form {...form}>
              <form
                className="space-y-4"
                autoComplete="off"
                onSubmit={form.handleSubmit(async (values) => {
                  await updateProfile({
                    organisationId: organisation.id,
                    data: values,
                  });
                })}
              >
                <fieldset disabled={isUpdatingProfile} className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">
                      <Trans>Paystack keys</Trans>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      <Trans>
                        Affiliate purchases charge your Paystack account. Register the webhook
                        below so credits transfer after payment.
                      </Trans>
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      <Trans>Webhook URL → Paystack Dashboard → Settings → Webhooks</Trans>
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all text-xs">{profile.paystackWebhookUrl}</code>
                      <CopyTextButton
                        value={profile.paystackWebhookUrl}
                        onCopySuccess={() => toast({ title: _(msg`Webhook URL copied`) })}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="paystackPublicKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Paystack public key</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            data-1p-ignore
                            data-lpignore="true"
                            data-form-type="other"
                            inputMode="text"
                            placeholder="pk_live_..."
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paystackSecretKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Paystack secret key</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            data-1p-ignore
                            data-lpignore="true"
                            data-form-type="other"
                            inputMode="text"
                            placeholder="sk_live_..."
                            className="font-mono"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          <Trans>Leave blank to keep your existing secret key.</Trans>
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>VAT number (optional)</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="4123456789" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          <Trans>
                            If provided, 15% VAT is calculated on affiliate sales for invoices and
                            exports.
                          </Trans>
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" loading={isUpdatingProfile}>
                    <Trans>Save Paystack settings</Trans>
                  </Button>
                </fieldset>
              </form>
            </Form>
          ) : null}
        </TabsContent>

        <TabsContent value="branding" className="space-y-8">
          <ResellerAffiliateSlugForm
            organisationId={organisation.id}
            affiliateSlug={profile.affiliateSlug}
            suggestedSlug={profile.organisation.url}
          />

          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                <Trans>Branding</Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>Logo, website, and company details shown on your affiliate page.</Trans>
              </p>
            </div>

            <BrandingPreferencesForm
              context="Reseller"
              affiliateSlug={profile.affiliateSlug}
              settings={{
                brandingEnabled: profile.brandingEnabled,
                brandingLogo: profile.brandingLogo,
                brandingUrl: profile.brandingUrl,
                brandingCompanyDetails: profile.brandingCompanyDetails,
              }}
              onFormSubmit={async (data: TBrandingPreferencesFormSchema) => {
                const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

                let uploadedBrandingLogo: string | null | undefined = profile.brandingLogo;

                if (brandingLogo) {
                  uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
                }

                if (brandingLogo === null) {
                  uploadedBrandingLogo = null;
                }

                await updateProfile({
                  organisationId: organisation.id,
                  data: {
                    brandingEnabled: brandingEnabled ?? false,
                    brandingLogo: uploadedBrandingLogo,
                    brandingUrl: brandingUrl || null,
                    brandingCompanyDetails: brandingCompanyDetails || null,
                  },
                });
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                <Trans>Page content</Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>Headline, colors, about section, and featured package.</Trans>
              </p>
            </div>

            <ResellerAffiliatePageForm
              profile={profile}
              onFormSubmit={async (data: TResellerAffiliatePageFormSchema) => {
                await updateProfile({
                  organisationId: organisation.id,
                  data: {
                    affiliatePageTitle: data.affiliatePageTitle || null,
                    affiliatePageDescription: data.affiliatePageDescription || null,
                    brandingPrimaryColor: data.brandingPrimaryColor || null,
                    affiliateAboutText: data.affiliateAboutText || null,
                    affiliateSupportEmail: data.affiliateSupportEmail || null,
                    highlightedCatalogPackageId: data.highlightedCatalogPackageId || null,
                  },
                });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">
              <Trans>Package sizes</Trans>
            </h2>
            <p className="text-sm text-muted-foreground">
              <Trans>
                Select which Nomia package sizes you want to offer. Prices are fixed by Nomia.
              </Trans>
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {profile.packages.map((pkg) => {
              const catalog = profile.catalogPackages.find(
                (item) => item.id === pkg.catalogPackageId,
              );
              const isChecked = currentEnabledPackages.includes(pkg.catalogPackageId);

              return (
                <label
                  key={pkg.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    isChecked ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      setEnabledPackages((current) => {
                        const base =
                          current.length > 0
                            ? current
                            : profile.packages
                                .filter((item) => item.isEnabled)
                                .map((item) => item.catalogPackageId);

                        if (checked) {
                          return [...new Set([...base, pkg.catalogPackageId])];
                        }

                        return base.filter((id) => id !== pkg.catalogPackageId);
                      });
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {catalog?.name ?? `${pkg.creditAmount} envelopes`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {catalog?.displayPrice ??
                        `${pkg.currency} ${(pkg.priceInCents / 100).toFixed(2)}`}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <Button
            loading={isUpdatingPackages}
            onClick={async () => {
              await updatePackages({
                organisationId: organisation.id,
                enabledCatalogPackageIds: currentEnabledPackages,
              });
            }}
          >
            <Trans>Save packages</Trans>
          </Button>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                <Trans>Sales records</Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Filter and export purchaser details, amounts, VAT, and Paystack references.
                </Trans>
              </p>
            </div>
            <Button variant="outline" loading={isExportingCsv} onClick={downloadTransactionsCsv}>
              <Trans>Download CSV</Trans>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder={_(msg`Filter by client name`)}
              value={transactionQuery}
              onChange={(event) => {
                setTransactionQuery(event.target.value);
                setTransactionPage(1);
              }}
            />
            <Input
              type="date"
              value={transactionFromDate}
              onChange={(event) => {
                setTransactionFromDate(event.target.value);
                setTransactionPage(1);
              }}
              aria-label={_(msg`From date`)}
            />
            <Input
              type="date"
              value={transactionToDate}
              onChange={(event) => {
                setTransactionToDate(event.target.value);
                setTransactionPage(1);
              }}
              aria-label={_(msg`To date`)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={clearTransactionFilters}>
              <Trans>Clear filters</Trans>
            </Button>
            {transactions && (
              <p className="text-sm text-muted-foreground">
                <Trans>{transactions.count} matching transactions</Trans>
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Trans>Date</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Client</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Credits</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Gross</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>VAT</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Net</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Status</Trans>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTransactionsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      <Trans>Loading transactions...</Trans>
                    </TableCell>
                  </TableRow>
                )}

                {!isTransactionsLoading && (transactions?.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      <Trans>No transactions found for the selected filters.</Trans>
                    </TableCell>
                  </TableRow>
                )}

                {(transactions?.data ?? []).map((transaction) => {
                  const vatAmount = resolveResellerVatAmountInCents(
                    transaction.grossAmount,
                    transaction.vatAmount,
                    transaction.sellerVatNumber ?? profile.vatNumber,
                    transaction.sellerVatStatus ?? profile.vatStatus,
                  );
                  const netAmount = calculateResellerNetAmountInCents(
                    transaction.grossAmount,
                    vatAmount,
                  );

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(
                          transaction.completedAt ?? transaction.createdAt,
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{transaction.purchaserName}</p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.purchaserEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.credits}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatCentsAsDecimal(transaction.grossAmount)} {transaction.currency}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatCentsAsDecimal(vatAmount)} {transaction.currency}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatCentsAsDecimal(netAmount)} {transaction.currency}
                      </TableCell>
                      <TableCell>
                        {transaction.status === 'PENDING' ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="neutral">
                                <Trans>Pending</Trans>
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={transferringTransactionId === transaction.id}
                                disabled={
                                  !transaction.canManualTransfer ||
                                  (transferringTransactionId !== null &&
                                    transferringTransactionId !== transaction.id)
                                }
                                onClick={() => handleManualTransfer(transaction.id)}
                              >
                                <Trans>Transfer</Trans>
                              </Button>
                            </div>
                            {!transaction.canManualTransfer ? (
                              <p className="text-xs text-muted-foreground">
                                <Trans>
                                  Top up at least {transaction.credits - profile.availableCredits}{' '}
                                  more credits to transfer.
                                </Trans>
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <Badge variant="default">{transaction.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {transactions && transactions.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Page {transactions.currentPage} of {transactions.totalPages}
                </Trans>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactionPage <= 1}
                  onClick={() => setTransactionPage((page) => Math.max(page - 1, 1))}
                >
                  <Trans>Previous</Trans>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactionPage >= transactions.totalPages}
                  onClick={() =>
                    setTransactionPage((page) => Math.min(page + 1, transactions.totalPages))
                  }
                >
                  <Trans>Next</Trans>
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { AppError } from '@documenso/lib/errors/app-error';
import { buildResellerTransactionsCsv } from '@documenso/lib/utils/build-reseller-transactions-csv';
import {
  calculateResellerNetAmountInCents,
  formatCentsAsDecimal,
  resolveResellerVatAmountInCents,
} from '@documenso/lib/utils/reseller-vat';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.settings.reseller';

const ZResellerProfileFormSchema = z.object({
  paystackPublicKey: z.string().optional(),
  paystackSecretKey: z.string().optional(),
  vatNumber: z.string().optional(),
});

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
  const [transactionQuery, setTransactionQuery] = useState('');
  const [transactionFromDate, setTransactionFromDate] = useState('');
  const [transactionToDate, setTransactionToDate] = useState('');
  const [transactionPage, setTransactionPage] = useState(1);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
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

  return (
    <div className="max-w-4xl space-y-8">
      <SettingsHeader
        title={_(msg`Reseller`)}
        subtitle={_(msg`Manage your affiliate link, Paystack settings, packages, and sales records.`)}
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Trans>Instructions</Trans>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                <Trans>Reseller setup instructions</Trans>
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                  <ol className="list-decimal space-y-3 pl-5">
                    <li>
                      <Trans>
                        Add your Paystack public and secret keys below so affiliate purchases use
                        your Paystack account.
                      </Trans>
                    </li>
                    <li>
                      <Trans>
                        In your Paystack Dashboard, go to Settings → API Keys & Webhooks and set the
                        webhook URL to the Nomia URL shown on this page.
                      </Trans>
                    </li>
                    <li>
                      <Trans>Share your affiliate link with clients.</Trans>
                    </li>
                    <li>
                      <Trans>
                        Enable the credit packages you want to sell and keep enough credits in your
                        account for purchases to complete.
                      </Trans>
                    </li>
                  </ol>
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
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </SettingsHeader>

      <Alert variant="neutral">
        <AlertTitle>
          <Trans>Affiliate link</Trans>
        </AlertTitle>
        <AlertDescription className="mt-2 flex items-center gap-2">
          <span className="break-all">{profile.affiliateUrl}</span>
          <CopyTextButton
            value={profile.affiliateUrl}
            onCopySuccess={() => toast({ title: _(msg`Link copied`) })}
          />
        </AlertDescription>
      </Alert>

      <Alert variant="warning">
        <AlertTitle>
          <Trans>Credits warning</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>
            Ensure there are always credits in your account. Clients will not be able to purchase if
            no credits are available unless negative credits have been enabled for your account by
            Nomia.
          </Trans>
          <p className="mt-2 font-medium">
            <Trans>Available credits: {profile.availableCredits}</Trans>
          </p>
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await updateProfile({
              organisationId: organisation.id,
              data: values,
            });
          })}
        >
          <fieldset disabled={isUpdatingProfile} className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                <Trans>Paystack settings</Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Affiliate purchases are charged to your Paystack account. Register the Nomia
                  webhook URL in your Paystack dashboard so completed payments can transfer credits
                  to your clients.
                </Trans>
              </p>
            </div>

            <Alert variant="neutral">
              <AlertTitle>
                <Trans>Register this webhook in Paystack</Trans>
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="text-sm">
                  <Trans>
                    Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL
                  </Trans>
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all text-xs">{profile.paystackWebhookUrl}</code>
                  <CopyTextButton
                    value={profile.paystackWebhookUrl}
                    onCopySuccess={() => toast({ title: _(msg`Webhook URL copied`) })}
                  />
                </div>
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="paystackPublicKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Paystack public key</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input type="password" {...field} />
                  </FormControl>
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
                      If provided, 15% VAT is calculated on affiliate sales for invoices and exports.
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

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          <Trans>Package sizes</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans>Select which Nomia package sizes you want to offer. Prices are fixed by Nomia.</Trans>
        </p>

        <div className="space-y-2">
          {profile.packages.map((pkg) => {
            const catalog = profile.catalogPackages.find((item) => item.id === pkg.catalogPackageId);
            const isChecked = currentEnabledPackages.includes(pkg.catalogPackageId);

            return (
              <label key={pkg.id} className="flex items-center gap-3 rounded-md border p-3">
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
                <div>
                  <p className="font-medium">{catalog?.name ?? `${pkg.creditAmount} envelopes`}</p>
                  <p className="text-sm text-muted-foreground">
                    {catalog?.displayPrice ?? `${pkg.currency} ${(pkg.priceInCents / 100).toFixed(2)}`}
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
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            <Trans>Transaction records</Trans>
          </h2>
          <Button variant="outline" loading={isExportingCsv} onClick={downloadTransactionsCsv}>
            <Trans>Download CSV</Trans>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          <Trans>
            Export includes purchaser details, credits, gross amount, VAT, net amount, and Paystack
            reference for invoicing.
          </Trans>
        </p>

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
                profile.vatNumber,
              );
              const netAmount = calculateResellerNetAmountInCents(
                transaction.grossAmount,
                vatAmount,
              );

              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {new Date(transaction.completedAt ?? transaction.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{transaction.purchaserName}</p>
                      <p className="text-xs text-muted-foreground">{transaction.purchaserEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.purchaserOrganisationName}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{transaction.credits}</TableCell>
                  <TableCell>
                    {formatCentsAsDecimal(transaction.grossAmount)} {transaction.currency}
                  </TableCell>
                  <TableCell>
                    {formatCentsAsDecimal(vatAmount)} {transaction.currency}
                  </TableCell>
                  <TableCell>
                    {formatCentsAsDecimal(netAmount)} {transaction.currency}
                  </TableCell>
                  <TableCell>{transaction.status}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

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
      </div>
    </div>
  );
}

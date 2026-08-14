import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  DEFAULT_PURCHASE_HISTORY_PER_PAGE,
  type OrganisationPurchaseHistoryItem,
} from '@documenso/lib/types/organisation-purchase-history';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

type OrganisationPurchaseHistoryDialogProps = {
  orgUrl: string;
  organisationId: string;
  /** When true, show the View History link but open a Coming soon dialog instead. */
  isComingSoon?: boolean;
  getSubscriptionPlanDetails?: (planCode: string) => {
    label?: string;
    amount?: string;
    credits?: number | string;
  } | null;
};

const formatHistorySource = (item: OrganisationPurchaseHistoryItem) => {
  if (item.issuer === 'RESELLER' || item.kind === 'reseller') {
    return <Trans>Reseller</Trans>;
  }

  if (item.kind === 'bulk') {
    return <Trans>Bulk</Trans>;
  }

  return <Trans>Nomia</Trans>;
};

const formatHistoryDescription = (
  item: OrganisationPurchaseHistoryItem,
  getSubscriptionPlanDetails?: OrganisationPurchaseHistoryDialogProps['getSubscriptionPlanDetails'],
) => {
  if (item.kind === 'subscription') {
    const planDetails = getSubscriptionPlanDetails?.(item.lineItems[0]?.reference ?? item.title);

    if (planDetails?.label) {
      return `${planDetails.label}${planDetails.credits ? ` — ${planDetails.credits} envelopes` : ''}`;
    }

    return item.title;
  }

  return item.title;
};

const formatHistoryAmount = (
  item: OrganisationPurchaseHistoryItem,
  getSubscriptionPlanDetails?: OrganisationPurchaseHistoryDialogProps['getSubscriptionPlanDetails'],
) => {
  if (item.kind === 'subscription') {
    if (item.totalGrossAmount > 0) {
      return `${item.currency} ${(item.totalGrossAmount / 100).toFixed(2)}`;
    }

    return getSubscriptionPlanDetails?.(item.lineItems[0]?.reference ?? item.title)?.amount ?? '—';
  }

  return `${item.currency} ${(item.totalGrossAmount / 100).toFixed(2)}`;
};

const formatHistoryCredits = (
  item: OrganisationPurchaseHistoryItem,
  getSubscriptionPlanDetails?: OrganisationPurchaseHistoryDialogProps['getSubscriptionPlanDetails'],
) => {
  if (item.kind === 'subscription') {
    if (item.totalCredits > 0) {
      return item.totalCredits;
    }

    return getSubscriptionPlanDetails?.(item.lineItems[0]?.reference ?? item.title)?.credits ?? '—';
  }

  return item.totalCredits;
};

export const OrganisationPurchaseHistoryDialog = ({
  orgUrl,
  organisationId,
  isComingSoon = false,
  getSubscriptionPlanDetails,
}: OrganisationPurchaseHistoryDialogProps) => {
  const { _ } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = trpc.organisation.getPurchaseHistory.useQuery(
    {
      organisationId,
      page,
      perPage: DEFAULT_PURCHASE_HISTORY_PER_PAGE,
    },
    {
      enabled: isOpen && !isComingSoon && Boolean(organisationId),
    },
  );

  const purchaseHistory = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.currentPage ?? page;
  const count = data?.count ?? 0;

  if (isComingSoon) {
    return (
      <Dialog>
        <DialogTrigger asChild className="flex w-full items-end justify-end">
          <button className="text-md cursor-pointer pb-6 text-blue-500 underline">
            <Trans>View History</Trans>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <Trans>Coming soon</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>Purchase history is not available for your account yet.</Trans>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);

        if (!open) {
          setPage(1);
        }
      }}
    >
      <DialogTrigger asChild className="flex w-full items-end justify-end">
        <button className="text-md cursor-pointer pb-6 text-blue-500 underline">
          <Trans>View History</Trans>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-5 text-left sm:px-8">
          <DialogTitle className="text-primary text-2xl font-bold sm:text-3xl">
            <Trans>Purchase History</Trans>
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            <Trans>Review your purchases and download invoices for your records.</Trans>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto p-6 sm:p-8">
          <div className="min-w-[900px] overflow-hidden rounded-xl border shadow-sm">
            <Table className="w-full">
              <TableHeader className="bg-primary/10 sticky top-0 z-10 backdrop-blur">
                <TableRow>
                  <TableHead className="text-primary w-36 whitespace-nowrap font-semibold">
                    <Trans>Date</Trans>
                  </TableHead>
                  <TableHead className="text-primary w-40 font-semibold">
                    <Trans>Source</Trans>
                  </TableHead>
                  <TableHead className="text-primary min-w-64 font-semibold">
                    <Trans>Description</Trans>
                  </TableHead>
                  <TableHead className="text-primary w-36 whitespace-nowrap font-semibold">
                    <Trans>Amount</Trans>
                  </TableHead>
                  <TableHead className="text-primary w-28 font-semibold">
                    <Trans>Credits</Trans>
                  </TableHead>
                  <TableHead className="text-primary w-32 font-semibold">
                    <Trans>Status</Trans>
                  </TableHead>
                  <TableHead className="text-primary w-36 text-right font-semibold">
                    <Trans>Invoice</Trans>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <Trans>Loading purchase history…</Trans>
                    </TableCell>
                  </TableRow>
                ) : purchaseHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <Trans>No purchases found yet.</Trans>
                    </TableCell>
                  </TableRow>
                ) : (
                  purchaseHistory.map((item) => (
                    <TableRow key={item.invoiceId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="whitespace-nowrap font-medium">
                        {new Date(item.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="bg-primary/10 text-primary inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
                          {formatHistorySource(item)}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-64">
                        {formatHistoryDescription(item, getSubscriptionPlanDetails)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatHistoryAmount(item, getSubscriptionPlanDetails)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatHistoryCredits(item, getSubscriptionPlanDetails)}
                      </TableCell>
                      <TableCell>
                        <span className="bg-muted inline-flex rounded-full px-2.5 py-1 text-xs font-medium">
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.invoiceNumber ?? '—'}
                          </span>
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              to={`/o/${orgUrl}/purchase-invoice/${encodeURIComponent(item.invoiceId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <DownloadIcon className="mr-2 h-4 w-4" />
                              <Trans>Download</Trans>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {count > 0 ? (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                {_(msg`Page ${currentPage} of ${totalPages}`)}
                {isFetching && !isLoading ? ' · …' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || isFetching}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <Trans>Previous</Trans>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || isFetching}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <Trans>Next</Trans>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';
import { Link } from 'react-router';

import type { OrganisationPurchaseHistoryItem } from '@documenso/lib/server-only/billing/get-organisation-purchase-history';
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
  purchaseHistory: OrganisationPurchaseHistoryItem[];
  getSubscriptionPlanDetails?: (planCode: string) => {
    label?: string;
    amount?: string;
    credits?: number | string;
  } | null;
};

const formatHistorySource = (item: OrganisationPurchaseHistoryItem) => {
  if (item.kind === 'hybrid') {
    return <Trans>Reseller + Nomia</Trans>;
  }

  if (item.kind === 'reseller') {
    return <Trans>Reseller</Trans>;
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

  if (item.kind === 'hybrid') {
    return item.lineItems
      .map((line) => `${line.credits} credits (${line.provider === 'reseller' ? 'Reseller' : 'Nomia'})`)
      .join(' + ');
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
  purchaseHistory,
  getSubscriptionPlanDetails,
}: OrganisationPurchaseHistoryDialogProps) => {
  return (
    <Dialog>
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
              {purchaseHistory.length === 0 ? (
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

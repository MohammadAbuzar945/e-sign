import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';
import { Link } from 'react-router';

import type { OrganisationPurchaseHistoryItem } from '@documenso/lib/server-only/billing/get-organisation-purchase-history';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
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
    const planDetails = getSubscriptionPlanDetails?.(item.title);

    return planDetails?.label ?? item.title;
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
    return getSubscriptionPlanDetails?.(item.title)?.amount ?? '—';
  }

  return `${item.currency} ${(item.totalGrossAmount / 100).toFixed(2)}`;
};

const formatHistoryCredits = (
  item: OrganisationPurchaseHistoryItem,
  getSubscriptionPlanDetails?: OrganisationPurchaseHistoryDialogProps['getSubscriptionPlanDetails'],
) => {
  if (item.kind === 'subscription') {
    return getSubscriptionPlanDetails?.(item.title)?.credits ?? '—';
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
      <DialogContent className="w-full max-w-6xl p-6">
        <DialogHeader>
          <DialogTitle className="text-primary text-2xl font-bold">
            <Trans>Purchase History</Trans>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-6 overflow-x-auto">
          <Table className="border-primary/30 w-full rounded-lg border shadow-md">
            <TableHeader className="bg-primary/10">
              <TableRow>
                <TableHead className="text-primary font-semibold">
                  <Trans>Date</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
                  <Trans>Source</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
                  <Trans>Description</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
                  <Trans>Amount</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
                  <Trans>Credits</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
                  <Trans>Status</Trans>
                </TableHead>
                <TableHead className="text-primary font-semibold">
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
                  <TableRow key={item.invoiceId} className="hover:bg-muted/50 transition">
                    <TableCell>
                      {new Date(item.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{formatHistorySource(item)}</TableCell>
                    <TableCell className="max-w-xs">
                      {formatHistoryDescription(item, getSubscriptionPlanDetails)}
                    </TableCell>
                    <TableCell>{formatHistoryAmount(item, getSubscriptionPlanDetails)}</TableCell>
                    <TableCell>{formatHistoryCredits(item, getSubscriptionPlanDetails)}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
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
      </DialogContent>
    </Dialog>
  );
};

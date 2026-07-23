import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link, useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import type { TFindResellerBulkPurchasesResponse } from '@documenso/trpc/server/admin-router/reseller-bulk-rates.types';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

type BulkPurchaseStatus = TFindResellerBulkPurchasesResponse['data'][number]['status'];

const formatZarFromCents = (cents: number, currency = 'ZAR') =>
  `${currency} ${(cents / 100).toFixed(2)}`;

const parseBulkPurchaseStatus = (value: string | null): BulkPurchaseStatus | undefined => {
  if (value === 'PENDING' || value === 'COMPLETED' || value === 'FAILED') {
    return value;
  }

  return undefined;
};

const statusBadgeVariant = (status: BulkPurchaseStatus) => {
  if (status === 'COMPLETED') {
    return 'default' as const;
  }

  if (status === 'FAILED') {
    return 'destructive' as const;
  }

  return 'neutral' as const;
};

export const AdminResellerBulkPurchasesTable = () => {
  const { _, i18n } = useLingui();
  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const baseParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));
  const status = parseBulkPurchaseStatus(searchParams.get('status'));

  const { data, isLoading, isLoadingError } = trpc.admin.resellerBulkRates.findPurchases.useQuery({
    query: baseParams.query,
    page: baseParams.page,
    perPage: baseParams.perPage,
    status,
  });

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
    count: 0,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Date`),
        accessorKey: 'createdAt',
        cell: ({ row }) => {
          const date = row.original.completedAt ?? row.original.createdAt;

          return (
            <p className="whitespace-nowrap text-sm">
              {i18n.date(date, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          );
        },
      },
      {
        header: _(msg`Organisation`),
        accessorKey: 'organisation',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/admin/organisations/${row.original.organisation.id}`}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {row.original.organisation.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              /o/{row.original.organisation.url}
            </p>
          </div>
        ),
      },
      {
        header: _(msg`Purchaser`),
        accessorKey: 'user',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.user.name || row.original.user.email}
            </p>
            {row.original.user.name ? (
              <p className="truncate text-xs text-muted-foreground">{row.original.user.email}</p>
            ) : null}
          </div>
        ),
      },
      {
        header: _(msg`Credits`),
        accessorKey: 'credits',
        cell: ({ row }) => (
          <p className="tabular-nums text-sm">{row.original.credits.toLocaleString()}</p>
        ),
      },
      {
        header: _(msg`Amount`),
        accessorKey: 'grossAmount',
        cell: ({ row }) => (
          <p className="whitespace-nowrap tabular-nums text-sm">
            {formatZarFromCents(row.original.grossAmount, row.original.currency)}
          </p>
        ),
      },
      {
        header: _(msg`Rate / credit`),
        accessorKey: 'pricePerCreditCents',
        cell: ({ row }) => (
          <p className="whitespace-nowrap tabular-nums text-sm">
            {formatZarFromCents(row.original.pricePerCreditCents, row.original.currency)}
          </p>
        ),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
        ),
      },
      {
        header: _(msg`Paystack ref`),
        accessorKey: 'paystackReference',
        cell: ({ row }) => (
          <p className="max-w-[140px] truncate font-mono text-xs text-muted-foreground">
            {row.original.paystackReference}
          </p>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [_, i18n]);

  return (
    <div className="relative">
      {isLoadingError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>
            <Trans>Unable to load bulk purchases</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>Something went wrong while loading reseller bulk purchase history.</Trans>
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading,
          rows: 8,
          component: (
            <>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>
    </div>
  );
};

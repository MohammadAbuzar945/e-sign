import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans, useLingui as useLinguiMacro } from '@lingui/react/macro';
import {
  PAYSTACK_WEBHOOK_EVENT_STATUS,
  type PaystackWebhookEventStatus,
  ZPaystackWebhookEventStatusSchema,
} from '@documenso/lib/constants/paystack-webhook-event-status';
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDashedIcon,
  SkipForwardIcon,
  XCircleIcon,
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { z } from 'zod';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import type { TFindPaystackWebhookEventsResponse } from '@documenso/trpc/server/admin-router/find-paystack-webhook-events.types';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { cn } from '@documenso/ui/lib/utils';

import { AdminPaystackWebhookEventSheet } from '~/components/general/admin-paystack-webhook-event-sheet';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

const PAYSTACK_WEBHOOK_STATUS_TABS = [
  { value: '', label: msg`All` },
  { value: PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS, label: msg`Success` },
  { value: PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED, label: msg`Failed` },
  { value: PAYSTACK_WEBHOOK_EVENT_STATUS.IGNORED, label: msg`Ignored` },
  { value: PAYSTACK_WEBHOOK_EVENT_STATUS.PENDING, label: msg`Pending` },
] as const;

const PAYSTACK_EVENT_TYPES = [
  'charge.success',
  'subscription.create',
  'subscription.disable',
  'subscription.not_renew',
  'invoice.update',
  'invoice.payment_failed',
] as const;

const PaystackWebhookSearchParamsSchema = ZUrlSearchParamsSchema.extend({
  status: ZPaystackWebhookEventStatusSchema.optional(),
  event: z.string().optional(),
});

export function meta() {
  return appMetaTags('Paystack Webhooks');
}

const statusBadgeVariant = (status: PaystackWebhookEventStatus) => {
  switch (status) {
    case PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS:
      return 'default' as const;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED:
      return 'destructive' as const;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.IGNORED:
      return 'secondary' as const;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.PENDING:
    default:
      return 'neutral' as const;
  }
};

const StatusIcon = ({ status }: { status: PaystackWebhookEventStatus }) => {
  switch (status) {
    case PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS:
      return <CheckCircle2Icon className="mr-2 h-4 w-4" />;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED:
      return <XCircleIcon className="mr-2 h-4 w-4" />;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.IGNORED:
      return <SkipForwardIcon className="mr-2 h-4 w-4" />;
    case PAYSTACK_WEBHOOK_EVENT_STATUS.PENDING:
    default:
      return <CircleDashedIcon className="mr-2 h-4 w-4" />;
  }
};

export default function AdminPaystackWebhooksPage() {
  const { _ } = useLingui();
  const { t, i18n } = useLinguiMacro();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('query') ?? '');
  const [selectedEvent, setSelectedEvent] = useState<
    TFindPaystackWebhookEventsResponse['data'][number] | null
  >(null);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const parsedSearchParams = PaystackWebhookSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isLoadingError } = trpc.admin.paystackWebhooks.find.useQuery({
    query: parsedSearchParams.query,
    page: parsedSearchParams.page,
    perPage: parsedSearchParams.perPage,
    status: parsedSearchParams.status,
    event: parsedSearchParams.event,
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (debouncedSearchQuery) {
      params.set('query', debouncedSearchQuery);
    } else {
      params.delete('query');
    }

    if (params.toString() === searchParams.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, searchParams, setSearchParams]);

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
  };

  const getStatusHref = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set('status', value);
    } else {
      params.delete('status');
    }

    params.delete('page');

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  };

  const onEventFilterChange = (value: string) => {
    updateSearchParams({
      event: value === 'all' ? null : value,
      page: 1,
    });
  };

  const onStatusFilterChange = (value: string) => {
    updateSearchParams({
      status: value === 'all' ? null : value,
      page: 1,
    });
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Status`,
        accessorKey: 'status',
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            <StatusIcon status={row.original.status} />
            {row.original.status}
          </Badge>
        ),
      },
      {
        header: t`Event`,
        accessorKey: 'event',
        cell: ({ row }) => (
          <div>
            <p className="text-foreground font-mono text-sm font-semibold">{row.original.event}</p>
            <p className="text-muted-foreground text-xs">{row.original.id}</p>
          </div>
        ),
      },
      {
        header: t`Reference`,
        accessorKey: 'reference',
        cell: ({ row }) => (
          <p className="text-muted-foreground font-mono text-xs">
            {row.original.reference ?? '—'}
          </p>
        ),
      },
      {
        header: t`Customer`,
        accessorKey: 'customerEmail',
        cell: ({ row }) => (
          <p className="text-muted-foreground text-sm">{row.original.customerEmail ?? '—'}</p>
        ),
      },
      {
        header: t`Received`,
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <div className="flex items-center justify-between gap-2">
            <p>
              {i18n.date(row.original.createdAt, {
                timeStyle: 'short',
                dateStyle: 'short',
              })}
            </p>
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronRightIcon className="h-4 w-4" />
            </div>
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [i18n, t]);

  return (
    <div>
      <SettingsHeader
        title={_(msg`Paystack Webhooks`)}
        subtitle={_(msg`Inbound Paystack webhook payloads and processing results.`)}
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="md:hidden">
          <Select
            value={parsedSearchParams.status ?? 'all'}
            onValueChange={onStatusFilterChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t`Status`} />
            </SelectTrigger>
            <SelectContent>
              {PAYSTACK_WEBHOOK_STATUS_TABS.map((tab) => (
                <SelectItem key={tab.value || 'all'} value={tab.value || 'all'}>
                  {_(tab.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <nav
            aria-label={_(msg`Webhook status filters`)}
            className="bg-muted text-muted-foreground inline-flex h-10 flex-wrap items-center justify-center rounded-md p-1"
          >
            {PAYSTACK_WEBHOOK_STATUS_TABS.map((tab) => {
              const isActive = (parsedSearchParams.status ?? '') === tab.value;

              return (
                <Link
                  key={tab.value || 'all'}
                  to={getStatusHref(tab.value)}
                  preventScrollReset
                  className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'hover:text-foreground',
                  )}
                >
                  {_(tab.label)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            value={parsedSearchParams.event ?? 'all'}
            onValueChange={onEventFilterChange}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t`Event type`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <Trans>All event types</Trans>
              </SelectItem>
              {PAYSTACK_EVENT_TYPES.map((eventType) => (
                <SelectItem key={eventType} value={eventType}>
                  {eventType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-full sm:max-w-sm">
            <Input
              type="search"
              placeholder={t`Search by id, email, reference…`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="space-y-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`webhook-skeleton-${index}`} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : isLoadingError ? (
            <p className="text-destructive text-sm">
              <Trans>Could not load webhook events.</Trans>
            </p>
          ) : results.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              <Trans>No webhook events found.</Trans>
            </p>
          ) : (
            results.data.map((event) => (
              <button
                key={event.id}
                type="button"
                className="hover:bg-muted/50 w-full rounded-lg border p-4 text-left transition-colors"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={statusBadgeVariant(event.status)} className="shrink-0">
                    <StatusIcon status={event.status} />
                    {event.status}
                  </Badge>
                  <ChevronRightIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                </div>
                <p className="text-foreground mt-2 font-mono text-sm font-semibold">{event.event}</p>
                <p className="text-muted-foreground mt-1 truncate font-mono text-xs">{event.id}</p>
                {event.reference ? (
                  <p className="text-muted-foreground mt-2 truncate font-mono text-xs">
                    {event.reference}
                  </p>
                ) : null}
                {event.customerEmail ? (
                  <p className="text-muted-foreground mt-1 truncate text-sm">
                    {event.customerEmail}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-2 text-xs">
                  {i18n.date(event.createdAt, {
                    timeStyle: 'short',
                    dateStyle: 'short',
                  })}
                </p>
              </button>
            ))
          )}

          {results.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={results.currentPage <= 1}
                onClick={() => onPaginationChange(results.currentPage - 1, results.perPage)}
              >
                <Trans>Previous</Trans>
              </Button>
              <p className="text-muted-foreground text-xs">
                <Trans>
                  Page {results.currentPage} of {results.totalPages}
                </Trans>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={results.currentPage >= results.totalPages}
                onClick={() => onPaginationChange(results.currentPage + 1, results.perPage)}
              >
                <Trans>Next</Trans>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={results.data}
          perPage={results.perPage}
          currentPage={results.currentPage}
          totalPages={results.totalPages}
          onPaginationChange={onPaginationChange}
          onRowClick={(row) => setSelectedEvent(row)}
          rowClassName="cursor-pointer group"
          error={{
            enable: isLoadingError,
          }}
          skeleton={{
            enable: isLoading,
            rows: 8,
            component: (
              <>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-1 h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
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
      </div>

      {selectedEvent && (
        <AdminPaystackWebhookEventSheet
          webhookEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

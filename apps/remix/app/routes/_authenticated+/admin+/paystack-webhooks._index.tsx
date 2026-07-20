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
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { AdminPaystackWebhookEventSheet } from '~/components/general/admin-paystack-webhook-event-sheet';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

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
        <Tabs value={parsedSearchParams.status ?? ''} className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="" asChild>
              <Link to={getStatusHref('')} preventScrollReset>
                <Trans>All</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS} asChild>
              <Link to={getStatusHref(PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS)} preventScrollReset>
                <Trans>Success</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED} asChild>
              <Link to={getStatusHref(PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED)} preventScrollReset>
                <Trans>Failed</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={PAYSTACK_WEBHOOK_EVENT_STATUS.IGNORED} asChild>
              <Link to={getStatusHref(PAYSTACK_WEBHOOK_EVENT_STATUS.IGNORED)} preventScrollReset>
                <Trans>Ignored</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={PAYSTACK_WEBHOOK_EVENT_STATUS.PENDING} asChild>
              <Link to={getStatusHref(PAYSTACK_WEBHOOK_EVENT_STATUS.PENDING)} preventScrollReset>
                <Trans>Pending</Trans>
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

      {selectedEvent && (
        <AdminPaystackWebhookEventSheet
          webhookEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

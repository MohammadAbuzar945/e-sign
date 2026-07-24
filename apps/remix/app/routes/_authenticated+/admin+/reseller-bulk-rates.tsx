import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link, redirect, useLocation, useSearchParams } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import {
  canAccessResellerDemoExtras,
  isDemoFeatureVisible,
} from '@documenso/lib/constants/demo-feature-flags';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  AdminResellerBulkRatesEditor,
  formatBulkRateTierSummary,
  type BulkRateTierDraft,
} from '~/components/general/admin-reseller-bulk-rates-editor';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminResellerBulkPurchasesTable } from '~/components/tables/admin-reseller-bulk-purchases-table';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reseller-bulk-rates';

const BULK_RATES_VIEW = {
  RATES: 'rates',
  PURCHASES: 'purchases',
} as const;

type BulkRatesView = (typeof BULK_RATES_VIEW)[keyof typeof BULK_RATES_VIEW];

const isBulkRatesView = (value: string | null): value is BulkRatesView =>
  value === BULK_RATES_VIEW.RATES || value === BULK_RATES_VIEW.PURCHASES;

export function meta() {
  return appMetaTags('Reseller bulk rates and purchases');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!canAccessResellerDemoExtras(user?.email)) {
    throw redirect('/admin');
  }

  if (!isDemoFeatureVisible('ADMIN_BULK_RATES')) {
    throw redirect('/admin');
  }

  return null;
}

const formatZarFromCents = (cents: number) => `ZAR ${(cents / 100).toFixed(2)}`;

export default function AdminResellerBulkRatesPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const updateSearchParams = useUpdateSearchParams();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const currentView = isBulkRatesView(searchParams.get('view'))
    ? searchParams.get('view')!
    : BULK_RATES_VIEW.RATES;

  const [searchQuery, setSearchQuery] = useState(searchParams.get('query') ?? '');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  useEffect(() => {
    if (currentView !== BULK_RATES_VIEW.PURCHASES) {
      return;
    }

    updateSearchParams({
      query: debouncedSearchQuery || null,
      page: 1,
    });
  }, [currentView, debouncedSearchQuery]);

  const getTabHref = (view: BulkRatesView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
    params.delete('page');

    if (view !== BULK_RATES_VIEW.PURCHASES) {
      params.delete('query');
      params.delete('status');
    }

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  };

  const onStatusFilterChange = (value: string) => {
    updateSearchParams({
      status: value === 'all' ? null : value,
      page: 1,
    });
  };

  const { data, isLoading, refetch } = trpc.admin.resellerBulkRates.listGlobal.useQuery(undefined, {
    enabled: currentView === BULK_RATES_VIEW.RATES,
  });

  const { mutateAsync: replaceGlobal, isPending } =
    trpc.admin.resellerBulkRates.replaceGlobal.useMutation({
      onSuccess: async () => {
        await refetch();
        toast({ title: _(msg`Global bulk rates saved`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not save bulk rates`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const initialTiers: BulkRateTierDraft[] =
    data?.tiers.map((tier) => ({
      minCredits: tier.minCredits,
      pricePerCreditCents: tier.pricePerCreditCents,
      isEnabled: tier.isEnabled,
    })) ?? [];

  const summary = formatBulkRateTierSummary(initialTiers);

  const subtitle =
    currentView === BULK_RATES_VIEW.PURCHASES
      ? _(msg`History of reseller inventory bulk top-ups from Nomia.`)
      : _(
          msg`Default volume sliding-scale rates for all resellers. Individual resellers can override these from the Accounts view.`,
        );

  const statusFilter = searchParams.get('status') ?? 'all';

  return (
    <div
      className={`w-full min-w-0 ${currentView === BULK_RATES_VIEW.PURCHASES ? 'max-w-6xl' : 'max-w-4xl'}`}
    >
      <SettingsHeader title={_(msg`Reseller bulk rates and purchases`)} subtitle={subtitle} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={currentView} className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value={BULK_RATES_VIEW.RATES} asChild>
              <Link to={getTabHref(BULK_RATES_VIEW.RATES)} preventScrollReset>
                <Trans>Rates</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={BULK_RATES_VIEW.PURCHASES} asChild>
              <Link to={getTabHref(BULK_RATES_VIEW.PURCHASES)} preventScrollReset>
                <Trans>Purchases</Trans>
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {currentView === BULK_RATES_VIEW.PURCHASES ? (
          <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder={_(msg`Status`)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <Trans>All statuses</Trans>
                </SelectItem>
                <SelectItem value="COMPLETED">
                  <Trans>Completed</Trans>
                </SelectItem>
                <SelectItem value="PENDING">
                  <Trans>Pending</Trans>
                </SelectItem>
                <SelectItem value="FAILED">
                  <Trans>Failed</Trans>
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="search"
              className="w-full"
              placeholder={_(msg`Search org, email, or Paystack ref`)}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {currentView === BULK_RATES_VIEW.RATES ? (
        <>
          {summary ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {summary.tiers.map((tier) => (
                <Badge key={tier.minCredits} variant="neutral" className="font-normal">
                  {tier.minCredits.toLocaleString()}+ · {formatZarFromCents(tier.pricePerCreditCents)}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border p-4 sm:p-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                <Trans>Loading rates…</Trans>
              </p>
            ) : (
              <AdminResellerBulkRatesEditor
                initialTiers={initialTiers}
                isSaving={isPending}
                onSave={async (tiers) => {
                  await replaceGlobal({ tiers });
                }}
              />
            )}
          </div>
        </>
      ) : (
        <div className="mt-8">
          <AdminResellerBulkPurchasesTable />
        </div>
      )}
    </div>
  );
}

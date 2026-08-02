import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link, redirect, useLocation, useSearchParams } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import {
  canAccessResellerNotify,
  isDemoFeatureVisible,
} from '@documenso/lib/constants/demo-feature-flags';
import {
  isResellerAdminView,
  RESELLER_ADMIN_VIEW,
} from '@documenso/lib/constants/reseller-application-status';
import { hasResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { AdminResellerNotifyPanel } from '~/components/general/admin-reseller-notify-panel';
import { AdminResellerApplicationsTable } from '~/components/tables/admin-reseller-applications-table';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reseller-applications._index';

export function meta() {
  return appMetaTags('Resellers');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!isDemoFeatureVisible('ADMIN_RESELLERS') || !hasResellerFeatureAccess(user.email)) {
    throw redirect('/admin');
  }

  const canNotify = canAccessResellerNotify(user.email);
  const url = new URL(request.url);
  const view = url.searchParams.get('view');

  if (view === RESELLER_ADMIN_VIEW.EMAIL && !canNotify) {
    url.searchParams.set('view', RESELLER_ADMIN_VIEW.QUEUE);
    throw redirect(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return {
    canNotify,
  };
}

export default function AdminResellerApplicationsPage({ loaderData }: Route.ComponentProps) {
  const { canNotify } = loaderData;
  const { _ } = useLingui();
  const updateSearchParams = useUpdateSearchParams();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const requestedView = isResellerAdminView(searchParams.get('view'))
    ? searchParams.get('view')!
    : RESELLER_ADMIN_VIEW.QUEUE;

  const currentView =
    requestedView === RESELLER_ADMIN_VIEW.EMAIL && !canNotify
      ? RESELLER_ADMIN_VIEW.QUEUE
      : requestedView;

  const isEmailView = currentView === RESELLER_ADMIN_VIEW.EMAIL;

  const [searchQuery, setSearchQuery] = useState(searchParams.get('query') ?? '');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  useEffect(() => {
    if (isEmailView) {
      return;
    }

    updateSearchParams({
      query: debouncedSearchQuery || null,
      page: 1,
    });
  }, [debouncedSearchQuery, isEmailView]);

  const getTabHref = (view: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
    params.delete('page');

    if (view === RESELLER_ADMIN_VIEW.EMAIL) {
      params.delete('query');
    }

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  };

  const subtitle =
    currentView === RESELLER_ADMIN_VIEW.ACCOUNTS
      ? _(msg`Manage active reseller accounts, credits, and payout readiness.`)
      : currentView === RESELLER_ADMIN_VIEW.CLOSED
        ? _(msg`Review rejected and cancelled reseller applications.`)
        : currentView === RESELLER_ADMIN_VIEW.EMAIL
          ? _(msg`Compose and send programme updates to all active resellers.`)
          : _(msg`Review organisations applying to become resellers.`);

  return (
    <div>
      <SettingsHeader title={_(msg`Resellers`)} subtitle={subtitle} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={currentView} className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value={RESELLER_ADMIN_VIEW.QUEUE} asChild>
              <Link to={getTabHref(RESELLER_ADMIN_VIEW.QUEUE)} preventScrollReset>
                <Trans>Applications</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={RESELLER_ADMIN_VIEW.ACCOUNTS} asChild>
              <Link to={getTabHref(RESELLER_ADMIN_VIEW.ACCOUNTS)} preventScrollReset>
                <Trans>Accounts</Trans>
              </Link>
            </TabsTrigger>
            <TabsTrigger value={RESELLER_ADMIN_VIEW.CLOSED} asChild>
              <Link to={getTabHref(RESELLER_ADMIN_VIEW.CLOSED)} preventScrollReset>
                <Trans>Closed</Trans>
              </Link>
            </TabsTrigger>
            {canNotify ? (
              <TabsTrigger value={RESELLER_ADMIN_VIEW.EMAIL} asChild>
                <Link to={getTabHref(RESELLER_ADMIN_VIEW.EMAIL)} preventScrollReset>
                  <Trans>Email / Notify</Trans>
                </Link>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>

        {!isEmailView ? (
          <div className="w-full sm:max-w-sm">
            <Input
              type="search"
              placeholder={_(msg`Search by organisation, applicant, or email`)}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        {isEmailView && canNotify ? <AdminResellerNotifyPanel /> : <AdminResellerApplicationsTable />}
      </div>
    </div>
  );
}

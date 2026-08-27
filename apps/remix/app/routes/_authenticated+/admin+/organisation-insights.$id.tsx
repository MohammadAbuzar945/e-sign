import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getOrganisationDetailedInsights } from '@documenso/lib/server-only/admin/get-organisation-detailed-insights';
import type { DateRange } from '@documenso/lib/types/search-params';
import { hasInviteReminderFeatureAccess } from '@documenso/lib/utils/invite-reminder-feature-access';
import { getAdminOrganisation } from '@documenso/trpc/server/admin-router/get-admin-organisation';
import { Button } from '@documenso/ui/primitives/button';

import { AdminOrganisationPendingInvitesPanel } from '~/components/general/admin-organisation-pending-invites-panel';
import { OrganisationInsightsTable } from '~/components/tables/organisation-insights-table';

import type { Route } from './+types/organisation-insights.$id';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;
  const url = new URL(request.url);

  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 10;
  const dateRange = (url.searchParams.get('dateRange') || 'last30days') as DateRange;
  const view = (url.searchParams.get('view') || 'teams') as 'teams' | 'users' | 'documents';

  const { user } = await getSession(request);

  const [insights, organisation] = await Promise.all([
    getOrganisationDetailedInsights({
      organisationId: id,
      page,
      perPage,
      dateRange,
      view,
    }),
    getAdminOrganisation({ organisationId: id }),
  ]);

  return {
    organisationId: id,
    organisationName: organisation.name,
    insights,
    page,
    perPage,
    dateRange,
    view,
    canSendInviteReminders: hasInviteReminderFeatureAccess(user.email),
  };
}

export default function OrganisationInsights({ loaderData }: Route.ComponentProps) {
  const {
    insights,
    page,
    perPage,
    dateRange,
    view,
    organisationName,
    organisationId,
    canSendInviteReminders,
  } = loaderData;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold">{organisationName}</h2>
        <Button variant="outline" asChild>
          <Link to={`/admin/organisations/${organisationId}`}>
            <Trans>Manage organisation</Trans>
          </Link>
        </Button>
      </div>
      {canSendInviteReminders && (
        <div className="mt-8">
          <AdminOrganisationPendingInvitesPanel organisationId={organisationId} />
        </div>
      )}

      <div className="mt-8">
        <OrganisationInsightsTable
          insights={insights}
          page={page}
          perPage={perPage}
          dateRange={dateRange}
          view={view}
        />
      </div>
    </div>
  );
}

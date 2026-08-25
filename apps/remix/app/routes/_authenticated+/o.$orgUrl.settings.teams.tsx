import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';
import { useLocation } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { canDownloadCreditUsage } from '@documenso/lib/utils/credit-usage-download-access';
import { OrganisationMemberRole, OrganisationType } from '@documenso/prisma/generated/types';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { OrganisationCreditUsageDownloadButton } from '~/components/general/organisation-credit-usage-download-button';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();
  const { user } = useSession();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  const canCreateTeam =
    organisation.ownerUserId === user.id ||
    organisation.currentOrganisationRole === OrganisationMemberRole.ADMIN ||
    organisation.currentOrganisationRole === OrganisationMemberRole.MANAGER;

  return (
    <div>
      <SettingsHeader title={t`Teams`} subtitle={t`Manage the teams in this organisation.`}>
        {(canDownloadCreditUsage(user.email) || canCreateTeam) && (
          <div className="flex flex-wrap items-center gap-2">
            {canDownloadCreditUsage(user.email) && (
              <OrganisationCreditUsageDownloadButton
                organisationId={organisation.id}
                organisationUrl={organisation.url}
              />
            )}
            {canCreateTeam && <TeamCreateDialog />}
          </div>
        )}
      </SettingsHeader>

      <p
        className={`mb-2 text-sm ${
          organisation.credits !== undefined && organisation.credits < 0
            ? 'font-medium text-amber-700'
            : 'text-muted-foreground'
        }`}
      >
        {t`Total credits remaining for this organisation: ${organisation.credits ?? 0}`}
      </p>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <OrganisationTeamsTable />
    </div>
  );
}

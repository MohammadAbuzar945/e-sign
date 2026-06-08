import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';

import { TeamMemberCreateDialog } from '~/components/dialogs/team-member-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamMembersTable } from '~/components/tables/team-members-table';
import { TeamLogsTable } from '~/components/tables/team-logs-table';
import { TeamAuditLogDownloadButton } from '~/components/general/team/team-audit-log-download-button';
import { useOptionalCurrentTeam } from '~/providers/team';

export default function TeamsSettingsMembersPage() {
  const { t } = useLingui();
  const team = useOptionalCurrentTeam();
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

    // If nothing  to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader title={t`Team Members`} subtitle={t`Manage the members of your team.`}>
        <TeamMemberCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamMembersTable />

      {team && (
        <div className="mt-8 space-y-4">
          <SettingsHeader
            title={t`Team activity`}
            subtitle={t`View recent changes to your team members and roles.`}
          >
            <TeamAuditLogDownloadButton teamId={team.id} />
          </SettingsHeader>

          <TeamLogsTable teamId={team.id} userId={user.id} />
        </div>
      )}
    </div>
  );
}

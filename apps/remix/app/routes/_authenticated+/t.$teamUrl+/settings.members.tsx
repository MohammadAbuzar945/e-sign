import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

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

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Team Members`} subtitle={t`Manage the members of your team.`}>
        <TeamMemberCreateDialog />
      </SettingsHeader>

      <Input
        value={searchQuery}
        onChange={(e) => void setSearchQuery(e.target.value || null)}
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

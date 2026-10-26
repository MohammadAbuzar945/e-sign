import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { OrganisationCreditUsageDownloadButton } from '~/components/general/organisation-credit-usage-download-button';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
  const organisation = useCurrentOrganisation();
  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Teams`} subtitle={t`Manage the teams in this organisation.`}>
        <div className="flex flex-wrap items-center gap-2">
          <OrganisationCreditUsageDownloadButton
            organisationId={organisation.id}
            organisationUrl={organisation.url}
          />
          <TeamCreateDialog />
        </div>
      </SettingsHeader>

      <Input
        value={searchQuery}
        onChange={(e) => void setSearchQuery(e.target.value || null)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <OrganisationTeamsTable />
    </div>
  );
}

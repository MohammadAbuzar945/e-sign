import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { Input } from '@documenso/ui/primitives/input';

import { AdminResellerApplicationsTable } from '~/components/tables/admin-reseller-applications-table';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reseller-applications._index';

export function meta() {
  return appMetaTags('Reseller Applications');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user?.email || !isResellerFeatureAllowedEmail(user.email)) {
    throw redirect('/admin');
  }

  return null;
}

export default function AdminResellerApplicationsPage() {
  const { _ } = useLingui();
  const updateSearchParams = useUpdateSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  useEffect(() => {
    updateSearchParams({
      query: debouncedSearchQuery || null,
      page: 1,
    });
  }, [debouncedSearchQuery]);

  return (
    <div>
      <SettingsHeader
        title={_(msg`Reseller Applications`)}
        subtitle={_(msg`Review organisations that have applied to become resellers.`)}
      />

      <div className="mt-6 rounded-lg border bg-background p-4">
        <Input
          type="search"
          placeholder={_(msg`Search by organisation, applicant, or email`)}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className="mt-8">
        <AdminResellerApplicationsTable />
      </div>
    </div>
  );
}

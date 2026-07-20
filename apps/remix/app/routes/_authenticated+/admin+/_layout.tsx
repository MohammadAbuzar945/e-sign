import { Trans } from '@lingui/react/macro';
import { Outlet, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { LicenseClient } from '@documenso/lib/server-only/license/license-client';
import { isAdmin } from '@documenso/lib/utils/is-admin';

import { AdminLicenseStatusBanner } from '~/components/general/admin-license-status-banner';
import { AdminNavLinks } from '~/components/general/admin-nav-links';

import type { Route } from './+types/_layout';

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user || !isAdmin(user)) {
    throw redirect('/');
  }

  const licenseClient = LicenseClient.getInstance();
  const license = licenseClient ? await licenseClient.getCachedLicense() : null;

  return {
    license: license || null,
  };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { license } = loaderData;

  return (
    <div className="mx-auto w-full min-w-0 max-w-screen-xl px-4 md:px-8">
      <AdminLicenseStatusBanner license={license} />

      <h1 className="text-2xl font-semibold md:text-4xl">
        <Trans>Admin Panel</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <aside className="col-span-12 md:col-span-3">
          <AdminNavLinks className="rounded-lg border bg-muted/20 p-2 md:border-0 md:bg-transparent md:p-0" />
        </aside>

        <div className="col-span-12 mt-6 min-w-0 md:col-span-9 md:mt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

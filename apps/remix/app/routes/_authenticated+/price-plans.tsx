import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getOrganisationBillingAttributionSummary } from '@documenso/lib/server-only/reseller/resolve-organisation-payg-billing';
import { resolveOrganisationBillingPath } from '@documenso/lib/utils/organisation-billing-path';
import { prisma } from '@documenso/prisma';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/price-plans';

export function meta() {
  return appMetaTags('Price Plans');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: user.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!organisation) {
    throw redirect('/');
  }

  const billingAttribution = await getOrganisationBillingAttributionSummary(organisation.id);
  const billingPath = resolveOrganisationBillingPath({
    organisationUrl: organisation.url,
    billingAttribution,
  });

  throw redirect(billingPath);
}

export default function PricePlansPage() {
  return null;
}

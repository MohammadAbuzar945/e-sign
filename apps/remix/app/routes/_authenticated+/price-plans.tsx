import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import { msg } from '@lingui/core/macro';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/price-plans';

export function meta() {
  return appMetaTags(msg`Price Plans`);
}

export async function loader({ request }: Route.LoaderArgs) {
  // Get session user
  const { user } = await getSession(request);

  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: user.id,
    },
  });

  if (!organisation) {
    // If user has no owned organizations, redirect to dashboard
    throw redirect('/');
  }

  // Redirect to organization-specific price plan page
  throw redirect(`/o/${organisation.url}/price-plan`);
}

// This component should never render as the loader always redirects
export default function PricePlansPage() {
  return null;
}

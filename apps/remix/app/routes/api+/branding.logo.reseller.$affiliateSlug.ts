import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { loadLogo } from '@documenso/lib/utils/images/logo';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/branding.logo.reseller.$affiliateSlug';

export async function loader({ params }: Route.LoaderArgs) {
  const affiliateSlug = params.affiliateSlug;

  if (!affiliateSlug) {
    return Response.json(
      {
        status: 'error',
        message: 'Invalid affiliate slug',
      },
      { status: 400 },
    );
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: {
      affiliateSlug,
    },
  });

  if (!profile || !profile.brandingLogo) {
    return Response.json(
      {
        status: 'error',
        message: 'Logo not found',
      },
      { status: 404 },
    );
  }

  if (!profile.brandingEnabled) {
    return Response.json(
      {
        status: 'error',
        message: 'Branding is not enabled',
      },
      { status: 400 },
    );
  }

  const file = await getFileServerSide(JSON.parse(profile.brandingLogo)).catch((e) => {
    console.error(e);
  });

  if (!file) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  const { content, contentType } = await loadLogo(file);

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': content.length.toString(),
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

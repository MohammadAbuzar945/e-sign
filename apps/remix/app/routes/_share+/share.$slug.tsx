import { env } from '@documenso/lib/utils/env';
import { getDocumentByAccessToken } from '@documenso/lib/server-only/document/get-document-by-access-token';
import { redirect, useLoaderData } from 'react-router';

import { DocumentCertificateQRView } from '~/components/general/document/document-certificate-qr-view';

import type { Route } from './+types/share.$slug';

export function meta({ params: { slug } }: Route.MetaArgs) {
  if (slug.startsWith('qr_')) {
    return undefined;
  }
  const NEXT_PUBLIC_WEBAPP_URL = env('NEXT_PUBLIC_WEBAPP_URL');
  return [
    { title: 'Nomia - Share' },
    { description: 'I just signed a document in style with Nomia!' },
    {
      property: 'og:title',
      content: 'Nomia - Join the open source signing revolution',
    },
    {
      property: 'og:description',
      content: 'I just signed with Nomia!',
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      property: 'og:image',
      content: `${env('NEXT_PUBLIC_WEBAPP_URL')}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:site',
      content: '@documenso',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:image',
      content: `${env('NEXT_PUBLIC_WEBAPP_URL')}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:description',
      content: 'I just signed with Nomia!',
    },
  ];
}

export const loader = async ({ request, params: { slug } }: Route.LoaderArgs) => {
  if (slug.startsWith('qr_')) {
    const document = await getDocumentByAccessToken({ token: slug });

    if (!document) {
      throw redirect('/');
    }

    return {
      document,
      token: slug,
    };
  }

  const userAgent = request.headers.get('User-Agent') ?? '';

  if (/bot|facebookexternalhit|WhatsApp|google|bing|duckduckbot|MetaInspector/i.test(userAgent)) {
    return {};
  }

  // Is hardcoded because this whole meta is hardcoded anyway for Documenso.
  throw redirect(env('NEXT_PUBLIC_WEBAPP_URL') ?? '');
};

export default function SharePage() {
  const { document, token } = useLoaderData<typeof loader>();

  if (document) {
    return (
      <DocumentCertificateQRView
        documentId={document.id}
        title={document.title}
        documentTeamUrl={document.documentTeamUrl}
        internalVersion={document.internalVersion}
        envelopeItems={document.envelopeItems}
        recipientCount={document.recipientCount}
        completedDate={document.completedAt ?? undefined}
        token={token}
      />
    );
  }

  return <div></div>;
}

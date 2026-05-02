import { type MessageDescriptor, i18n } from '@lingui/core';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { env } from '@documenso/lib/utils/env';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'An intuitive, affordable app with pay-as-you-go pricing bundles and unlimited seats. Premium e-sign without the premium price tag. Fully AATL compliant.';

  return [
    {
      title: title ? `${title} - Nomia Signatures` : 'Nomia Signatures',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'Nomia Signatures, e-signature platform, nomiadocs, nomia, DocuSign alternative, document signing, open signing infrastructure, open-source community, fast signing, beautiful signing, smart templates',
    },
    {
      name: 'author',
      content: 'Nomia Africa (Pty) Limited',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'Nomia | E-Sign App with Unlimited Seats',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@nomicommunity',
    },
    {
      name: 'twitter:description',
      content: description,
    }
  ];
};

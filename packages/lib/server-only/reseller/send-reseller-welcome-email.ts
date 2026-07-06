import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import ResellerWelcomeEmailTemplate from '@documenso/email/templates/reseller-welcome';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export type SendResellerWelcomeEmailOptions = {
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
  affiliateSlug: string;
};

export const sendResellerWelcomeEmail = async ({
  organisationName,
  applicantName,
  applicantEmail,
  affiliateSlug,
}: SendResellerWelcomeEmailOptions) => {
  const affiliateUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}`;

  const emailContent = createElement(ResellerWelcomeEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    organisationName,
    applicantName,
    affiliateUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  const i18n = await getI18nInstance('en');

  await mailer.sendMail({
    to: applicantEmail,
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Nomia',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@nomiadocs.com',
    },
    subject: i18n._(msg`Welcome to the Nomia Reseller Programme`),
    html,
    text,
  });
};

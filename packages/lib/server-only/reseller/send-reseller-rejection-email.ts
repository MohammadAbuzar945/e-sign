import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import ResellerApplicationRejectedEmailTemplate from '@documenso/email/templates/reseller-application-rejected';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export type SendResellerRejectionEmailOptions = {
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
  rejectionReason?: string | null;
};

export const sendResellerRejectionEmail = async ({
  organisationName,
  applicantName,
  applicantEmail,
  rejectionReason,
}: SendResellerRejectionEmailOptions) => {
  const emailContent = createElement(ResellerApplicationRejectedEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    organisationName,
    applicantName,
    rejectionReason,
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
    subject: i18n._(msg`Update on your Nomia reseller application`),
    html,
    text,
  });
};

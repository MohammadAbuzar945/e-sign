import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { mailer } from '@documenso/email/mailer';
import ResellerInsufficientCreditsEmailTemplate from '@documenso/email/templates/reseller-insufficient-credits';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export type SendResellerInsufficientCreditsEmailOptions = {
  resellerOrganisationId: string;
  resellerOrganisationName: string;
  resellerOwnerEmail: string;
  resellerOrganisationUrl: string;
  purchaserName: string;
  purchaserEmail: string;
  purchaserOrganisationName: string;
  creditsRequired: number;
};

export const sendResellerInsufficientCreditsEmail = async ({
  resellerOrganisationId,
  resellerOrganisationName,
  resellerOwnerEmail,
  resellerOrganisationUrl,
  purchaserName,
  purchaserEmail,
  purchaserOrganisationName,
  creditsRequired,
}: SendResellerInsufficientCreditsEmailOptions) => {
  const availableCredits = await getOrganisationCredits(resellerOrganisationId);
  const resellerSettingsUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${resellerOrganisationUrl}/settings/reseller`;

  const emailContent = createElement(ResellerInsufficientCreditsEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    resellerOrganisationName,
    purchaserName,
    purchaserEmail,
    purchaserOrganisationName,
    creditsRequired,
    availableCredits,
    resellerSettingsUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  const i18n = await getI18nInstance('en');

  await mailer.sendMail({
    to: resellerOwnerEmail,
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Nomia',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@nomiadocs.com',
    },
    subject: i18n._(
      msg`${purchaserOrganisationName} could not be topped up automatically due to low credits`,
    ),
    html,
    text,
  });
};

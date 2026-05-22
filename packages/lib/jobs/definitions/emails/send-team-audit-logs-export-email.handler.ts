import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { TeamAuditLogsExportEmailTemplate } from '@documenso/email/templates/team-audit-logs-export';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendTeamAuditLogsExportEmailJobDefinition } from './send-team-audit-logs-export-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendTeamAuditLogsExportEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { teamId, teamName, requestedByUserEmail, requestedByUserName, downloadUrl } = payload;

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId,
    },
  });

  const baseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const assetBaseUrl = baseUrl;

  const i18n = await getI18nInstance(emailLanguage);

  const template = createElement(TeamAuditLogsExportEmailTemplate, {
    assetBaseUrl,
    baseUrl,
    downloadUrl,
    teamName,
  });

  await io.runTask('send-team-audit-logs-export-email', async () => {
    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: emailLanguage, branding }),
      renderEmailWithI18N(template, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        address: requestedByUserEmail,
        name: requestedByUserName ?? '',
      },
      from: senderEmail,
      subject: i18n._(msg`Your team audit logs export is ready`),
      html,
      text,
    });
  });
};


import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';

import { prisma } from '@documenso/prisma';

import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import { parseTeamAuditLogData } from '../../utils/team-audit-logs';
import { getTranslations } from '../../utils/i18n';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { renderTeamAuditLogs } from './render-team-audit-logs';

type GenerateTeamAuditLogPdfOptions = {
  teamId: number;
  language?: string;
  pageWidth: number;
  pageHeight: number;
};

export const generateTeamAuditLogPdf = async (options: GenerateTeamAuditLogPdfOptions) => {
  const { teamId, language, pageWidth, pageHeight } = options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language ?? 'en');

  const [organisationClaim, team, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId }),
    prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        organisation: {
          select: {
            name: true,
          },
        },
      },
    }),
    getTeamAuditLogs(teamId),
    getTranslations(documentLanguage),
  ]);

  if (!team) {
    throw new Error('Team not found');
  }

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const auditLogPages = await renderTeamAuditLogs({
    team,
    auditLogs,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy ?? false,
    pageWidth,
    pageHeight,
    i18n,
  });

  return await PDF.merge(auditLogPages, {
    includeAnnotations: true,
  });
};

const getTeamAuditLogs = async (teamId: number) => {
  const auditLogs = await (prisma as any).teamAuditLog.findMany({
    where: {
      teamId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return auditLogs.map((auditLog: unknown) => parseTeamAuditLogData(auditLog));
};


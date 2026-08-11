import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';
import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { canViewEmailFailedAuditLogs } from '../../constants/email-failed-audit-log';
import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { parseDocumentAuditLogData } from '../../utils/document-audit-logs';
import { getTranslations } from '../../utils/i18n';
import { parseClaimFlags } from '../../utils/parse-claim-flags';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import type { GenerateCertificatePdfOptions } from './generate-certificate-pdf';
import { renderAuditLogs } from './render-audit-logs';

type GenerateAuditLogPdfOptions = GenerateCertificatePdfOptions & {
  envelopeItems: string[];
  /**
   * Viewer email used to gate EMAIL_FAILED audit logs in the PDF.
   * When omitted or not allowlisted, EMAIL_FAILED entries are hidden.
   */
  viewerEmail?: string | null;
};

export const generateAuditLogPdf = async (options: GenerateAuditLogPdfOptions) => {
  const {
    envelope,
    envelopeOwner,
    envelopeItems,
    recipients,
    language,
    pageWidth,
    pageHeight,
    viewerEmail,
  } = options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [organisationClaim, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId: envelope.teamId }),
    getAuditLogs(envelope.id, viewerEmail),
    getTranslations(documentLanguage),
  ]);

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const auditLogPages = await renderAuditLogs({
    envelope,
    envelopeOwner,
    envelopeItems,
    recipients,
    auditLogs,
    hidePoweredBy: parseClaimFlags(organisationClaim.flags).hidePoweredBy ?? false,
    pageWidth,
    pageHeight,
    i18n,
  });

  return await PDF.merge(auditLogPages, {
    includeAnnotations: true,
  });
};

const getAuditLogs = async (envelopeId: string, viewerEmail?: string | null) => {
  const whereClause: Prisma.DocumentAuditLogWhereInput = {
    envelopeId,
  };

  if (!canViewEmailFailedAuditLogs(viewerEmail)) {
    whereClause.type = {
      not: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
    };
  }

  const auditLogs = await prisma.documentAuditLog.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return auditLogs.map((auditLog) => parseDocumentAuditLogData(auditLog));
};

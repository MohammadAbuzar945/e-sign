import { ResellerApplicationStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { DOCUMENSO_INTERNAL_EMAIL } from '@documenso/lib/constants/email';
import type { ResellerTermsVariableValues } from '@documenso/lib/constants/reseller-terms-variables';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { generateResellerTermsDocument, fetchResellerTermsTemplateVariables } from '@documenso/lib/server-only/nomia-docgen';
import { getResellerSiteSettings } from '@documenso/lib/server-only/site-settings/get-reseller-site-settings';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapTemplateIdToSecondaryId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

export type SendResellerTermsApplicationInput = {
  applicationId: string;
  variableValues: ResellerTermsVariableValues;
  docGenOptions: {
    showInNomia: boolean;
    buildForEsign: boolean;
    sendForEsign: boolean;
    esignApiKey?: string;
  };
};

export type SendResellerTermsOptions = {
  applications: SendResellerTermsApplicationInput[];
  requestMetadata: ApiRequestMetadata;
};

const getResellerTermsTemplateConfig = async () => {
  const resellerSettings = await getResellerSiteSettings();

  return {
    termsDocGenTemplateId: resellerSettings?.termsDocGenTemplateId,
    termsDocGenOrganizationId: resellerSettings?.termsDocGenOrganizationId,
    termsDocGenWorkspaceId: resellerSettings?.termsDocGenWorkspaceId,
    termsInternalTemplateId: resellerSettings?.termsInternalTemplateId,
    docGenApiUrl: resellerSettings?.docGenApiUrl,
    docGenAuthToken: resellerSettings?.docGenAuthToken,
    docGenApiKey: resellerSettings?.docGenApiKey,
    docGenApiEndpoint: resellerSettings?.docGenApiEndpoint,
    docGenEsignApiKey: resellerSettings?.docGenEsignApiKey,
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sendResellerTermsPdfLinkEmail = async ({
  applicantEmail,
  applicantName,
  organisationName,
  pdfLink,
}: {
  applicantEmail: string;
  applicantName: string;
  organisationName: string;
  pdfLink: string;
}) => {
  const safeApplicantName = escapeHtml(applicantName);
  const safeOrganisationName = escapeHtml(organisationName);
  const safePdfLink = escapeHtml(pdfLink);

  const text = [
    `Hi ${applicantName},`,
    '',
    `Your reseller terms and conditions for ${organisationName} have been generated.`,
    '',
    `Open the document here: ${pdfLink}`,
  ].join('\n');

  await mailer.sendMail({
    to: applicantEmail,
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: 'Your Nomia reseller terms and conditions',
    html: `
      <p>Hi ${safeApplicantName},</p>
      <p>Your reseller terms and conditions for ${safeOrganisationName} have been generated.</p>
      <p><a href="${safePdfLink}">Open reseller terms and conditions</a></p>
    `,
    text,
  });
};

export const sendResellerTerms = async ({
  applications,
  requestMetadata,
}: SendResellerTermsOptions) => {
  const templateConfig = await getResellerTermsTemplateConfig();

  if (!templateConfig.termsDocGenTemplateId && !templateConfig.termsInternalTemplateId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        'Reseller T&Cs template is not configured. Please set it in Admin Site Settings first.',
    });
  }

  const results = [];
  let templateVariables: Awaited<ReturnType<typeof fetchResellerTermsTemplateVariables>> | null =
    null;

  if (templateConfig.termsDocGenTemplateId) {
    if (!templateConfig.termsDocGenOrganizationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Nomia DocGen organization ID is not configured. Set it in Admin Site Settings.',
      });
    }

    if (!templateConfig.docGenAuthToken) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Nomia DocGen API credentials are not configured. Set them in Admin Site Settings.',
      });
    }

    templateVariables = await fetchResellerTermsTemplateVariables({
      organizationId: templateConfig.termsDocGenOrganizationId,
      templateId: templateConfig.termsDocGenTemplateId,
      credentials: {
        apiUrl: templateConfig.docGenApiUrl,
        authToken: templateConfig.docGenAuthToken,
      },
    });
  }

  for (const { applicationId, variableValues, docGenOptions } of applications) {
    const application = await prisma.resellerApplication.findUnique({
      where: { id: applicationId },
      include: {
        organisation: true,
        applicantUser: true,
      },
    });

    if (!application) {
      continue;
    }

    if (!['PENDING', 'TERMS_SENT'].includes(application.status)) {
      continue;
    }

    const team = await prisma.team.findFirst({
      where: {
        organisationId: application.organisationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `No team found for organisation ${application.organisation.name}`,
      });
    }

    let termsEnvelopeId = application.termsEnvelopeId ?? undefined;
    let externalDocGenRequestId = application.externalDocGenRequestId ?? undefined;
    let termsTemplateId =
      templateConfig.termsDocGenTemplateId?.toString() ??
      String(templateConfig.termsInternalTemplateId);

    if (templateConfig.termsDocGenTemplateId) {
      if (!templateConfig.termsDocGenWorkspaceId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message:
            'Nomia DocGen workspace ID is not configured. Set it in Admin Site Settings.',
        });
      }

      if (!templateConfig.docGenApiKey || !templateConfig.docGenAuthToken) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message:
            'Nomia DocGen API credentials are not configured. Set them in Admin Site Settings.',
        });
      }

      const documentName = `Nomia Reseller Agreement - ${application.snapshotOrgName}`;

      try {
        const docGenResult = await generateResellerTermsDocument({
          templateId: templateConfig.termsDocGenTemplateId,
          workspaceId: templateConfig.termsDocGenWorkspaceId,
          documentName,
          variableValues,
          templateVariables: templateVariables ?? [],
          docGenOptions,
          credentials: {
            apiUrl: templateConfig.docGenApiUrl,
            authToken: templateConfig.docGenAuthToken,
            apiKey: templateConfig.docGenApiKey,
            apiEndpoint: templateConfig.docGenApiEndpoint,
            esignApiKey: templateConfig.docGenEsignApiKey,
          },
          signatories: [
            {
              fullName: application.snapshotApplicantName,
              email: application.snapshotApplicantEmail,
              signatoryIndex: 1,
              role: 'SIGNER',
            },
          ],
          externalId: application.id,
        });

        externalDocGenRequestId = docGenResult.externalDocGenRequestId ?? application.id;
        termsEnvelopeId = docGenResult.envelopeId;

        if (!docGenResult.success) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Nomia DocGen did not confirm document creation.',
          });
        }

        if (!docGenOptions.sendForEsign) {
          if (!docGenResult.pdfLink) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message:
                'Nomia DocGen generated the document but did not return a PDF link to email.',
            });
          }

          await sendResellerTermsPdfLinkEmail({
            applicantEmail: application.snapshotApplicantEmail,
            applicantName: application.snapshotApplicantName,
            organisationName: application.snapshotOrgName,
            pdfLink: docGenResult.pdfLink,
          });
        }
      } catch (error) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: error instanceof Error ? error.message : 'Nomia DocGen request failed.',
        });
      }
    }

    if (!termsEnvelopeId && templateConfig.termsInternalTemplateId) {
      const template = await prisma.envelope.findFirst({
        where: {
          type: 'TEMPLATE',
          secondaryId: mapTemplateIdToSecondaryId(templateConfig.termsInternalTemplateId),
        },
        include: {
          recipients: true,
        },
      });

      if (!template || template.recipients.length === 0) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Configured reseller T&Cs template was not found or has no recipients.',
        });
      }

      const signerRecipient =
        template.recipients.find((recipient) => recipient.role === 'SIGNER') ??
        template.recipients[0];

      const envelope = await createDocumentFromTemplate({
        id: {
          type: 'templateId',
          id: templateConfig.termsInternalTemplateId,
        },
        userId: application.applicantUserId,
        teamId: team.id,
        recipients: [
          {
            id: signerRecipient.id,
            email: application.snapshotApplicantEmail,
            name: application.snapshotApplicantName,
            signingOrder: 1,
          },
        ],
        override: {
          title: `Reseller Terms & Conditions - ${application.snapshotOrgName}`,
        },
        requestMetadata,
      });

      termsEnvelopeId = envelope.id;

      await sendDocument({
        id: {
          type: 'envelopeId',
          id: envelope.id,
        },
        userId: application.applicantUserId,
        teamId: team.id,
        sendEmail: true,
        requestMetadata,
      });
    }

    if (!termsEnvelopeId && !externalDocGenRequestId && !templateConfig.termsDocGenTemplateId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Failed to create reseller T&Cs document. Check API credentials and template configuration.',
      });
    }

    if (templateConfig.termsDocGenTemplateId && !externalDocGenRequestId) {
      externalDocGenRequestId = application.id;
    }

    const updatedApplication = await prisma.resellerApplication.update({
      where: { id: application.id },
      data: {
        status: ResellerApplicationStatus.TERMS_SENT,
        termsSentAt: new Date(),
        termsTemplateId,
        termsEnvelopeId,
        externalDocGenRequestId,
      },
    });

    results.push(updatedApplication);
  }

  return results;
};

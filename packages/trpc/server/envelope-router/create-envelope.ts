import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { convertToPdf } from '@documenso/lib/server-only/document-conversion';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { extractPdfPlaceholders } from '@documenso/lib/server-only/pdf/auto-place-fields';
import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { Logger } from 'pino';
import { match, P } from 'ts-pattern';

import { insertFormValuesInPdf } from '../../../lib/server-only/pdf/insert-form-values-in-pdf';
import { authenticatedProcedure } from '../trpc';
import type { TCreateEnvelopeRequest } from './create-envelope.types';
import {
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
  createEnvelopeMeta,
} from './create-envelope.types';

export const createEnvelopeRoute = authenticatedProcedure
  .meta(createEnvelopeMeta)
  .input(ZCreateEnvelopeRequestSchema)
  .output(ZCreateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { payload } = input;

    ctx.logger.info({
      input: {
        folderId: payload.folderId,
      },
    });

    const { remaining, maximumEnvelopeItemCount, allowNegativeCredits } = await getServerLimits({
      userId: user.id,
      teamId,
    });

    if (!allowNegativeCredits && remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit. Please upgrade your plan.',
        statusCode: 400,
      });
    }

    return await createEnvelopeRouteCaller({
      userId: user.id,
      teamId,
      input,
      apiRequestMetadata: ctx.metadata,
      logger: ctx.logger,
      serverLimits: { maximumEnvelopeItemCount },
    });
  });

type CreateEnvelopeRouteOptions = {
  userId: number;
  teamId: number;
  input: TCreateEnvelopeRequest;
  apiRequestMetadata: ApiRequestMetadata;
  logger?: Logger;
  serverLimits?: { maximumEnvelopeItemCount: number };
  options?: {
    bypassDefaultRecipients?: boolean;
  };
};

export const createEnvelopeRouteCaller = async ({
  userId,
  teamId,
  input,
  apiRequestMetadata,
  logger,
  serverLimits,
  options = {},
}: CreateEnvelopeRouteOptions) => {
  const { payload, files } = input;

  const {
    title,
    type,
    externalId,
    visibility,
    includeQrCodeInCertificate,
    globalAccessAuth,
    globalActionAuth,
    formValues,
    recipients,
    folderId,
    meta,
    attachments,
    delegatedDocumentOwner,
  } = payload;

  if (serverLimits) {
    const { maximumEnvelopeItemCount } = serverLimits;

    if (files.length > maximumEnvelopeItemCount) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${maximumEnvelopeItemCount} envelope items per envelope`,
        statusCode: 400,
      });
    }
  }

  // For each file: convert to PDF if needed, normalize, extract & clean placeholders, then upload.
  const envelopeItems = await Promise.all(
    files.map(async (file) => {
      let pdf = await convertToPdf(file, logger);

      if (formValues) {
        // eslint-disable-next-line require-atomic-updates
        pdf = await insertFormValuesInPdf({
          pdf,
          formValues,
        });
      }

      const normalized = await normalizePdf(pdf, {
        flattenForm: type !== EnvelopeType.TEMPLATE,
      });

      const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

      const { documentData } = await putPdfFileServerSide({
        name: file.name,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(cleanedPdf),
      });

      return {
        title: file.name,
        documentDataId: documentData.id,
        placeholders,
      };
    }),
  );

  const recipientsToCreate = recipients?.map((recipient) => ({
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    accessAuth: recipient.accessAuth,
    actionAuth: recipient.actionAuth,
    fields: recipient.fields?.map((field) => {
      const documentDataId = match(field.identifier)
        .with(P.string, (title) => envelopeItems.find((item) => item.title === title)?.documentDataId)
        .with(P.number, (index) => envelopeItems.at(index)?.documentDataId)
        .with(undefined, () => envelopeItems.at(0)?.documentDataId)
        .exhaustive();

      if (!documentDataId) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document data not found',
        });
      }

      return {
        ...field,
        documentDataId,
      };
    }),
  }));

  const envelope = await createEnvelope({
    userId,
    teamId,
    internalVersion: 2,
    data: {
      type,
      title,
      externalId,
      formValues,
      visibility,
      includeQrCodeInCertificate,
      globalAccessAuth,
      globalActionAuth,
      recipients: recipientsToCreate,
      folderId,
      envelopeItems,
      delegatedDocumentOwner,
    },
    attachments,
    meta,
    requestMetadata: apiRequestMetadata,
    bypassDefaultRecipients: options.bypassDefaultRecipients,
  });

  return {
    id: envelope.id,
  };
};

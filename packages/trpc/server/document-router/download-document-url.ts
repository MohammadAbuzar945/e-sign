import type { DocumentData } from '@prisma/client';
import { DocumentDataType, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { unsafeBuildEnvelopeIdQuery } from '@documenso/lib/utils/envelope';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZDownloadDocumentUrlRequestSchema,
  ZDownloadDocumentUrlResponseSchema,
  downloadDocumentUrlMeta,
} from './download-document-url.types';

export const downloadDocumentUrlRoute = procedure
  .meta(downloadDocumentUrlMeta)
  .input(ZDownloadDocumentUrlRequestSchema)
  .output(ZDownloadDocumentUrlResponseSchema)
  .query(async ({ input, ctx }) => {
    const { documentId, version } = input;

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    const envelope = await prisma.envelope.findFirst({
      where: unsafeBuildEnvelopeIdQuery(
        {
          type: 'documentId',
          id: documentId,
        },
        EnvelopeType.DOCUMENT,
      ),
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document could not be found',
      });
    }

    const documentData: DocumentData | undefined = envelope.envelopeItems[0]?.documentData;

    if (envelope.envelopeItems.length !== 1 || !documentData) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'This endpoint only supports documents with a single item. Use envelopes API instead.',
      });
    }

    if (documentData.type !== DocumentDataType.S3_PATH) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not stored in S3 and cannot be downloaded via URL.',
      });
    }

    if (version === 'signed' && !isDocumentCompleted(envelope.status)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not completed yet.',
      });
    }

    try {
      const data =
        version === 'original' ? documentData.initialData || documentData.data : documentData.data;

      const { url } = await getPresignGetUrl(data);

      const baseTitle = envelope.title.replace(/\.pdf$/, '');
      const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';
      const filename = `${baseTitle}${suffix}`;

      return {
        downloadUrl: url,
        filename,
        contentType: 'application/pdf',
      };
    } catch (error) {
      ctx.logger.error({
        error,
        message: 'Failed to generate download URL',
        documentId,
        version,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to generate download URL',
      });
    }
  });


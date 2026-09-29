import type { DocumentData } from '@prisma/client';
import { DocumentDataType, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { unsafeBuildEnvelopeIdQuery } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZDownloadDocumentUrlRequestSchema,
  ZDownloadDocumentUrlResponseSchema,
  downloadDocumentUrlMeta,
} from './download-document-url.types';

const buildFilename = (title: string, version: 'original' | 'signed') => {
  const baseTitle = title.replace(/\.pdf$/, '');
  const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';

  return `${baseTitle}${suffix}`;
};

const getDownloadUrlForItem = async ({
  documentData,
  version,
}: {
  documentData: DocumentData;
  version: 'original' | 'signed';
}) => {
  if (documentData.type !== DocumentDataType.S3_PATH) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document is not stored in S3 and cannot be downloaded via URL.',
    });
  }

  const data =
    version === 'original' ? documentData.initialData || documentData.data : documentData.data;

  const { url } = await getPresignGetUrl(data);

  return url;
};

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

    const { envelopeItems } = envelope;

    if (envelopeItems.length === 0) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document has no items to download',
      });
    }

    if (version === 'signed' && !isDocumentCompleted(envelope.status)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not completed yet.',
      });
    }

    try {
      if (envelopeItems.length === 1) {
        const [envelopeItem] = envelopeItems;

        const downloadUrl = await getDownloadUrlForItem({
          documentData: envelopeItem.documentData,
          version,
        });

        return {
          downloadUrl,
          filename: buildFilename(envelope.title, version),
          contentType: 'application/pdf',
        };
      }

      return await Promise.all(
        envelopeItems.map(async (envelopeItem) => {
          const downloadUrl = await getDownloadUrlForItem({
            documentData: envelopeItem.documentData,
            version,
          });

          return {
            envelopeItemId: envelopeItem.id,
            downloadUrl,
            filename: buildFilename(envelopeItem.title, version),
            contentType: 'application/pdf',
          };
        }),
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

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

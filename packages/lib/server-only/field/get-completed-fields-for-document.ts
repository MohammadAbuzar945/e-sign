import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@prisma/client';
import { mapDocumentIdToSecondaryId } from '../../utils/envelope';

export type GetCompletedFieldsForDocumentOptions = {
  documentId: number;
};

export const getCompletedFieldsForDocument = async ({ documentId }: GetCompletedFieldsForDocumentOptions) => {
  return await prisma.field.findMany({
    where: {
      envelope: {
        secondaryId: mapDocumentIdToSecondaryId(documentId),
      },
      recipient: {
        signingStatus: SigningStatus.SIGNED,
      },
      inserted: true,
    },
    include: {
      signature: true,
      recipient: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
};

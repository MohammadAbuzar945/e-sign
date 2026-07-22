import type { Prisma, ResellerVatStatus } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export type RecordResellerVatRegistrationOptions = {
  resellerProfileId: string;
  status: ResellerVatStatus;
  vatNumber?: string | null;
  validFrom?: Date;
  verifiedAt?: Date | null;
  tx?: TxClient;
};

/**
 * Closes the open VAT registration period (if any) and opens a new one when
 * status/number change. Used so invoices can resolve seller VAT as-of date.
 */
export const recordResellerVatRegistrationChange = async ({
  resellerProfileId,
  status,
  vatNumber,
  validFrom = new Date(),
  verifiedAt = status === 'REGISTERED' ? validFrom : null,
  tx,
}: RecordResellerVatRegistrationOptions) => {
  const client = tx;

  if (!client) {
    const { prisma } = await import('@documenso/prisma');

    return prisma.$transaction((transaction) =>
      recordResellerVatRegistrationChange({
        resellerProfileId,
        status,
        vatNumber,
        validFrom,
        verifiedAt,
        tx: transaction,
      }),
    );
  }

  const trimmedVatNumber = vatNumber?.trim() || null;
  const current = await client.resellerVatRegistration.findFirst({
    where: {
      resellerProfileId,
      endedAt: null,
    },
    orderBy: {
      validFrom: 'desc',
    },
  });

  const isUnchanged =
    current &&
    current.status === status &&
    (current.vatNumber ?? null) === trimmedVatNumber;

  if (isUnchanged) {
    return current;
  }

  if (current) {
    await client.resellerVatRegistration.update({
      where: { id: current.id },
      data: {
        endedAt: validFrom,
      },
    });
  }

  return client.resellerVatRegistration.create({
    data: {
      resellerProfileId,
      status,
      vatNumber: status === 'REGISTERED' ? trimmedVatNumber : null,
      validFrom,
      verifiedAt: status === 'REGISTERED' ? verifiedAt : null,
    },
  });
};

export const resolveResellerVatRegistrationAsOf = async ({
  resellerProfileId,
  asOf = new Date(),
}: {
  resellerProfileId: string;
  asOf?: Date;
}) => {
  const { prisma } = await import('@documenso/prisma');

  const registration = await prisma.resellerVatRegistration.findFirst({
    where: {
      resellerProfileId,
      validFrom: { lte: asOf },
      OR: [{ endedAt: null }, { endedAt: { gt: asOf } }],
    },
    orderBy: {
      validFrom: 'desc',
    },
  });

  return registration;
};

import type { Prisma, ResellerVatRegistration, ResellerVatStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

type TxClient = Prisma.TransactionClient;

export type RecordResellerVatRegistrationOptions = {
  resellerProfileId: string;
  status: ResellerVatStatus;
  vatNumber?: string | null;
  validFrom?: Date;
  verifiedAt?: Date | null;
  tx?: TxClient;
};

const writeResellerVatRegistrationChange = async (
  client: TxClient,
  {
    resellerProfileId,
    status,
    vatNumber,
    validFrom = new Date(),
    verifiedAt = status === 'REGISTERED' ? validFrom : null,
  }: Omit<RecordResellerVatRegistrationOptions, 'tx'>,
): Promise<ResellerVatRegistration> => {
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

/**
 * Closes the open VAT registration period (if any) and opens a new one when
 * status/number change. Used so invoices can resolve seller VAT as-of date.
 */
export const recordResellerVatRegistrationChange = async ({
  tx,
  ...options
}: RecordResellerVatRegistrationOptions): Promise<ResellerVatRegistration> => {
  if (tx) {
    return writeResellerVatRegistrationChange(tx, options);
  }

  return prisma.$transaction((transaction) =>
    writeResellerVatRegistrationChange(transaction, options),
  );
};

export const resolveResellerVatRegistrationAsOf = async ({
  resellerProfileId,
  asOf = new Date(),
}: {
  resellerProfileId: string;
  asOf?: Date;
}): Promise<ResellerVatRegistration | null> => {
  return prisma.resellerVatRegistration.findFirst({
    where: {
      resellerProfileId,
      validFrom: { lte: asOf },
      OR: [{ endedAt: null }, { endedAt: { gt: asOf } }],
    },
    orderBy: {
      validFrom: 'desc',
    },
  });
};

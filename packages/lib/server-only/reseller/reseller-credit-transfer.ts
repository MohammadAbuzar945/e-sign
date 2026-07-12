import { ResellerCreditTransactionStatus, type Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

type TransactionClient = Prisma.TransactionClient;

type OrganisationCreditsTarget = {
  organisationId: string;
  ownerUserId: number;
};

const ensureActiveOrganisationCredits = async (
  tx: TransactionClient,
  { organisationId, ownerUserId }: OrganisationCreditsTarget,
) => {
  let creditsRow = await tx.userCredits.findFirst({
    where: {
      organisationId,
      isActive: true,
    },
  });

  if (!creditsRow) {
    creditsRow = await tx.userCredits.create({
      data: {
        userId: ownerUserId,
        organisationId,
        credits: 0,
        isActive: true,
      },
    });
  }

  return creditsRow;
};

export const atomicDecrementOrganisationCredits = async (
  tx: TransactionClient,
  {
    organisationId,
    ownerUserId,
    amount,
    allowNegative = false,
  }: OrganisationCreditsTarget & {
    amount: number;
    allowNegative?: boolean;
  },
) => {
  if (amount <= 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Credit amount must be positive',
    });
  }

  const creditsRow = await ensureActiveOrganisationCredits(tx, {
    organisationId,
    ownerUserId,
  });

  if (!allowNegative) {
    const decrementResult = await tx.userCredits.updateMany({
      where: {
        id: creditsRow.id,
        credits: {
          gte: amount,
        },
      },
      data: {
        credits: {
          decrement: amount,
        },
        lastUpdatedAt: new Date(),
      },
    });

    if (decrementResult.count === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Insufficient reseller credits',
      });
    }
  } else {
    await tx.userCredits.update({
      where: {
        id: creditsRow.id,
      },
      data: {
        credits: {
          decrement: amount,
        },
        lastUpdatedAt: new Date(),
      },
    });
  }

  return tx.userCredits.findUniqueOrThrow({
    where: {
      id: creditsRow.id,
    },
  });
};

export const atomicIncrementOrganisationCredits = async (
  tx: TransactionClient,
  {
    organisationId,
    ownerUserId,
    amount,
  }: OrganisationCreditsTarget & {
    amount: number;
  },
) => {
  if (amount <= 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Credit amount must be positive',
    });
  }

  const creditsRow = await ensureActiveOrganisationCredits(tx, {
    organisationId,
    ownerUserId,
  });

  return tx.userCredits.update({
    where: {
      id: creditsRow.id,
    },
    data: {
      credits: {
        increment: amount,
      },
      lastUpdatedAt: new Date(),
    },
  });
};

export const releaseResellerCreditReservation = async ({
  transactionId,
  paystackReference,
}: {
  transactionId?: string;
  paystackReference?: string;
}) => {
  if (!transactionId && !paystackReference) {
    return { released: false as const };
  }

  return prisma.$transaction(async (tx) => {
    const pendingTransaction = transactionId
      ? await tx.resellerCreditTransaction.findUnique({
          where: {
            id: transactionId,
          },
        })
      : await tx.resellerCreditTransaction.findUnique({
          where: {
            paystackReference,
          },
        });

    if (!pendingTransaction || pendingTransaction.status !== ResellerCreditTransactionStatus.PENDING) {
      return { released: false as const };
    }

    const resellerOrganisation = await tx.organisation.findUniqueOrThrow({
      where: {
        id: pendingTransaction.resellerOrganisationId,
      },
      select: {
        ownerUserId: true,
      },
    });

    await atomicIncrementOrganisationCredits(tx, {
      organisationId: pendingTransaction.resellerOrganisationId,
      ownerUserId: resellerOrganisation.ownerUserId,
      amount: pendingTransaction.credits,
    });

    await tx.resellerCreditTransaction.update({
      where: {
        id: pendingTransaction.id,
      },
      data: {
        status: ResellerCreditTransactionStatus.FAILED,
      },
    });

    return {
      released: true as const,
      transactionId: pendingTransaction.id,
    };
  });
};

import { ResellerCreditTransactionStatus, type Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

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

export const tryAtomicDecrementOrganisationCredits = async (
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
    return false;
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

    return decrementResult.count > 0;
  }

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

  return true;
};

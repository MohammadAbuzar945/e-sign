import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetUserByIdOptions {
  id: number;
}

export const getUserById = async ({ id }: GetUserByIdOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      roles: true,
      disabled: true,
      twoFactorEnabled: true,
      signature: true,
      maxOrganisationCount: true,
    } as {
      id: boolean;
      name: boolean;
      email: boolean;
      emailVerified: boolean;
      roles: boolean;
      disabled: boolean;
      twoFactorEnabled: boolean;
      signature: boolean;
      maxOrganisationCount: boolean;
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return user;
};

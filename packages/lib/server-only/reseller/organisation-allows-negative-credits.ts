import { ResellerProfileStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export const organisationAllowsNegativeCredits = async (organisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: {
      organisationId,
    },
    select: {
      status: true,
      allowNegativeCredits: true,
    },
  });

  return (
    profile?.status === ResellerProfileStatus.ACTIVE && profile.allowNegativeCredits === true
  );
};

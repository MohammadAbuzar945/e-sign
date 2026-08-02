import { ResellerProfileStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type ResellerNotifyRecipient = {
  email: string;
  name: string;
  organisationName: string;
  resellerProfileId: string;
};

/**
 * Prefer the organisation owner (e-sign account) email.
 * Never use payout `contactEmail`.
 */
const resolveRecipientEmail = ({
  ownerEmail,
  applicantUserEmail,
}: {
  ownerEmail: string | null | undefined;
  applicantUserEmail: string | null | undefined;
}) => {
  const candidates = [ownerEmail, applicantUserEmail];

  for (const candidate of candidates) {
    const email = candidate?.trim().toLowerCase();

    if (email) {
      return email;
    }
  }

  return null;
};

const resolveRecipientName = ({
  ownerName,
  applicantUserName,
  organisationName,
}: {
  ownerName: string | null | undefined;
  applicantUserName: string | null | undefined;
  organisationName: string;
}) => {
  const candidates = [ownerName, applicantUserName];

  for (const candidate of candidates) {
    const name = candidate?.trim();

    if (name) {
      return name;
    }
  }

  return organisationName;
};

export const getResellerNotifyRecipients = async (): Promise<ResellerNotifyRecipient[]> => {
  const profiles = await prisma.resellerProfile.findMany({
    where: {
      status: ResellerProfileStatus.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      organisation: {
        select: {
          name: true,
          owner: {
            select: {
              email: true,
              name: true,
            },
          },
          resellerApplication: {
            select: {
              applicantUser: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      organisation: {
        name: 'asc',
      },
    },
  });

  const recipientsByEmail = new Map<string, ResellerNotifyRecipient>();

  for (const profile of profiles) {
    const application = profile.organisation.resellerApplication;
    const email = resolveRecipientEmail({
      ownerEmail: profile.organisation.owner.email,
      applicantUserEmail: application?.applicantUser.email,
    });

    if (!email || recipientsByEmail.has(email)) {
      continue;
    }

    recipientsByEmail.set(email, {
      email,
      name: resolveRecipientName({
        ownerName: profile.organisation.owner.name,
        applicantUserName: application?.applicantUser.name,
        organisationName: profile.organisation.name,
      }),
      organisationName: profile.organisation.name,
      resellerProfileId: profile.id,
    });
  }

  return [...recipientsByEmail.values()];
};

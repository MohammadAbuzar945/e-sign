import { ResellerProfileStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type ResellerNotifyRecipient = {
  email: string;
  name: string;
  organisationName: string;
  resellerProfileId: string;
};

const resolveRecipientEmail = ({
  contactEmail,
  snapshotApplicantEmail,
  applicantUserEmail,
  ownerEmail,
}: {
  contactEmail: string | null;
  snapshotApplicantEmail: string | null | undefined;
  applicantUserEmail: string | null | undefined;
  ownerEmail: string | null | undefined;
}) => {
  const candidates = [contactEmail, snapshotApplicantEmail, applicantUserEmail, ownerEmail];

  for (const candidate of candidates) {
    const email = candidate?.trim().toLowerCase();

    if (email) {
      return email;
    }
  }

  return null;
};

const resolveRecipientName = ({
  snapshotApplicantName,
  applicantUserName,
  ownerName,
  organisationName,
}: {
  snapshotApplicantName: string | null | undefined;
  applicantUserName: string | null | undefined;
  ownerName: string | null | undefined;
  organisationName: string;
}) => {
  const candidates = [snapshotApplicantName, applicantUserName, ownerName];

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
      contactEmail: true,
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
              snapshotApplicantEmail: true,
              snapshotApplicantName: true,
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
      contactEmail: profile.contactEmail,
      snapshotApplicantEmail: application?.snapshotApplicantEmail,
      applicantUserEmail: application?.applicantUser.email,
      ownerEmail: profile.organisation.owner.email,
    });

    if (!email || recipientsByEmail.has(email)) {
      continue;
    }

    recipientsByEmail.set(email, {
      email,
      name: resolveRecipientName({
        snapshotApplicantName: application?.snapshotApplicantName,
        applicantUserName: application?.applicantUser.name,
        ownerName: profile.organisation.owner.name,
        organisationName: profile.organisation.name,
      }),
      organisationName: profile.organisation.name,
      resellerProfileId: profile.id,
    });
  }

  return [...recipientsByEmail.values()];
};

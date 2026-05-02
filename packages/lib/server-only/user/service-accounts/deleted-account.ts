import { prisma } from '@documenso/prisma';

/** Email of the service account used for deleted-user data. Excluded from admin user lists. */
export const DELETED_ACCOUNT_SERVICE_ACCOUNT_EMAIL =
  'abuzarmohammad945+service-account@gmail.com' as const;

/** Additional internal emails excluded from admin user lists. */
export const DELETED_ACCOUNT_EMAIL = 'abuzarmohammad945+deleted-account@gmail.com' as const;

/** All emails hidden from the admin panel users list. */
export const ADMIN_HIDDEN_USER_EMAILS = [
  DELETED_ACCOUNT_SERVICE_ACCOUNT_EMAIL,
  DELETED_ACCOUNT_EMAIL,
] as const;

export const deletedAccountServiceAccount = async () => {
  const serviceAccount = await prisma.user.findFirst({
    where: {
      email: DELETED_ACCOUNT_SERVICE_ACCOUNT_EMAIL,
    },
    select: {
      id: true,
      email: true,
      ownedOrganisations: {
        select: {
          id: true,
          teams: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!serviceAccount) {
    throw new Error(
      'Deleted account service account not found, have you ran the appropriate migrations?',
    );
  }

  return serviceAccount;
};

export const migrateDeletedAccountServiceAccount = async () => {
  const deletedAccountServiceAccountData = await deletedAccountServiceAccount();
  if (deletedAccountServiceAccountData.email !== DELETED_ACCOUNT_SERVICE_ACCOUNT_EMAIL) {
    console.log(
      `Migrating deleted account service account to new email: ${deletedAccountServiceAccount()}`,
    );


  }
};

import { ResellerSubaccountStatus } from '@prisma/client';

import {
  createPaystackSubaccount,
  updatePaystackSubaccount,
} from '@documenso/lib/server-only/paystack';

export type RegisterResellerPaystackSubaccountOptions = {
  organisationName: string;
  affiliateSlug: string;
  bankCode: string;
  accountNumber: string;
  platformFeePercent?: unknown;
  existingSubaccountCode?: string | null;
};

export const registerResellerPaystackSubaccount = async ({
  organisationName,
  affiliateSlug,
  bankCode,
  accountNumber,
  platformFeePercent,
  existingSubaccountCode,
}: RegisterResellerPaystackSubaccountOptions) => {
  const description = `Nomia reseller: ${affiliateSlug}`;
  const percentageCharge = Number(platformFeePercent ?? 0);

  const subaccount = existingSubaccountCode
    ? await updatePaystackSubaccount({
        subaccountCode: existingSubaccountCode,
        businessName: organisationName,
        settlementBank: bankCode,
        accountNumber,
        percentageCharge,
        description,
      })
    : await createPaystackSubaccount({
        businessName: organisationName,
        settlementBank: bankCode,
        accountNumber,
        percentageCharge,
        description,
      });

  const isVerified = subaccount.is_verified === true;

  return {
    subaccount,
    subaccountStatus: isVerified
      ? ResellerSubaccountStatus.ACTIVE
      : ResellerSubaccountStatus.PENDING,
    subaccountVerifiedAt: isVerified ? new Date() : null,
  };
};

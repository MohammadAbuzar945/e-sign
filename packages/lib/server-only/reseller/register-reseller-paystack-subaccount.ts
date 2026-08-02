import { ResellerSubaccountStatus } from '@prisma/client';

import {
  createPaystackSubaccount,
  updatePaystackSubaccount,
} from '@documenso/lib/server-only/paystack';

export type RegisterResellerPaystackSubaccountOptions = {
  /** Account holder / business name from payout settings (Paystack `business_name`). */
  businessName: string;
  affiliateSlug: string;
  bankCode: string;
  accountNumber: string;
  platformFeePercent?: unknown;
  existingSubaccountCode?: string | null;
};

export const registerResellerPaystackSubaccount = async ({
  businessName,
  affiliateSlug,
  bankCode,
  accountNumber,
  platformFeePercent,
  existingSubaccountCode,
}: RegisterResellerPaystackSubaccountOptions) => {
  const description = `Nomia reseller: ${affiliateSlug}`;
  const percentageCharge = Number(platformFeePercent ?? 0);
  const trimmedBusinessName = businessName.trim();

  const subaccount = existingSubaccountCode
    ? await updatePaystackSubaccount({
        subaccountCode: existingSubaccountCode,
        businessName: trimmedBusinessName,
        settlementBank: bankCode,
        accountNumber,
        percentageCharge,
        description,
      })
    : await createPaystackSubaccount({
        businessName: trimmedBusinessName,
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

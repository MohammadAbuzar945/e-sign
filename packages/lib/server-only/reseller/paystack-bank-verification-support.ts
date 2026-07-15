import {
  type ResellerBankAccountType,
  isAccountTypeSupportedByBank,
} from '@documenso/lib/constants/reseller-bank-verification';
import { listPaystackBanks } from '@documenso/lib/server-only/paystack';

export const bankSupportsPaystackAccountValidation = async (
  bankCode: string,
  accountType: ResellerBankAccountType,
): Promise<boolean> => {
  const banks = await listPaystackBanks({ enabledForVerification: true });
  const bank = banks.find((item) => item.code === bankCode);

  if (!bank) {
    return false;
  }

  return isAccountTypeSupportedByBank(accountType, bank.supportedTypes);
};

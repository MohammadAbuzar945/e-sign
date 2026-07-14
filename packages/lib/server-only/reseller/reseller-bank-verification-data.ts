import type { Prisma } from '@prisma/client';

import type {
  ResellerBankAccountType,
  ResellerBankDocumentType,
} from '@documenso/lib/constants/reseller-bank-verification';

import { encryptResellerSecret } from './reseller-secrets';

type ResellerBankVerificationStoreInput = {
  accountType: ResellerBankAccountType;
  documentType: ResellerBankDocumentType;
  documentNumber: string;
};

export const buildResellerBankVerificationUpdateData = ({
  accountType,
  documentType,
  documentNumber,
}: ResellerBankVerificationStoreInput): Prisma.ResellerProfileUpdateInput => {
  return {
    bankAccountType: accountType,
    bankDocumentType: documentType,
    bankDocumentNumber: encryptResellerSecret(documentNumber.trim()),
  } as Prisma.ResellerProfileUpdateInput;
};

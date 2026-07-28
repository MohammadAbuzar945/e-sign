import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

/**
 * Production Paystack / live plan codes are used only on e-sign.nomiadocs.com.
 * Everywhere else uses test plan codes.
 */
export const isNomiaLivePaystackEnv = (baseUrl = NEXT_PUBLIC_WEBAPP_URL()) => {
  try {
    return new URL(baseUrl).hostname === 'e-sign.nomiadocs.com';
  } catch {
    return baseUrl.includes('e-sign.nomiadocs.com');
  }
};

export const isNomiaTestPaystackEnv = (baseUrl = NEXT_PUBLIC_WEBAPP_URL()) =>
  !isNomiaLivePaystackEnv(baseUrl);

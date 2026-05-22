import { getIpAddress } from '@documenso/lib/universal/get-ip-address';

import { env } from './env';

export const getApiRateLimitExemptIps = (): Set<string> => {
  const raw = env('NEXT_PRIVATE_API_RATE_LIMIT_EXEMPT_IPS') ?? '';

  return new Set(
    raw
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  );
};

export const isApiRateLimitExemptIp = (ip: string): boolean => {
  return getApiRateLimitExemptIps().has(ip);
};

export const shouldSkipApiRateLimit = (req: Request): boolean => {
  try {
    return isApiRateLimitExemptIp(getIpAddress(req));
  } catch {
    return false;
  }
};

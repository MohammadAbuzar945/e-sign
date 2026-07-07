import { ZClaimFlagsSchema, type TClaimFlags } from '../types/subscription';

export const parseClaimFlags = (flags: unknown): TClaimFlags => {
  const result = ZClaimFlagsSchema.safeParse(flags);

  if (!result.success) {
    return {};
  }

  return result.data;
};

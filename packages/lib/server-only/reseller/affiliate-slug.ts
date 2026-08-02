import type { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  getSuggestedAffiliateSlug,
  normalizeAffiliateSlugInput,
  validateAffiliateSlug,
} from '@documenso/lib/utils/affiliate-slug';
import { prisma } from '@documenso/prisma';
import { nanoid } from 'nanoid';

type AffiliateSlugLookupClient = Pick<typeof prisma, 'resellerProfile'>;

export const isAffiliateSlugAvailable = async ({
  affiliateSlug,
  excludeOrganisationId,
  client = prisma,
}: {
  affiliateSlug: string;
  excludeOrganisationId?: string;
  client?: AffiliateSlugLookupClient;
}) => {
  const existing = await client.resellerProfile.findUnique({
    where: { affiliateSlug },
    select: { organisationId: true },
  });

  if (!existing) {
    return true;
  }

  if (excludeOrganisationId && existing.organisationId === excludeOrganisationId) {
    return true;
  }

  return false;
};

export const checkResellerAffiliateSlugAvailability = async ({
  organisationId,
  affiliateSlug,
}: {
  organisationId: string;
  affiliateSlug: string;
}) => {
  const validation = validateAffiliateSlug(affiliateSlug);

  if (!validation.valid) {
    return {
      isValid: false,
      isAvailable: false,
      normalizedSlug: normalizeAffiliateSlugInput(affiliateSlug),
      message: validation.message,
    };
  }

  const isAvailable = await isAffiliateSlugAvailable({
    affiliateSlug: validation.slug,
    excludeOrganisationId: organisationId,
  });

  return {
    isValid: true,
    isAvailable,
    normalizedSlug: validation.slug,
    message: isAvailable ? null : 'This affiliate URL is already in use.',
  };
};

export const updateResellerAffiliateSlug = async ({
  organisationId,
  affiliateSlug,
}: {
  organisationId: string;
  affiliateSlug: string;
}) => {
  const validation = validateAffiliateSlug(affiliateSlug);

  if (!validation.valid) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: validation.message,
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (profile.affiliateSlug === validation.slug) {
    return profile;
  }

  const isAvailable = await isAffiliateSlugAvailable({
    affiliateSlug: validation.slug,
    excludeOrganisationId: organisationId,
  });

  if (!isAvailable) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This affiliate URL is already in use. Please choose another.',
    });
  }

  return await prisma.resellerProfile.update({
    where: { organisationId },
    data: { affiliateSlug: validation.slug },
  });
};

export const resolveInitialAffiliateSlug = async ({
  orgUrl,
  client,
}: {
  orgUrl: string;
  client: Pick<Prisma.TransactionClient, 'resellerProfile'>;
}) => {
  const suggestedSlug = getSuggestedAffiliateSlug(orgUrl);

  if (suggestedSlug) {
    const isAvailable = await isAffiliateSlugAvailable({
      affiliateSlug: suggestedSlug,
      client,
    });

    if (isAvailable) {
      return suggestedSlug;
    }
  }

  const base = normalizeAffiliateSlugInput(orgUrl) || 'reseller';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${nanoid(6)}`;
    const validation = validateAffiliateSlug(candidate);

    if (!validation.valid) {
      continue;
    }

    const isAvailable = await isAffiliateSlugAvailable({
      affiliateSlug: validation.slug,
      client,
    });

    if (isAvailable) {
      return validation.slug;
    }
  }

  return `${base}-${nanoid(10)}`;
};

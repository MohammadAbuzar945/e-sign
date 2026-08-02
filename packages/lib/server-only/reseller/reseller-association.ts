import type { ResellerAssociationSource, ResellerProfileStatus } from '@prisma/client';
import { ResellerProfileStatus as ProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { syncResellerDelinquencyState } from './reseller-delinquency';

export type AssociateOrganisationWithResellerOptions = {
  organisationId: string;
  resellerProfileId: string;
  source: ResellerAssociationSource;
  /**
   * When true, allows re-association after delinquency revocation (agreement §12.5).
   */
  customerConsent?: boolean;
};

const ASSOCIATION_SOURCE_PRIORITY: Record<ResellerAssociationSource, number> = {
  AFFILIATE_VISIT: 1,
  CUSTOMER_CONSENT: 2,
  AFFILIATE_PURCHASE: 3,
  AFFILIATE_SIGNUP: 4,
};

const shouldUpgradeAssociationSource = (
  current: ResellerAssociationSource | null | undefined,
  next: ResellerAssociationSource,
) => {
  if (!current) {
    return true;
  }

  // Affiliate signup is permanent for that org↔reseller link — never overwrite it.
  if (current === 'AFFILIATE_SIGNUP') {
    return false;
  }

  return ASSOCIATION_SOURCE_PRIORITY[next] > ASSOCIATION_SOURCE_PRIORITY[current];
};

const resolvePersistedAssociationSource = ({
  current,
  next,
}: {
  current: ResellerAssociationSource | null | undefined;
  next: ResellerAssociationSource;
}) => {
  if (current === 'AFFILIATE_SIGNUP') {
    return 'AFFILIATE_SIGNUP' as const;
  }

  return next;
};

/**
 * Sticky customer↔reseller attribution (agreement §8.2).
 * Does not overwrite an existing different association unless customerConsent is set
 * after delinquency reconsent was required.
 */
export const associateOrganisationWithReseller = async ({
  organisationId,
  resellerProfileId,
  source,
  customerConsent = false,
}: AssociateOrganisationWithResellerOptions) => {
  const [organisation, profile] = await Promise.all([
    prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        id: true,
        associatedResellerProfileId: true,
        resellerRequiresReconsent: true,
        resellerAssociationSource: true,
      },
    }),
    prisma.resellerProfile.findUnique({
      where: { id: resellerProfileId },
      select: {
        id: true,
        status: true,
        organisationId: true,
        isDelinquent: true,
        affiliateSlug: true,
      },
    }),
  ]);

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found' });
  }

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Reseller not found' });
  }

  if (profile.organisationId === organisationId) {
    return { associated: false as const, reason: 'SELF' as const };
  }

  // Reseller organisations may remain affiliated with the reseller they signed up
  // through (and can opt into sticky billing on that /r page).

  if (profile.status !== ProfileStatus.ACTIVE) {
    return { associated: false as const, reason: 'RESELLER_INACTIVE' as const };
  }

  await syncResellerDelinquencyState(profile.id);

  const freshProfile = await prisma.resellerProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: { isDelinquent: true },
  });

  // Delinquent resellers: new sticky association only with explicit consent (§12.5).
  if (freshProfile.isDelinquent && !customerConsent) {
    return { associated: false as const, reason: 'DELINQUENT_NEEDS_CONSENT' as const };
  }

  if (organisation.resellerRequiresReconsent && !customerConsent) {
    return { associated: false as const, reason: 'NEEDS_RECONSENT' as const };
  }

  if (
    organisation.associatedResellerProfileId &&
    organisation.associatedResellerProfileId !== resellerProfileId &&
    !customerConsent
  ) {
    return { associated: false as const, reason: 'ALREADY_ASSOCIATED' as const };
  }

  if (
    organisation.associatedResellerProfileId === resellerProfileId &&
    !organisation.resellerRequiresReconsent
  ) {
    // Never replace AFFILIATE_SIGNUP with purchase/visit/consent sources.
    if (organisation.resellerAssociationSource === 'AFFILIATE_SIGNUP') {
      return { associated: true as const, reason: 'ALREADY_SET' as const };
    }

    if (shouldUpgradeAssociationSource(organisation.resellerAssociationSource, source)) {
      await prisma.organisation.update({
        where: { id: organisationId },
        data: {
          resellerAssociationSource: source,
          ...(source === 'AFFILIATE_SIGNUP' || source === 'CUSTOMER_CONSENT'
            ? { resellerStickyBillingOptIn: true }
            : {}),
        },
      });

      return { associated: true as const, reason: 'SOURCE_UPGRADED' as const };
    }

    return { associated: true as const, reason: 'ALREADY_SET' as const };
  }

  const persistedSource = resolvePersistedAssociationSource({
    current: organisation.resellerAssociationSource,
    next: source,
  });

  await prisma.organisation.update({
    where: { id: organisationId },
    data: {
      associatedResellerProfileId: resellerProfileId,
      resellerAssociatedAt: new Date(),
      resellerAssociationSource: persistedSource,
      resellerRequiresReconsent: false,
      // Signup / explicit reconsent turn sticky billing ON; visits stay OFF by default.
      ...(persistedSource === 'AFFILIATE_SIGNUP' || source === 'CUSTOMER_CONSENT'
        ? { resellerStickyBillingOptIn: true }
        : {}),
    },
  });

  return { associated: true as const, reason: 'ASSOCIATED' as const };
};

export const clearOrganisationResellerAssociation = async ({
  organisationId,
  requireReconsent = false,
}: {
  organisationId: string;
  requireReconsent?: boolean;
}) => {
  await prisma.organisation.update({
    where: { id: organisationId },
    data: {
      associatedResellerProfileId: null,
      resellerAssociatedAt: null,
      resellerAssociationSource: null,
      resellerRequiresReconsent: requireReconsent,
      resellerStickyBillingOptIn: false,
    },
  });
};

export const getOrganisationResellerAssociation = async (organisationId: string) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      id: true,
      associatedResellerProfileId: true,
      resellerAssociatedAt: true,
      resellerAssociationSource: true,
      resellerRequiresReconsent: true,
      associatedResellerProfile: {
        select: {
          id: true,
          affiliateSlug: true,
          status: true,
          isDelinquent: true,
          organisation: { select: { name: true } },
          brandingCompanyDetails: true,
        },
      },
    },
  });

  if (!organisation) {
    return null;
  }

  if (organisation.associatedResellerProfileId) {
    await syncResellerDelinquencyState(organisation.associatedResellerProfileId);
  }

  return prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      id: true,
      associatedResellerProfileId: true,
      resellerAssociatedAt: true,
      resellerAssociationSource: true,
      resellerRequiresReconsent: true,
      associatedResellerProfile: {
        select: {
          id: true,
          affiliateSlug: true,
          status: true,
          isDelinquent: true,
          organisation: { select: { name: true } },
          brandingCompanyDetails: true,
        },
      },
    },
  });
};

export { extractAffiliateSlugFromPath } from '@documenso/lib/utils/affiliate-slug';

type AffiliateSignupVerificationMetadata = {
  affiliateSlug?: string;
};

export const parseAffiliateSignupVerificationMetadata = (
  metadata: unknown,
): AffiliateSignupVerificationMetadata | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const affiliateSlug = 'affiliateSlug' in metadata ? metadata.affiliateSlug : undefined;

  if (typeof affiliateSlug !== 'string' || !affiliateSlug.trim()) {
    return null;
  }

  return { affiliateSlug: affiliateSlug.trim() };
};

/**
 * Sticky association when a customer completes email verification after affiliate signup.
 */
export const associateAffiliateSignupOnEmailVerification = async ({
  userId,
  affiliateSlug,
}: {
  userId: number;
  affiliateSlug: string;
}) => {
  const organisation = await prisma.organisation.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!organisation) {
    return { associated: false as const, reason: 'NO_ORGANISATION' as const };
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    select: { id: true },
  });

  if (!profile) {
    return { associated: false as const, reason: 'NOT_FOUND' as const };
  }

  return associateOrganisationWithReseller({
    organisationId: organisation.id,
    resellerProfileId: profile.id,
    source: 'AFFILIATE_SIGNUP',
  });
};

export const setOrganisationStickyBillingOptIn = async ({
  organisationId,
  affiliateSlug,
  optIn,
}: {
  organisationId: string;
  affiliateSlug: string;
  optIn: boolean;
}) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    select: { id: true, status: true, organisationId: true },
  });

  if (!profile || profile.status !== ProfileStatus.ACTIVE) {
    return { success: false as const, reason: 'RESELLER_INACTIVE' as const };
  }

  if (profile.organisationId === organisationId) {
    return { success: false as const, reason: 'SELF' as const };
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      associatedResellerProfileId: true,
    },
  });

  if (!organisation) {
    return { success: false as const, reason: 'NOT_FOUND' as const };
  }

  // Reseller orgs may still affiliate with the reseller they signed up through.
  // Only block opting into your own affiliate page (SELF above).

  if (optIn) {
    const associateResult = await associateOrganisationWithReseller({
      organisationId,
      resellerProfileId: profile.id,
      source: 'CUSTOMER_CONSENT',
      customerConsent: true,
    });

    if (!associateResult.associated) {
      return { success: false as const, reason: associateResult.reason };
    }

    await prisma.organisation.update({
      where: { id: organisationId },
      data: { resellerStickyBillingOptIn: true },
    });

    return { success: true as const, stickyBillingOptIn: true as const };
  }

  await prisma.organisation.update({
    where: { id: organisationId },
    data: { resellerStickyBillingOptIn: false },
  });

  return { success: true as const, stickyBillingOptIn: false as const };
};

export const resolveResellerDisplayName = (profile: {
  organisation: { name: string };
  brandingCompanyDetails: string | null;
}): string => {
  const brandingLine = profile.brandingCompanyDetails?.split('\n')[0]?.trim();

  if (brandingLine) {
    return brandingLine;
  }

  return profile.organisation.name;
};

export const isResellerProfileActiveForBilling = (
  status: ResellerProfileStatus,
  isDelinquent: boolean,
): boolean => {
  // Delinquent: sticky billing disabled; affiliate link purchases still allowed (§12.4).
  return status === ProfileStatus.ACTIVE && !isDelinquent;
};

export const getResellerAvailableCredits = async (resellerOrganisationId: string) => {
  return getOrganisationCredits(resellerOrganisationId);
};

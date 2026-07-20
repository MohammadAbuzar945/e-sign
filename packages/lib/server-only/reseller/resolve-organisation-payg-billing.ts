import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import {
  RESELLER_BILLING_DISCLOSURE_PREFIX,
} from '@documenso/lib/constants/reseller-attribution';
import { prisma } from '@documenso/prisma';

import { getResellerPayoutReadiness } from './reseller-payout-readiness';
import {
  isResellerProfileActiveForBilling,
  resolveResellerDisplayName,
} from './reseller-association';
import { syncResellerDelinquencyState } from './reseller-delinquency';

export type OrganisationPaygBillingSource = 'RESELLER' | 'NOMIA' | 'HYBRID';

export type OrganisationPaygBillingResolution = {
  source: OrganisationPaygBillingSource;
  reason:
    | 'NO_ASSOCIATION'
    | 'NEEDS_RECONSENT'
    | 'RESELLER_INACTIVE'
    | 'RESELLER_DELINQUENT'
    | 'PAYOUT_NOT_READY'
    | 'PACKAGE_DISABLED'
    | 'FULL_RESELLER'
    | 'ZERO_STOCK_NOMIA'
    | 'PARTIAL_SPLIT'
    | 'INSUFFICIENT_USE_NOMIA';
  disclosure: string | null;
  resellerDisplayName: string | null;
  affiliateSlug: string | null;
  resellerProfileId: string | null;
  /** Full package from reseller when source is RESELLER. */
  resellerPackage: {
    id: string;
    catalogPackageId: string;
    creditAmount: number;
    priceInCents: number;
    currency: string;
    displayPrice: string;
    name: string;
  } | null;
  /** Hybrid split when reseller has some but not all credits (§10.3). */
  split: {
    resellerCredits: number;
    resellerAmountInCents: number;
    nomiaCredits: number;
    nomiaAmountInCents: number;
    resellerPackageId: string;
    catalogPackageId: string;
  } | null;
};

const findCatalogPackage = (catalogPackageId: string) =>
  ESIGN_CREDIT_PACKAGES.find((item) => item.id === catalogPackageId);

const findNomiaPriceForCredits = (credits: number): number => {
  const exact = ESIGN_CREDIT_PACKAGES.find(
    (item) => item.category === 'pay-as-you-go' && item.credits === credits,
  );

  if (exact) {
    return exact.priceInCents;
  }

  // Pro-rate from the nearest larger PAYG pack, else nearest smaller.
  const payg = ESIGN_CREDIT_PACKAGES.filter((item) => item.category === 'pay-as-you-go').sort(
    (a, b) => a.credits - b.credits,
  );

  const larger = payg.find((item) => item.credits >= credits);
  const basis = larger ?? payg[payg.length - 1];

  if (!basis) {
    return 0;
  }

  return Math.round((basis.priceInCents * credits) / basis.credits);
};

/**
 * Resolves whether an attributed organisation's PAYG purchase should go through
 * the Reseller (Tx B), Nomia direct, or a hybrid split (§8.3, §10.3, §12.1).
 */
export const resolveOrganisationPaygBilling = async ({
  organisationId,
  catalogPackageId,
}: {
  organisationId: string;
  catalogPackageId: string;
}): Promise<OrganisationPaygBillingResolution> => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      associatedResellerProfileId: true,
      resellerRequiresReconsent: true,
      associatedResellerProfile: {
        include: {
          packages: true,
          organisation: { select: { name: true, id: true } },
        },
      },
    },
  });

  const emptyNomia = (
    reason: OrganisationPaygBillingResolution['reason'],
  ): OrganisationPaygBillingResolution => ({
    source: 'NOMIA',
    reason,
    disclosure: null,
    resellerDisplayName: null,
    affiliateSlug: null,
    resellerProfileId: null,
    resellerPackage: null,
    split: null,
  });

  if (!organisation?.associatedResellerProfileId || !organisation.associatedResellerProfile) {
    return emptyNomia(
      organisation?.resellerRequiresReconsent ? 'NEEDS_RECONSENT' : 'NO_ASSOCIATION',
    );
  }

  if (organisation.resellerRequiresReconsent) {
    return emptyNomia('NEEDS_RECONSENT');
  }

  const profile = organisation.associatedResellerProfile;
  await syncResellerDelinquencyState(profile.id);

  const fresh = await prisma.resellerProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      packages: true,
      organisation: { select: { name: true, id: true } },
    },
  });

  // payout readiness uses keys/subaccount fields already on ResellerProfile

  const displayName = resolveResellerDisplayName(fresh);
  const disclosure = `${RESELLER_BILLING_DISCLOSURE_PREFIX} ${displayName}`;

  if (!isResellerProfileActiveForBilling(fresh.status, fresh.isDelinquent)) {
    return {
      ...emptyNomia(fresh.isDelinquent ? 'RESELLER_DELINQUENT' : 'RESELLER_INACTIVE'),
      resellerDisplayName: displayName,
      affiliateSlug: fresh.affiliateSlug,
      resellerProfileId: fresh.id,
      disclosure: null,
    };
  }

  const payout = getResellerPayoutReadiness(fresh);

  if (!payout.canAcceptPayments) {
    return {
      ...emptyNomia('PAYOUT_NOT_READY'),
      resellerDisplayName: displayName,
      affiliateSlug: fresh.affiliateSlug,
      resellerProfileId: fresh.id,
    };
  }

  const resellerPkg = fresh.packages.find(
    (item) => item.catalogPackageId === catalogPackageId && item.isEnabled,
  );

  const catalog = findCatalogPackage(catalogPackageId);

  if (!resellerPkg || !catalog) {
    return {
      ...emptyNomia('PACKAGE_DISABLED'),
      resellerDisplayName: displayName,
      affiliateSlug: fresh.affiliateSlug,
      resellerProfileId: fresh.id,
      disclosure,
    };
  }

  const availableCredits = await getOrganisationCredits(fresh.organisationId);
  const requested = resellerPkg.creditAmount;

  const packagePayload = {
    id: resellerPkg.id,
    catalogPackageId: resellerPkg.catalogPackageId,
    creditAmount: resellerPkg.creditAmount,
    priceInCents: resellerPkg.priceInCents,
    currency: resellerPkg.currency,
    displayPrice: catalog.displayPrice,
    name: catalog.name,
  };

  if (fresh.allowNegativeCredits || availableCredits >= requested) {
    return {
      source: 'RESELLER',
      reason: 'FULL_RESELLER',
      disclosure,
      resellerDisplayName: displayName,
      affiliateSlug: fresh.affiliateSlug,
      resellerProfileId: fresh.id,
      resellerPackage: packagePayload,
      split: null,
    };
  }

  // Zero stock → Nomia direct (§12.1)
  if (availableCredits <= 0) {
    return {
      source: 'NOMIA',
      reason: 'ZERO_STOCK_NOMIA',
      disclosure: null,
      resellerDisplayName: displayName,
      affiliateSlug: fresh.affiliateSlug,
      resellerProfileId: fresh.id,
      resellerPackage: null,
      split: null,
    };
  }

  // Partial stock → split (§10.3–10.4)
  const resellerCredits = availableCredits;
  const nomiaCredits = requested - resellerCredits;
  const resellerAmountInCents = Math.round(
    (resellerPkg.priceInCents * resellerCredits) / requested,
  );
  const nomiaAmountInCents = findNomiaPriceForCredits(nomiaCredits);

  return {
    source: 'HYBRID',
    reason: 'PARTIAL_SPLIT',
    disclosure,
    resellerDisplayName: displayName,
    affiliateSlug: fresh.affiliateSlug,
    resellerProfileId: fresh.id,
    resellerPackage: packagePayload,
    split: {
      resellerCredits,
      resellerAmountInCents,
      nomiaCredits,
      nomiaAmountInCents,
      resellerPackageId: resellerPkg.id,
      catalogPackageId: resellerPkg.catalogPackageId,
    },
  };
};

export const getOrganisationBillingAttributionSummary = async (organisationId: string) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      associatedResellerProfileId: true,
      resellerRequiresReconsent: true,
      resellerAssociatedAt: true,
      resellerAssociationSource: true,
      associatedResellerProfile: {
        select: {
          id: true,
          affiliateSlug: true,
          status: true,
          isDelinquent: true,
          allowNegativeCredits: true,
          organisationId: true,
          organisation: { select: { name: true } },
          brandingCompanyDetails: true,
          packages: {
            where: { isEnabled: true },
            select: {
              id: true,
              catalogPackageId: true,
              creditAmount: true,
              priceInCents: true,
              currency: true,
            },
          },
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

  const profile = organisation.associatedResellerProfileId
    ? await prisma.resellerProfile.findUnique({
        where: { id: organisation.associatedResellerProfileId },
        select: {
          id: true,
          affiliateSlug: true,
          status: true,
          isDelinquent: true,
          allowNegativeCredits: true,
          organisationId: true,
          payoutMode: true,
          paystackPublicKey: true,
          paystackSecretKey: true,
          paystackSubaccountCode: true,
          subaccountStatus: true,
          organisation: { select: { name: true } },
          brandingCompanyDetails: true,
          packages: {
            where: { isEnabled: true },
            select: {
              id: true,
              catalogPackageId: true,
              creditAmount: true,
              priceInCents: true,
              currency: true,
            },
          },
        },
      })
    : null;

  const availableCredits = profile
    ? await getOrganisationCredits(profile.organisationId)
    : 0;

  const payout = profile ? getResellerPayoutReadiness(profile) : null;
  const displayName = profile ? resolveResellerDisplayName(profile) : null;
  const ownResellerProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: { id: true },
  });
  const stickyBillingActive =
    Boolean(profile) &&
    !organisation.resellerRequiresReconsent &&
    profile !== null &&
    isResellerProfileActiveForBilling(profile.status, profile.isDelinquent) &&
    Boolean(payout?.canAcceptPayments);

  return {
    hasAssociation: Boolean(profile),
    requiresReconsent: organisation.resellerRequiresReconsent && Boolean(profile),
    associatedAt: organisation.resellerAssociatedAt,
    associationSource: organisation.resellerAssociationSource,
    stickyBillingActive,
    availableCredits,
    canAcceptPayments: payout?.canAcceptPayments ?? false,
    payoutBlockingReason: payout?.blockingReason ?? null,
    resellerDisplayName: displayName,
    affiliateSlug: profile?.affiliateSlug ?? null,
    resellerProfileId: profile?.id ?? null,
    isResellerOrganisation: Boolean(ownResellerProfile),
    disclosure:
      stickyBillingActive && displayName
        ? `${RESELLER_BILLING_DISCLOSURE_PREFIX} ${displayName}`
        : null,
    isDelinquent: profile?.isDelinquent ?? false,
    packages: (profile?.packages ?? []).map((pkg) => {
      const catalog = findCatalogPackage(pkg.catalogPackageId);
      const hasEnough =
        Boolean(profile?.allowNegativeCredits) || availableCredits >= pkg.creditAmount;

      return {
        ...pkg,
        name: catalog?.name ?? `${pkg.creditAmount} envelopes`,
        displayPrice: catalog?.displayPrice ?? `ZAR ${(pkg.priceInCents / 100).toFixed(2)}`,
        canFulfillFromReseller: hasEnough,
        billingSource: hasEnough
          ? ('RESELLER' as const)
          : availableCredits > 0
            ? ('HYBRID' as const)
            : ('NOMIA' as const),
      };
    }),
  };
};

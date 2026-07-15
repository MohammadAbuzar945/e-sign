import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createPendingOrganisationCreditPurchase } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import {
  associateOrganisationWithReseller,
} from '@documenso/lib/server-only/reseller/reseller-association';
import { initializeResellerPurchase } from '@documenso/lib/server-only/reseller/initialize-reseller-purchase';
import {
  getOrganisationBillingAttributionSummary,
  resolveOrganisationPaygBilling,
} from '@documenso/lib/server-only/reseller/resolve-organisation-payg-billing';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZAssociateResellerRequestSchema,
  ZAssociateResellerResponseSchema,
  ZGetOrganisationBillingAttributionRequestSchema,
  ZGetOrganisationBillingAttributionResponseSchema,
  ZInitializeAttributedPaygRequestSchema,
  ZInitializeAttributedPaygResponseSchema,
  ZResolvePaygBillingRequestSchema,
  ZResolvePaygBillingResponseSchema,
} from './reseller-attribution.types';

const getCatalogPackage = (catalogPackageId: string) =>
  ESIGN_CREDIT_PACKAGES.find((item) => item.id === catalogPackageId);

export const getOrganisationBillingAttributionRoute = authenticatedProcedure
  .input(ZGetOrganisationBillingAttributionRequestSchema)
  .output(ZGetOrganisationBillingAttributionResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    return getOrganisationBillingAttributionSummary(organisationId);
  });

export const resolveOrganisationPaygBillingRoute = authenticatedProcedure
  .input(ZResolvePaygBillingRequestSchema)
  .output(ZResolvePaygBillingResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, catalogPackageId } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    return resolveOrganisationPaygBilling({ organisationId, catalogPackageId });
  });

export const associateOrganisationWithResellerRoute = authenticatedProcedure
  .input(ZAssociateResellerRequestSchema)
  .output(ZAssociateResellerResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, affiliateSlug, source, customerConsent } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    const profile = await prisma.resellerProfile.findUnique({
      where: { affiliateSlug },
      select: { id: true },
    });

    if (!profile) {
      return { associated: false, reason: 'NOT_FOUND' };
    }

    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { resellerRequiresReconsent: true },
    });

    const result = await associateOrganisationWithReseller({
      organisationId,
      resellerProfileId: profile.id,
      source: customerConsent ? 'CUSTOMER_CONSENT' : source,
      customerConsent: Boolean(customerConsent),
    });

    return {
      ...result,
      requiresReconsent: organisation.resellerRequiresReconsent && !result.associated,
    };
  });

export const initializeAttributedPaygPurchaseRoute = authenticatedProcedure
  .input(ZInitializeAttributedPaygRequestSchema)
  .output(ZInitializeAttributedPaygResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, catalogPackageId, hybridStep, nomiaCreditsOverride, nomiaAmountInCentsOverride, purchaseGroupId: purchaseGroupIdInput } =
      input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
    });

    const resolution = await resolveOrganisationPaygBilling({
      organisationId,
      catalogPackageId,
    });

    const orgUrl = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { url: true },
    });

    const pricePlanCallback = `/o/${orgUrl.url}/price-plan?purchase=success`;
    const purchaseGroupId = purchaseGroupIdInput ?? prefixedId('pur');

    // Full Nomia (no association, zero stock, delinquent, etc.) or hybrid Nomia remainder.
    if (resolution.source === 'NOMIA' || hybridStep === 'NOMIA') {
      const catalog = getCatalogPackage(catalogPackageId);
      const nomiaCredits =
        nomiaCreditsOverride ??
        (hybridStep === 'NOMIA' && resolution.split
          ? resolution.split.nomiaCredits
          : catalog?.credits);
      const nomiaAmount =
        nomiaAmountInCentsOverride ??
        (hybridStep === 'NOMIA' && resolution.split
          ? resolution.split.nomiaAmountInCents
          : catalog?.priceInCents);

      if (!nomiaCredits || !nomiaAmount) {
        return {
          source: 'NOMIA' as const,
          disclosure: null,
          resellerDisplayName: resolution.resellerDisplayName,
          authorizationUrl: null,
          reference: null,
          nextNomiaStep: null,
          split: null,
          reason: resolution.reason,
        };
      }

      const transaction = await createTransaction({
        email: user.email,
        amount: nomiaAmount,
        callback_url: `${NEXT_PUBLIC_WEBAPP_URL()}${pricePlanCallback}`,
        metadata: {
          value: nomiaCredits,
          organisationId,
          type: 'organisation-credit-purchase',
          purchaseGroupId,
          ...(hybridStep === 'NOMIA'
            ? { hybridRemainder: true, catalogPackageId }
            : {}),
        },
      });

      if (!transaction.status || !transaction.data) {
        return {
          source: 'NOMIA' as const,
          disclosure: null,
          resellerDisplayName: resolution.resellerDisplayName,
          authorizationUrl: null,
          reference: null,
          nextNomiaStep: null,
          split: null,
          reason: 'PAYSTACK_FAILED',
        };
      }

      await createPendingOrganisationCreditPurchase({
        organisationId,
        userId: ctx.user.id,
        paystackReference: transaction.data.reference,
        credits: nomiaCredits,
        grossAmount: nomiaAmount,
        currency: 'ZAR',
        purchaseGroupId,
      }).catch(() => {
        // Pending row is best-effort; webhook still grants credits from metadata.
      });

      return {
        source: hybridStep === 'NOMIA' ? ('HYBRID' as const) : ('NOMIA' as const),
        disclosure: null,
        resellerDisplayName: resolution.resellerDisplayName,
        authorizationUrl: transaction.data.authorization_url,
        reference: transaction.data.reference,
        nextNomiaStep: null,
        split: resolution.split
          ? {
              resellerCredits: resolution.split.resellerCredits,
              resellerAmountInCents: resolution.split.resellerAmountInCents,
              nomiaCredits: resolution.split.nomiaCredits,
              nomiaAmountInCents: resolution.split.nomiaAmountInCents,
            }
          : null,
        reason: resolution.reason,
      };
    }

    if (!resolution.affiliateSlug || !resolution.resellerPackage) {
      return {
        source: 'NOMIA' as const,
        disclosure: null,
        resellerDisplayName: resolution.resellerDisplayName,
        authorizationUrl: null,
        reference: null,
        nextNomiaStep: null,
        split: null,
        reason: resolution.reason,
      };
    }

    // Full reseller purchase
    if (resolution.source === 'RESELLER') {
      const result = await initializeResellerPurchase({
        affiliateSlug: resolution.affiliateSlug,
        packageId: resolution.resellerPackage.id,
        purchaserOrganisationId: organisationId,
        purchaserUserId: ctx.user.id,
        purchaserEmail: user.email,
        callbackPath: `${pricePlanCallback}&source=reseller`,
        purchaseGroupId,
      });

      return {
        source: 'RESELLER' as const,
        disclosure: resolution.disclosure,
        resellerDisplayName: resolution.resellerDisplayName,
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        nextNomiaStep: null,
        split: null,
        reason: resolution.reason,
      };
    }

    // HYBRID — start reseller portion first (§10.3)
    if (!resolution.split) {
      return {
        source: 'NOMIA' as const,
        disclosure: null,
        resellerDisplayName: resolution.resellerDisplayName,
        authorizationUrl: null,
        reference: null,
        nextNomiaStep: null,
        split: null,
        reason: 'INSUFFICIENT_USE_NOMIA',
      };
    }

    const result = await initializeResellerPurchase({
      affiliateSlug: resolution.affiliateSlug,
      packageId: resolution.split.resellerPackageId,
      purchaserOrganisationId: organisationId,
      purchaserUserId: ctx.user.id,
      purchaserEmail: user.email,
      creditAmountOverride: resolution.split.resellerCredits,
      amountInCentsOverride: resolution.split.resellerAmountInCents,
      purchaseGroupId,
      callbackPath: `${pricePlanCallback}&hybrid=nomia&catalogPackageId=${catalogPackageId}&nomiaCredits=${resolution.split.nomiaCredits}&nomiaAmount=${resolution.split.nomiaAmountInCents}&purchaseGroupId=${purchaseGroupId}`,
    });

    return {
      source: 'HYBRID' as const,
      disclosure: resolution.disclosure,
      resellerDisplayName: resolution.resellerDisplayName,
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      nextNomiaStep: {
        credits: resolution.split.nomiaCredits,
        amountInCents: resolution.split.nomiaAmountInCents,
        catalogPackageId,
      },
      split: {
        resellerCredits: resolution.split.resellerCredits,
        resellerAmountInCents: resolution.split.resellerAmountInCents,
        nomiaCredits: resolution.split.nomiaCredits,
        nomiaAmountInCents: resolution.split.nomiaAmountInCents,
      },
      reason: resolution.reason,
    };
  });

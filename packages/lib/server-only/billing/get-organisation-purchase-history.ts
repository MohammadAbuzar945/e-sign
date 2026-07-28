import {
  OrganisationCreditPurchaseStatus,
  ResellerCreditTransactionStatus,
} from '@prisma/client';

import {
  findNomiaSubscriptionPlanForChargeFromCatalog,
  getNomiaSubscriptionPlanDetailsFromCatalog,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { formatNomiaSubscriptionPlanTitle } from '@documenso/lib/constants/nomia-subscription-plans';
import { prisma } from '@documenso/prisma';

import { getSubscriptionsByUserId } from '../subscription/get-subscriptions-by-user-id';
import { resolveResellerDisplayName } from '../reseller/reseller-association';
import { resolveNomiaPurchaseInvoiceId } from './record-organisation-credit-purchase';

export type PurchaseHistoryLineItem = {
  provider: 'nomia' | 'reseller';
  description: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
};

export type PurchaseInvoiceResellerSeller = {
  name: string;
  physicalAddress: string | null;
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  vatNumber: string | null;
  affiliateSlug: string;
  hasLogo: boolean;
};

export type OrganisationPurchaseHistoryItem = {
  invoiceId: string;
  purchaseGroupId: string | null;
  date: Date;
  kind: 'subscription' | 'pay_as_you_go' | 'reseller' | 'bulk';
  /** Who issues / supplies this invoice document. */
  issuer: 'NOMIA' | 'RESELLER';
  title: string;
  totalCredits: number;
  totalGrossAmount: number;
  currency: string;
  status: string;
  lineItems: PurchaseHistoryLineItem[];
  /** Present when this invoice is issued by a reseller. */
  resellerSeller?: PurchaseInvoiceResellerSeller | null;
  /**
   * Buyer VAT number when the purchasing org is itself a VAT-registered
   * reseller (Nomia tax invoices only). Ordinary orgs never store buyer VAT.
   */
  buyerVatNumber?: string | null;
};

const formatAmount = (currency: string, amountInCents: number) =>
  `${currency} ${(amountInCents / 100).toFixed(2)}`;

const buildNomiaLineItem = ({
  credits,
  grossAmount,
  currency,
  status,
  reference,
  description,
}: {
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
  description: string;
}): PurchaseHistoryLineItem => ({
  provider: 'nomia',
  description,
  credits,
  grossAmount,
  currency,
  status,
  reference,
});

const buildResellerLineItem = ({
  resellerDisplayName,
  credits,
  grossAmount,
  currency,
  status,
  reference,
}: {
  resellerDisplayName: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
}): PurchaseHistoryLineItem => ({
  provider: 'reseller',
  description: `Credits from ${resellerDisplayName}`,
  credits,
  grossAmount,
  currency,
  status,
  reference,
});

const getResellerPurchaseDisplayName = (profile: {
  organisation: { name: string };
  brandingCompanyDetails: string | null;
}) => resolveResellerDisplayName(profile);

const buildResellerSellerDetails = (profile: {
  organisation: { name: string };
  brandingCompanyDetails: string | null;
  physicalAddress: string | null;
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  vatNumber: string | null;
  affiliateSlug: string;
  brandingEnabled: boolean;
  brandingLogo: string | null;
}): PurchaseInvoiceResellerSeller => ({
  name: getResellerPurchaseDisplayName(profile),
  physicalAddress: profile.physicalAddress,
  vatStatus: profile.vatStatus,
  vatNumber: profile.vatNumber,
  affiliateSlug: profile.affiliateSlug,
  hasLogo: Boolean(profile.brandingEnabled && profile.brandingLogo),
});

/**
 * Ordinary organisations do not store buyer VAT.
 * Only when the buyer org is itself a VAT-registered reseller.
 */
export const resolveBuyerVatNumberForOrganisation = async (organisationId: string) => {
  const buyerResellerProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: {
      vatStatus: true,
      vatNumber: true,
    },
  });

  if (
    buyerResellerProfile?.vatStatus === 'REGISTERED' &&
    buyerResellerProfile.vatNumber?.trim()
  ) {
    return buyerResellerProfile.vatNumber.trim();
  }

  return null;
};

export const getOrganisationPurchaseHistory = async ({
  organisationId,
}: {
  organisationId: string;
}): Promise<OrganisationPurchaseHistoryItem[]> => {
  const [subscriptions, payAsYouGoPurchases, resellerPurchases, buyerVatNumber] = await Promise.all([
    getSubscriptionsByUserId({ organisationId }),
    prisma.organisationCreditPurchase.findMany({
      where: {
        organisationId,
        status: {
          in: [
            OrganisationCreditPurchaseStatus.COMPLETED,
            OrganisationCreditPurchaseStatus.PENDING,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.resellerCreditTransaction.findMany({
      where: {
        purchaserOrganisationId: organisationId,
        status: {
          in: [
            ResellerCreditTransactionStatus.COMPLETED,
            ResellerCreditTransactionStatus.PENDING,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        package: {
          select: {
            creditAmount: true,
            catalogPackageId: true,
          },
        },
        resellerProfile: {
          select: {
            affiliateSlug: true,
            brandingEnabled: true,
            brandingLogo: true,
            brandingCompanyDetails: true,
            physicalAddress: true,
            vatStatus: true,
            vatNumber: true,
            organisation: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    resolveBuyerVatNumberForOrganisation(organisationId),
  ]);

  const items: OrganisationPurchaseHistoryItem[] = [];
  let hasSubscriptionChargeInvoices = false;

  for (const purchase of payAsYouGoPurchases) {
    const isBulk = purchase.purchaseType === 'BULK';
    const isSubscription = purchase.purchaseType === 'SUBSCRIPTION';

    if (isSubscription) {
      hasSubscriptionChargeInvoices = true;
    }

    const subscriptionPlan = isSubscription
      ? await findNomiaSubscriptionPlanForChargeFromCatalog({
          credits: purchase.credits,
          priceInCents: purchase.grossAmount,
        })
      : null;

    const title = isBulk
      ? 'Bulk inventory top-up'
      : isSubscription
        ? formatNomiaSubscriptionPlanTitle(subscriptionPlan)
        : 'Pay as you go top-up';

    const kind = isBulk ? 'bulk' : isSubscription ? 'subscription' : 'pay_as_you_go';

    items.push({
      invoiceId: resolveNomiaPurchaseInvoiceId({ purchaseId: purchase.id }),
      purchaseGroupId: purchase.purchaseGroupId,
      date: purchase.completedAt ?? purchase.createdAt,
      kind,
      issuer: 'NOMIA',
      title,
      totalCredits: purchase.credits,
      totalGrossAmount: purchase.grossAmount,
      currency: purchase.currency,
      status: purchase.status,
      buyerVatNumber,
      lineItems: [
        buildNomiaLineItem({
          credits: purchase.credits,
          grossAmount: purchase.grossAmount,
          currency: purchase.currency,
          status: purchase.status,
          reference: isSubscription
            ? (subscriptionPlan?.planCode ?? purchase.paystackReference)
            : purchase.paystackReference,
          description: title,
        }),
      ],
    });
  }

  for (const transaction of resellerPurchases) {
    const resellerDisplayName = getResellerPurchaseDisplayName(transaction.resellerProfile);
    const liveSeller = buildResellerSellerDetails(transaction.resellerProfile);
    const resellerSeller: PurchaseInvoiceResellerSeller = {
      ...liveSeller,
      vatStatus: transaction.sellerVatStatus ?? liveSeller.vatStatus,
      vatNumber: transaction.sellerVatNumber ?? liveSeller.vatNumber,
    };

    items.push({
      invoiceId: `reseller_${transaction.id}`,
      purchaseGroupId: transaction.purchaseGroupId,
      date: transaction.completedAt ?? transaction.createdAt,
      kind: 'reseller',
      issuer: 'RESELLER',
      title: `Credits from ${resellerDisplayName}`,
      totalCredits: transaction.credits,
      totalGrossAmount: transaction.grossAmount,
      currency: transaction.currency,
      status: transaction.status,
      resellerSeller,
      lineItems: [
        buildResellerLineItem({
          resellerDisplayName,
          credits: transaction.credits,
          grossAmount: transaction.grossAmount,
          currency: transaction.currency,
          status: transaction.status,
          reference: transaction.paystackReference,
        }),
      ],
    });
  }

  // Legacy fallback: one synthetic invoice per Subscription row when this org
  // has no per-charge subscription ledger entries yet.
  const subscriptionItems: OrganisationPurchaseHistoryItem[] = hasSubscriptionChargeInvoices
    ? []
    : await Promise.all(
        subscriptions.map(async (subscription) => {
          const planCode = subscription.priceId || subscription.planId;
          const planDetails = await getNomiaSubscriptionPlanDetailsFromCatalog(planCode);
          const credits = planDetails?.credits ?? 0;
          const grossAmount = planDetails?.priceInCents ?? 0;
          const title = formatNomiaSubscriptionPlanTitle(planDetails, planCode);
          const status = subscription.status === 'PAST_DUE' ? 'INCOMPLETE' : subscription.status;

          return {
            invoiceId: `subscription_${subscription.id}`,
            purchaseGroupId: null,
            date: subscription.updatedAt,
            kind: 'subscription' as const,
            issuer: 'NOMIA' as const,
            title,
            totalCredits: credits,
            totalGrossAmount: grossAmount,
            currency: 'ZAR',
            status,
            buyerVatNumber,
            lineItems: [
              {
                provider: 'nomia' as const,
                description: title,
                credits,
                grossAmount,
                currency: 'ZAR',
                status,
                reference: planCode,
              },
            ],
          };
        }),
      );

  return [...subscriptionItems, ...items].sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  );
};

export { formatAmount };

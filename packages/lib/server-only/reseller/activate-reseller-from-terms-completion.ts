import {
  ResellerApplicationStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { getActiveNomiaPaygPackages } from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { prisma } from '@documenso/prisma';

import { resolveInitialAffiliateSlug } from './affiliate-slug';
import { resolveResellerDisplayName } from './reseller-association';
import { sendResellerWelcomeEmail } from './send-reseller-welcome-email';

export type ActivateResellerFromTermsCompletionOptions = {
  envelopeId: string;
  envelopeExternalId?: string | null;
  envelopeSecondaryId?: string | null;
};

export const buildResellerApplicationTermsCompletionWhere = ({
  envelopeId,
  envelopeExternalId,
  envelopeSecondaryId,
}: ActivateResellerFromTermsCompletionOptions): Prisma.ResellerApplicationWhereInput => {
  const orConditions: Prisma.ResellerApplicationWhereInput[] = [{ termsEnvelopeId: envelopeId }];

  if (envelopeExternalId) {
    orConditions.push(
      { id: envelopeExternalId },
      { externalDocGenRequestId: envelopeExternalId },
      { termsEnvelopeId: envelopeExternalId },
    );
  }

  if (envelopeSecondaryId) {
    orConditions.push({ termsEnvelopeId: envelopeSecondaryId });
  }

  return {
    status: {
      in: [ResellerApplicationStatus.TERMS_SENT, ResellerApplicationStatus.TERMS_COMPLETED],
    },
    OR: orConditions,
  };
};

const findResellerApplicationForTermsCompletion = async (
  options: ActivateResellerFromTermsCompletionOptions,
) => {
  return await prisma.resellerApplication.findFirst({
    where: buildResellerApplicationTermsCompletionWhere(options),
    include: {
      organisation: true,
      applicantUser: true,
    },
  });
};

const approveResellerApplication = async ({
  applicationId,
  termsEnvelopeId,
}: {
  applicationId: string;
  termsEnvelopeId: string;
}) => {
  await prisma.resellerApplication.update({
    where: { id: applicationId },
    data: {
      status: ResellerApplicationStatus.APPROVED,
      termsCompletedAt: new Date(),
      approvedAt: new Date(),
      termsEnvelopeId,
    },
  });
};

export const activateResellerFromTermsCompletion = async ({
  envelopeId,
  envelopeExternalId,
  envelopeSecondaryId,
}: ActivateResellerFromTermsCompletionOptions) => {
  const application = await findResellerApplicationForTermsCompletion({
    envelopeId,
    envelopeExternalId,
    envelopeSecondaryId,
  });

  if (!application) {
    return null;
  }

  const paygPackages = await getActiveNomiaPaygPackages();

  const existingProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
    include: {
      organisation: {
        select: {
          name: true,
        },
      },
    },
  });

  // Legacy soft-deleted profiles must be removed so re-apply creates a fresh profile.
  if (existingProfile?.status === ResellerProfileStatus.DELETED) {
    const sellerDisplayName = resolveResellerDisplayName(existingProfile);

    await prisma.$transaction(async (tx) => {
      await tx.organisation.updateMany({
        where: { associatedResellerProfileId: existingProfile.id },
        data: {
          associatedResellerProfileId: null,
          resellerAssociatedAt: null,
          resellerAssociationSource: null,
          resellerRequiresReconsent: false,
        },
      });

      await tx.resellerCreditTransaction.updateMany({
        where: {
          resellerProfileId: existingProfile.id,
          sellerVatStatus: null,
        },
        data: {
          sellerVatStatus: existingProfile.vatStatus,
          sellerVatNumber: existingProfile.vatNumber,
        },
      });

      await tx.resellerCreditTransaction.updateMany({
        where: { resellerProfileId: existingProfile.id },
        data: {
          sellerDisplayName,
          sellerPhysicalAddress: existingProfile.physicalAddress,
          sellerAffiliateSlug: existingProfile.affiliateSlug,
          resellerProfileId: null,
        },
      });

      await tx.resellerProfile.delete({
        where: { id: existingProfile.id },
      });
    });
  } else if (existingProfile) {
    if (application.status !== ResellerApplicationStatus.APPROVED) {
      await approveResellerApplication({
        applicationId: application.id,
        termsEnvelopeId: envelopeId,
      });
    }

    // Keep prior customer↔reseller affiliation. Sticky billing stays off until they
    // explicitly choose "Always buy from this reseller" on /r.
    await prisma.organisation.update({
      where: { id: application.organisationId },
      data: {
        resellerStickyBillingOptIn: false,
      },
    });

    return existingProfile;
  }

  const profile = await prisma.$transaction(async (tx) => {
    const affiliateSlug = await resolveInitialAffiliateSlug({
      orgUrl: application.organisation.url,
      client: tx,
    });

    await tx.resellerApplication.update({
      where: { id: application.id },
      data: {
        status: ResellerApplicationStatus.APPROVED,
        termsCompletedAt: new Date(),
        approvedAt: new Date(),
        termsEnvelopeId: envelopeId,
      },
    });

    const createdProfile = await tx.resellerProfile.create({
      data: {
        organisationId: application.organisationId,
        status: ResellerProfileStatus.ACTIVE,
        affiliateSlug,
        payoutMode: ResellerPayoutMode.NOMIA_SUBACCOUNT,
      },
    });

    // Keep associatedResellerProfileId / association source. Default sticky buy off so
    // Settings Billing stays on Nomia until they opt in on the parent /r page.
    await tx.organisation.update({
      where: { id: application.organisationId },
      data: {
        resellerStickyBillingOptIn: false,
      },
    });

    await tx.resellerPackage.createMany({
      data: paygPackages.map((pkg) => ({
        resellerProfileId: createdProfile.id,
        creditAmount: pkg.credits,
        priceInCents: pkg.priceInCents,
        currency: pkg.currency,
        catalogPackageId: pkg.id,
        isEnabled: false,
        paystackPlanCode: pkg.paystackPlanCode,
        paystackPaymentUrl: null,
      })),
    });

    return createdProfile;
  });

  await sendResellerWelcomeEmail({
    organisationName: application.organisation.name,
    applicantEmail: application.snapshotApplicantEmail,
    applicantName: application.snapshotApplicantName,
    affiliateSlug: profile.affiliateSlug,
  });

  return profile;
};

import {
  ResellerApplicationStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { getActiveNomiaPaygPackages } from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { prisma } from '@documenso/prisma';

import { resolveInitialAffiliateSlug } from './affiliate-slug';
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
  });

  if (existingProfile?.status === ResellerProfileStatus.DELETED) {
    const reactivatedProfile = await prisma.$transaction(async (tx) => {
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
          rejectedAt: null,
          rejectionReason: null,
          termsEnvelopeId: envelopeId,
        },
      });

      const updatedProfile = await tx.resellerProfile.update({
        where: { id: existingProfile.id },
        data: {
          status: ResellerProfileStatus.ACTIVE,
          deletedAt: null,
          affiliateSlug,
          allowNegativeCredits: false,
          isDelinquent: false,
          delinquentAt: null,
          zeroBalanceSince: null,
          payoutMode: ResellerPayoutMode.NOMIA_SUBACCOUNT,
        },
      });

      await tx.organisation.update({
        where: { id: application.organisationId },
        data: {
          resellerStickyBillingOptIn: false,
        },
      });

      const existingPackageCount = await tx.resellerPackage.count({
        where: { resellerProfileId: updatedProfile.id },
      });

      if (existingPackageCount === 0) {
        await tx.resellerPackage.createMany({
          data: paygPackages.map((pkg) => ({
            resellerProfileId: updatedProfile.id,
            creditAmount: pkg.credits,
            priceInCents: pkg.priceInCents,
            currency: pkg.currency,
            catalogPackageId: pkg.id,
            isEnabled: false,
            paystackPlanCode: pkg.paystackPlanCode,
            paystackPaymentUrl: null,
          })),
        });
      }

      return updatedProfile;
    });

    await sendResellerWelcomeEmail({
      organisationName: application.organisation.name,
      applicantEmail: application.snapshotApplicantEmail,
      applicantName: application.snapshotApplicantName,
      affiliateSlug: reactivatedProfile.affiliateSlug,
    });

    return reactivatedProfile;
  }

  if (existingProfile) {
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

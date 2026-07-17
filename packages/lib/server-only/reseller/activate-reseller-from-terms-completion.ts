import {
  ResellerApplicationStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
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

  const existingProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (existingProfile) {
    if (application.status !== ResellerApplicationStatus.APPROVED) {
      await approveResellerApplication({
        applicationId: application.id,
        termsEnvelopeId: envelopeId,
      });
    }

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

    await tx.resellerPackage.createMany({
      data: ESIGN_CREDIT_PACKAGES.map((pkg) => ({
        resellerProfileId: createdProfile.id,
        creditAmount: pkg.credits,
        priceInCents: pkg.priceInCents,
        currency: pkg.currency,
        catalogPackageId: pkg.id,
        isEnabled: false,
        paystackPlanCode: pkg.paystackPlanCode,
        paystackPaymentUrl: pkg.paystackPaymentUrl,
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

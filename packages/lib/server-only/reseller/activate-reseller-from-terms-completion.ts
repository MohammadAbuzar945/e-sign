import { ResellerApplicationStatus, ResellerProfileStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { prisma } from '@documenso/prisma';

import { sendResellerWelcomeEmail } from './send-reseller-welcome-email';

const generateAffiliateSlug = (orgUrl: string) => {
  const base = orgUrl
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base}-${nanoid(6)}`;
};

export const activateResellerFromTermsCompletion = async ({
  termsEnvelopeId,
}: {
  termsEnvelopeId: string;
}) => {
  const application = await prisma.resellerApplication.findFirst({
    where: {
      termsEnvelopeId,
      status: {
        in: [ResellerApplicationStatus.TERMS_SENT, ResellerApplicationStatus.TERMS_COMPLETED],
      },
    },
    include: {
      organisation: true,
      applicantUser: true,
    },
  });

  if (!application) {
    return null;
  }

  const existingProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (existingProfile) {
    return existingProfile;
  }

  const affiliateSlug = generateAffiliateSlug(application.organisation.url);

  const profile = await prisma.$transaction(async (tx) => {
    await tx.resellerApplication.update({
      where: { id: application.id },
      data: {
        status: ResellerApplicationStatus.APPROVED,
        termsCompletedAt: new Date(),
        approvedAt: new Date(),
      },
    });

    const createdProfile = await tx.resellerProfile.create({
      data: {
        organisationId: application.organisationId,
        status: ResellerProfileStatus.ACTIVE,
        affiliateSlug,
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

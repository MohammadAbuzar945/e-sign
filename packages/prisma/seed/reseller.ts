import {
  ResellerApplicationStatus,
  ResellerProfileStatus,
  type ResellerApplication,
  type ResellerProfile,
} from '@prisma/client';

import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';

import { prisma } from '..';

type SeedResellerApplicationOptions = {
  organisationId: string;
  applicantUserId: number;
  applicantName: string;
  applicantEmail: string;
  organisationName: string;
  status?: ResellerApplicationStatus;
  rejectionReason?: string | null;
};

export const seedResellerApplication = async ({
  organisationId,
  applicantUserId,
  applicantName,
  applicantEmail,
  organisationName,
  status = ResellerApplicationStatus.PENDING,
  rejectionReason = null,
}: SeedResellerApplicationOptions): Promise<ResellerApplication> => {
  const now = new Date();

  return await prisma.resellerApplication.upsert({
    where: { organisationId },
    create: {
      organisationId,
      applicantUserId,
      status,
      appliedAt: now,
      rejectedAt: status === ResellerApplicationStatus.REJECTED ? now : null,
      rejectionReason,
      snapshotOrgName: organisationName,
      snapshotApplicantName: applicantName,
      snapshotApplicantEmail: applicantEmail,
      snapshotCompletedDocCount: 60,
      snapshotUniqueSignerCount: 10,
      snapshotOrgUserCount: 3,
      snapshotOrgSignupDate: now,
    },
    update: {
      applicantUserId,
      status,
      appliedAt: now,
      rejectedAt: status === ResellerApplicationStatus.REJECTED ? now : null,
      rejectionReason,
      snapshotOrgName: organisationName,
      snapshotApplicantName: applicantName,
      snapshotApplicantEmail: applicantEmail,
    },
  });
};

type SeedResellerProfileOptions = {
  organisationId: string;
  affiliateSlug: string;
  status?: ResellerProfileStatus;
  enabledCatalogPackageIds?: string[];
  paystackPublicKey?: string | null;
  paystackSecretKey?: string | null;
};

export const seedResellerProfile = async ({
  organisationId,
  affiliateSlug,
  status = ResellerProfileStatus.ACTIVE,
  enabledCatalogPackageIds = [],
  paystackPublicKey = null,
  paystackSecretKey = null,
}: SeedResellerProfileOptions): Promise<ResellerProfile> => {
  const existingProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
  });

  if (existingProfile) {
    await prisma.resellerPackage.deleteMany({
      where: { resellerProfileId: existingProfile.id },
    });

    return await prisma.resellerProfile.update({
      where: { id: existingProfile.id },
      data: {
        affiliateSlug,
        status,
        paystackPublicKey,
        paystackSecretKey,
        packages: {
          createMany: {
            data: ESIGN_CREDIT_PACKAGES.map((pkg) => ({
              creditAmount: pkg.credits,
              priceInCents: pkg.priceInCents,
              currency: pkg.currency,
              catalogPackageId: pkg.id,
              isEnabled: enabledCatalogPackageIds.includes(pkg.id),
              paystackPlanCode: pkg.paystackPlanCode,
              paystackPaymentUrl: null,
            })),
          },
        },
      },
    });
  }

  return await prisma.resellerProfile.create({
    data: {
      organisationId,
      affiliateSlug,
      status,
      paystackPublicKey,
      paystackSecretKey,
      packages: {
        createMany: {
          data: ESIGN_CREDIT_PACKAGES.map((pkg) => ({
            creditAmount: pkg.credits,
            priceInCents: pkg.priceInCents,
            currency: pkg.currency,
            catalogPackageId: pkg.id,
            isEnabled: enabledCatalogPackageIds.includes(pkg.id),
            paystackPlanCode: pkg.paystackPlanCode,
            paystackPaymentUrl: null,
          })),
        },
      },
    },
  });
};

type SeedActiveResellerOptions = {
  organisationId: string;
  applicantUserId: number;
  applicantName: string;
  applicantEmail: string;
  organisationName: string;
  affiliateSlug: string;
  enabledCatalogPackageIds?: string[];
};

export const seedActiveReseller = async ({
  organisationId,
  applicantUserId,
  applicantName,
  applicantEmail,
  organisationName,
  affiliateSlug,
  enabledCatalogPackageIds = [],
}: SeedActiveResellerOptions) => {
  const now = new Date();

  const application = await seedResellerApplication({
    organisationId,
    applicantUserId,
    applicantName,
    applicantEmail,
    organisationName,
    status: ResellerApplicationStatus.APPROVED,
  });

  await prisma.resellerApplication.update({
    where: { id: application.id },
    data: {
      approvedAt: now,
      termsCompletedAt: now,
    },
  });

  const profile = await seedResellerProfile({
    organisationId,
    affiliateSlug,
    enabledCatalogPackageIds,
  });

  return {
    application,
    profile,
  };
};

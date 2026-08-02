import {
  DocumentStatus,
  EnvelopeType,
  ResellerApplicationStatus,
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { AppError } from '@documenso/lib/errors/app-error';
import { assertResellerDemoExtrasAccess } from '@documenso/lib/constants/demo-feature-flags';
import { formatCentsAsDecimal } from '@documenso/lib/utils/reseller-vat';

const prismaMock = vi.hoisted(() => ({
  envelope: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  $queryRaw: vi.fn(),
  organisationMember: {
    count: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
  resellerApplication: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  resellerProfile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  resellerPackage: {
    findUnique: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  resellerCreditTransaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  organisation: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
  },
  userCredits: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  organisationCreditPurchase: {
    upsert: vi.fn(),
  },
  nomiaPricePlan: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  $transaction: vi.fn(),
}));

const sendResellerWelcomeEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const sendResellerRejectionEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const sendResellerApplicationAdminNotificationMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

const getOrganisationCreditsMock = vi.hoisted(() => vi.fn());

const createTransactionMock = vi.hoisted(() => vi.fn());

const sendResellerInsufficientCreditsEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

const getResellerSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@documenso/lib/server-only/reseller/send-reseller-welcome-email', () => ({
  sendResellerWelcomeEmail: sendResellerWelcomeEmailMock,
}));

vi.mock('@documenso/lib/server-only/reseller/send-reseller-rejection-email', () => ({
  sendResellerRejectionEmail: sendResellerRejectionEmailMock,
}));

vi.mock('@documenso/lib/server-only/reseller/send-reseller-application-admin-notification', () => ({
  sendResellerApplicationAdminNotification: sendResellerApplicationAdminNotificationMock,
}));

vi.mock('@documenso/ee/server-only/limits/user-credits', () => ({
  getOrganisationCredits: getOrganisationCreditsMock,
}));

vi.mock('@documenso/lib/server-only/paystack', () => ({
  createTransaction: createTransactionMock,
}));

vi.mock('./send-reseller-insufficient-credits-email', () => ({
  sendResellerInsufficientCreditsEmail: sendResellerInsufficientCreditsEmailMock,
}));

vi.mock('@documenso/lib/server-only/billing/send-purchase-invoice-email', () => ({
  sendPurchaseInvoiceEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock('@documenso/lib/server-only/site-settings/get-reseller-site-settings', () => ({
  getResellerSiteSettings: getResellerSiteSettingsMock,
  getResellerEligibilityThresholds: async () => {
    const data = await getResellerSiteSettingsMock();

    return {
      minCreditsUsed:
        typeof data?.minCreditsUsed === 'number' && data.minCreditsUsed > 0
          ? data.minCreditsUsed
          : 50,
      minSignupMonths:
        typeof data?.minSignupMonths === 'number' && data.minSignupMonths > 0
          ? data.minSignupMonths
          : 2,
    };
  },
}));

vi.mock('@documenso/lib/server-only/document/send-document', () => ({
  sendDocument: vi.fn(),
}));

vi.mock('@documenso/lib/server-only/nomia-docgen', () => ({
  generateResellerTermsDocument: vi.fn(),
  fetchResellerTermsTemplateVariables: vi.fn(),
}));

vi.mock('@documenso/lib/server-only/template/create-document-from-template', () => ({
  createDocumentFromTemplate: vi.fn(),
}));

import { sendResellerTerms } from './send-reseller-terms';

const TEST_EMAIL = 'nomiadeveloper@gmail.com';

const setupOrganisationMetrics = ({
  completedDocumentCount = 60,
  creditsConsumed = 60,
  uniqueSignerCount = 10,
  orgUserCount = 3,
}: {
  completedDocumentCount?: number;
  creditsConsumed?: number;
  uniqueSignerCount?: number;
  orgUserCount?: number;
} = {}) => {
  prismaMock.envelope.count.mockResolvedValue(completedDocumentCount);
  prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(uniqueSignerCount) }]);
  prismaMock.organisationMember.count.mockResolvedValue(orgUserCount);
  prismaMock.team.findMany.mockResolvedValue([{ creditConsumed: creditsConsumed }]);
};

const setupOrganisationSignup = (monthsAgo = 3) => {
  const createdAt = new Date();
  createdAt.setMonth(createdAt.getMonth() - monthsAgo);

  prismaMock.organisation.findUnique.mockResolvedValue({
    createdAt,
  });
};

const setupNoActiveApplicationOrProfile = () => {
  prismaMock.resellerApplication.findUnique.mockResolvedValue(null);
  prismaMock.resellerProfile.findUnique.mockResolvedValue(null);
};

beforeEach(() => {
  vi.clearAllMocks();

  getResellerSiteSettingsMock.mockResolvedValue(null);

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => {
    return callback(prismaMock);
  });
});

describe('reseller demo extras access', () => {
  it('allows signed-in emails while RESELLER_DEMO_EXTRAS is enabled', () => {
    expect(() => assertResellerDemoExtrasAccess(TEST_EMAIL)).not.toThrow();
    expect(() => assertResellerDemoExtrasAccess('other@example.com')).not.toThrow();
  });

  it('rejects missing email', () => {
    expect(() => assertResellerDemoExtrasAccess(null)).toThrow(AppError);
  });
});

describe('getResellerEligibility flow', () => {
  it('bypasses credits/tenure for all users when RESELLER_ELIGIBILITY_BYPASS is on', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics({
      completedDocumentCount: 0,
      uniqueSignerCount: 0,
      orgUserCount: 1,
      creditsConsumed: 0,
    });
    setupOrganisationSignup(0);
    setupNoActiveApplicationOrProfile();

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: 'other@example.com',
    });

    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.reasons).toHaveLength(0);
    expect(prismaMock.envelope.count).toHaveBeenCalled();
  });

  it('returns eligible for org without active application or profile', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    setupNoActiveApplicationOrProfile();

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.reasons).toHaveLength(0);
    expect(eligibility.hasActiveApplication).toBe(false);
    expect(eligibility.hasActiveResellerProfile).toBe(false);
    expect(eligibility.application).toBeNull();
  });

  it('blocks org with an active application in progress', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      status: ResellerApplicationStatus.PENDING,
      appliedAt: new Date('2026-01-01'),
      termsSentAt: null,
      termsCompletedAt: null,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.hasActiveApplication).toBe(true);
    expect(eligibility.application?.status).toBe(ResellerApplicationStatus.PENDING);
    expect(eligibility.reasons).toContain(
      'An application is already in progress for this organisation.',
    );
  });

  it('allows re-application after rejection', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      status: ResellerApplicationStatus.REJECTED,
      appliedAt: new Date('2026-01-01'),
      termsSentAt: null,
      termsCompletedAt: null,
      approvedAt: null,
      rejectedAt: new Date('2026-01-05'),
      rejectionReason: 'Insufficient activity',
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.hasActiveApplication).toBe(false);
    expect(eligibility.application?.status).toBe(ResellerApplicationStatus.REJECTED);
  });

  it('blocks org that already has a reseller profile', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    prismaMock.resellerApplication.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.findUnique.mockResolvedValue({ id: 'profile_1' });

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.hasActiveResellerProfile).toBe(true);
    expect(eligibility.reasons).toEqual([]);
  });

  it('does not surface application-in-progress reasons for active resellers', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      status: ResellerApplicationStatus.APPROVED,
      appliedAt: new Date('2026-01-01'),
      termsSentAt: new Date('2026-01-02'),
      termsCompletedAt: new Date('2026-01-03'),
      approvedAt: new Date('2026-01-03'),
      rejectedAt: null,
      rejectionReason: null,
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue({ id: 'profile_1' });

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.hasActiveResellerProfile).toBe(true);
    expect(eligibility.reasons).toEqual([]);
    expect(eligibility.reasons).not.toContain(
      'An application is already in progress for this organisation.',
    );
  });

  it('uses default eligibility thresholds when reseller site settings are unset', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    getResellerSiteSettingsMock.mockResolvedValue(null);
    setupOrganisationMetrics();
    setupOrganisationSignup();
    setupNoActiveApplicationOrProfile();

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.requiredCredits).toBe(50);
    expect(eligibility.requiredSignupMonths).toBe(2);
    expect(eligibility.requiredSubscriptionMonths).toBe(2);
  });

  it('uses admin-configured eligibility thresholds from reseller site settings', async () => {
    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    getResellerSiteSettingsMock.mockResolvedValue({
      minCreditsUsed: 100,
      minSignupMonths: 6,
    });
    setupOrganisationMetrics();
    setupOrganisationSignup();
    setupNoActiveApplicationOrProfile();

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.requiredCredits).toBe(100);
    expect(eligibility.requiredSignupMonths).toBe(6);
    expect(eligibility.requiredSubscriptionMonths).toBe(6);
  });

  it('blocks eligibility against custom thresholds when bypass is disabled', async () => {
    const demoFlags = await import('@documenso/lib/constants/demo-feature-flags');
    const isDemoFeatureVisibleSpy = vi
      .spyOn(demoFlags, 'isDemoFeatureVisible')
      .mockImplementation((feature) => feature !== 'RESELLER_ELIGIBILITY_BYPASS');

    const { getResellerEligibility } = await import('./get-reseller-eligibility');

    getResellerSiteSettingsMock.mockResolvedValue({
      minCreditsUsed: 100,
      minSignupMonths: 6,
    });
    setupOrganisationMetrics({
      completedDocumentCount: 60,
      creditsConsumed: 60,
    });
    setupOrganisationSignup(3);
    setupNoActiveApplicationOrProfile();

    const eligibility = await getResellerEligibility({
      organisationId: 'org_1',
      userEmail: TEST_EMAIL,
    });

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.requiredCredits).toBe(100);
    expect(eligibility.requiredSignupMonths).toBe(6);
    expect(eligibility.reasons).toContain(
      'You must have used at least 100 e-sign credits before applying.',
    );
    expect(eligibility.reasons).toContain(
      'Your organisation must have been signed up for at least 6 months.',
    );

    isDemoFeatureVisibleSpy.mockRestore();
  });
});

describe('createResellerApplication flow', () => {
  it('creates a pending application with organisation snapshot metrics', async () => {
    const { createResellerApplication } = await import('./create-reseller-application');

    setupOrganisationMetrics({
      completedDocumentCount: 75,
      creditsConsumed: 55,
      uniqueSignerCount: 12,
      orgUserCount: 4,
    });
    setupOrganisationSignup();
    setupNoActiveApplicationOrProfile();

    const orgCreatedAt = new Date('2025-01-01T00:00:00.000Z');

    prismaMock.organisation.findUniqueOrThrow.mockResolvedValue({
      id: 'org_1',
      name: 'Acme Corp',
      createdAt: orgCreatedAt,
    });

    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: 42,
      name: 'Jane Applicant',
      email: TEST_EMAIL,
    });

    const createdApplication = {
      id: 'app_1',
      status: ResellerApplicationStatus.PENDING,
      snapshotOrgName: 'Acme Corp',
      snapshotApplicantName: 'Jane Applicant',
      snapshotApplicantEmail: TEST_EMAIL,
      snapshotCompletedDocCount: 75,
      snapshotUniqueSignerCount: 12,
      snapshotOrgUserCount: 4,
      snapshotOrgSignupDate: orgCreatedAt,
    };

    prismaMock.resellerApplication.create.mockResolvedValue(createdApplication);

    const result = await createResellerApplication({
      organisationId: 'org_1',
      applicantUserId: 42,
      applicantUserEmail: TEST_EMAIL,
    });

    expect(result).toEqual(createdApplication);
    expect(prismaMock.resellerApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org_1',
        applicantUserId: 42,
        status: ResellerApplicationStatus.PENDING,
        snapshotOrgName: 'Acme Corp',
        snapshotApplicantName: 'Jane Applicant',
        snapshotApplicantEmail: TEST_EMAIL,
        snapshotCompletedDocCount: 75,
        snapshotUniqueSignerCount: 12,
        snapshotOrgUserCount: 4,
        snapshotOrgSignupDate: orgCreatedAt,
      }),
    });
    expect(sendResellerApplicationAdminNotificationMock).toHaveBeenCalledWith({
      applicationId: 'app_1',
      organisationName: 'Acme Corp',
      applicantName: 'Jane Applicant',
      applicantEmail: TEST_EMAIL,
      completedDocumentCount: 75,
      uniqueSignerCount: 12,
      organisationUserCount: 4,
      organisationSignupDate: orgCreatedAt,
    });
  });

  it('resets a rejected application instead of creating a duplicate', async () => {
    const { createResellerApplication } = await import('./create-reseller-application');

    setupOrganisationMetrics({
      completedDocumentCount: 80,
      creditsConsumed: 60,
      uniqueSignerCount: 15,
      orgUserCount: 5,
    });
    setupOrganisationSignup();

    const orgCreatedAt = new Date('2025-01-01T00:00:00.000Z');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.REJECTED,
      appliedAt: new Date('2026-01-01'),
      termsSentAt: new Date('2026-01-02'),
      termsCompletedAt: null,
      approvedAt: null,
      rejectedAt: new Date('2026-01-05'),
      rejectionReason: 'Rejected by reseller: Declined',
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    prismaMock.organisation.findUniqueOrThrow.mockResolvedValue({
      id: 'org_1',
      name: 'Acme Corp',
      createdAt: orgCreatedAt,
    });

    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: 42,
      name: 'Jane Applicant',
      email: TEST_EMAIL,
    });

    const resetApplication = {
      id: 'app_1',
      status: ResellerApplicationStatus.PENDING,
      snapshotOrgName: 'Acme Corp',
      snapshotApplicantName: 'Jane Applicant',
      snapshotApplicantEmail: TEST_EMAIL,
      snapshotCompletedDocCount: 80,
      snapshotUniqueSignerCount: 15,
      snapshotOrgUserCount: 5,
      snapshotOrgSignupDate: orgCreatedAt,
    };

    prismaMock.resellerApplication.update.mockResolvedValue(resetApplication);

    const result = await createResellerApplication({
      organisationId: 'org_1',
      applicantUserId: 42,
      applicantUserEmail: TEST_EMAIL,
    });

    expect(result).toEqual(resetApplication);
    expect(prismaMock.resellerApplication.create).not.toHaveBeenCalled();
    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: expect.objectContaining({
        status: ResellerApplicationStatus.PENDING,
        rejectionReason: null,
        rejectedAt: null,
        termsSentAt: null,
        termsEnvelopeId: null,
        snapshotCompletedDocCount: 80,
      }),
    });
    expect(sendResellerApplicationAdminNotificationMock).toHaveBeenCalled();
  });

  it('rejects ineligible organisations', async () => {
    const { createResellerApplication } = await import('./create-reseller-application');

    setupOrganisationMetrics();
    setupOrganisationSignup();
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      status: ResellerApplicationStatus.TERMS_SENT,
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    await expect(
      createResellerApplication({
        organisationId: 'org_1',
        applicantUserId: 42,
        applicantUserEmail: TEST_EMAIL,
      }),
    ).rejects.toThrow('An application is already in progress for this organisation.');

    expect(sendResellerApplicationAdminNotificationMock).not.toHaveBeenCalled();
  });
});

describe('activateResellerFromTermsCompletion flow', () => {
  const application = {
    id: 'app_1',
    organisationId: 'org_1',
    status: ResellerApplicationStatus.TERMS_SENT,
    snapshotApplicantEmail: TEST_EMAIL,
    snapshotApplicantName: 'Jane Applicant',
    organisation: {
      id: 'org_1',
      name: 'Acme Corp',
      url: 'acme-corp',
    },
    applicantUser: {
      id: 42,
      email: TEST_EMAIL,
    },
  };

  it('returns null when no matching application exists', async () => {
    const { activateResellerFromTermsCompletion } = await import(
      './activate-reseller-from-terms-completion'
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(null);

    const result = await activateResellerFromTermsCompletion({
      envelopeId: 'envelope_abc',
    });

    expect(result).toBeNull();
  });

  it('creates profile, packages, and sends welcome email on terms completion', async () => {
    const { activateResellerFromTermsCompletion } = await import(
      './activate-reseller-from-terms-completion'
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(application);
    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const createdProfile = {
      id: 'profile_1',
      organisationId: 'org_1',
      affiliateSlug: 'acme-corp',
      status: ResellerProfileStatus.ACTIVE,
    };

    prismaMock.resellerProfile.create.mockResolvedValue(createdProfile);
    prismaMock.resellerApplication.update.mockResolvedValue({
      ...application,
      status: ResellerApplicationStatus.APPROVED,
    });
    prismaMock.resellerPackage.createMany.mockResolvedValue({ count: ESIGN_CREDIT_PACKAGES.length });

    const result = await activateResellerFromTermsCompletion({
      envelopeId: 'envelope_abc',
      envelopeExternalId: 'app_1',
    });

    expect(result).toEqual(createdProfile);
    expect(prismaMock.resellerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org_1',
        status: ResellerProfileStatus.ACTIVE,
        affiliateSlug: 'acme-corp',
        payoutMode: 'NOMIA_SUBACCOUNT',
      }),
    });
    expect(prismaMock.resellerPackage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          creditAmount: ESIGN_CREDIT_PACKAGES[0]?.credits,
          isEnabled: false,
        }),
      ]),
    });
    expect(prismaMock.resellerPackage.createMany.mock.calls[0]?.[0].data).toHaveLength(
      ESIGN_CREDIT_PACKAGES.length,
    );
    expect(sendResellerWelcomeEmailMock).toHaveBeenCalledWith({
      organisationName: 'Acme Corp',
      applicantEmail: TEST_EMAIL,
      applicantName: 'Jane Applicant',
      affiliateSlug: 'acme-corp',
    });
    expect(prismaMock.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: {
        resellerStickyBillingOptIn: false,
      },
    });
    expect(prismaMock.organisation.update).not.toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        associatedResellerProfileId: null,
      }),
    });
  });

  it('falls back to a suffixed slug when the organisation URL is already taken', async () => {
    const { activateResellerFromTermsCompletion } = await import(
      './activate-reseller-from-terms-completion'
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(application);
    prismaMock.resellerProfile.findUnique.mockImplementation(async ({ where }) => {
      if ('affiliateSlug' in where && where.affiliateSlug === 'acme-corp') {
        return { organisationId: 'other_org' };
      }

      return null;
    });

    const createdProfile = {
      id: 'profile_1',
      organisationId: 'org_1',
      affiliateSlug: 'acme-corp-abc123',
      status: ResellerProfileStatus.ACTIVE,
    };

    prismaMock.resellerProfile.create.mockResolvedValue(createdProfile);
    prismaMock.resellerApplication.update.mockResolvedValue({
      ...application,
      status: ResellerApplicationStatus.APPROVED,
    });
    prismaMock.resellerPackage.createMany.mockResolvedValue({ count: ESIGN_CREDIT_PACKAGES.length });

    const result = await activateResellerFromTermsCompletion({
      envelopeId: 'envelope_abc',
    });

    expect(result).toEqual(createdProfile);
    expect(prismaMock.resellerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        affiliateSlug: expect.stringMatching(/^acme-corp-[a-zA-Z0-9_-]{6,}$/),
      }),
    });
  });

  it('approves application without recreating profile when profile already exists', async () => {
    const { activateResellerFromTermsCompletion } = await import(
      './activate-reseller-from-terms-completion'
    );

    const existingProfile = {
      id: 'profile_1',
      organisationId: 'org_1',
      affiliateSlug: 'acme-corp-existing',
    };

    prismaMock.resellerApplication.findFirst.mockResolvedValue(application);
    prismaMock.resellerProfile.findUnique.mockResolvedValue(existingProfile);

    const result = await activateResellerFromTermsCompletion({
      envelopeId: 'envelope_abc',
    });

    expect(result).toEqual(existingProfile);
    expect(prismaMock.resellerProfile.create).not.toHaveBeenCalled();
    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: expect.objectContaining({
        status: ResellerApplicationStatus.APPROVED,
        termsEnvelopeId: 'envelope_abc',
      }),
    });
    expect(prismaMock.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: {
        resellerStickyBillingOptIn: false,
      },
    });
    expect(sendResellerWelcomeEmailMock).not.toHaveBeenCalled();
  });
});

describe('rejectResellerApplicationFromTermsRejection flow', () => {
  const application = {
    id: 'app_1',
    organisationId: 'org_1',
    status: ResellerApplicationStatus.TERMS_SENT,
    termsEnvelopeId: 'envelope_abc',
  };

  it('returns null when no matching application exists', async () => {
    const { rejectResellerApplicationFromTermsRejection } = await import(
      './reject-reseller-application-from-terms-rejection'
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(null);

    const result = await rejectResellerApplicationFromTermsRejection({
      envelopeId: 'envelope_abc',
    });

    expect(result).toBeNull();
    expect(prismaMock.resellerApplication.update).not.toHaveBeenCalled();
  });

  it('marks the application as rejected by reseller with the document reason', async () => {
    const { rejectResellerApplicationFromTermsRejection } = await import(
      './reject-reseller-application-from-terms-rejection'
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(application);
    prismaMock.resellerApplication.update.mockResolvedValue({
      ...application,
      status: ResellerApplicationStatus.REJECTED,
      rejectionReason: 'Rejected by reseller: I do not agree with the terms',
    });

    const result = await rejectResellerApplicationFromTermsRejection({
      envelopeId: 'envelope_abc',
      rejectionReason: 'I do not agree with the terms',
    });

    expect(result?.status).toBe(ResellerApplicationStatus.REJECTED);
    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: {
        status: ResellerApplicationStatus.REJECTED,
        rejectedAt: expect.any(Date),
        rejectionReason: 'Rejected by reseller: I do not agree with the terms',
      },
    });
    expect(sendResellerRejectionEmailMock).not.toHaveBeenCalled();
  });

  it('uses the default rejection label when no document reason is provided', async () => {
    const {
      formatResellerTermsRejectionReason,
      getResellerApplicationStatusLabel,
      rejectResellerApplicationFromTermsRejection,
    } = await import('./reject-reseller-application-from-terms-rejection');

    expect(formatResellerTermsRejectionReason()).toBe('Rejected by reseller');
    expect(
      getResellerApplicationStatusLabel('REJECTED', 'Rejected by reseller: Declined'),
    ).toBe('Rejected by reseller');
    expect(getResellerApplicationStatusLabel('REJECTED', 'Insufficient activity')).toBe(
      'Rejected',
    );

    prismaMock.resellerApplication.findFirst.mockResolvedValue(application);
    prismaMock.resellerApplication.update.mockResolvedValue({
      ...application,
      status: ResellerApplicationStatus.REJECTED,
      rejectionReason: 'Rejected by reseller',
    });

    await rejectResellerApplicationFromTermsRejection({
      envelopeId: 'envelope_abc',
    });

    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: {
        status: ResellerApplicationStatus.REJECTED,
        rejectedAt: expect.any(Date),
        rejectionReason: 'Rejected by reseller',
      },
    });
  });
});

describe('retryResellerApplicationActivation flow', () => {
  it('activates reseller when a completed terms envelope exists', async () => {
    const { retryResellerApplicationActivation } = await import(
      './retry-reseller-application-activation'
    );

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.TERMS_SENT,
      termsEnvelopeId: 'envelope_abc',
      externalDocGenRequestId: null,
    });

    prismaMock.envelope.findFirst.mockResolvedValue({
      id: 'envelope_abc',
      externalId: 'app_1',
      secondaryId: null,
      type: EnvelopeType.DOCUMENT,
      status: DocumentStatus.COMPLETED,
    });

    prismaMock.resellerApplication.findFirst.mockResolvedValue({
      id: 'app_1',
      organisationId: 'org_1',
      status: ResellerApplicationStatus.TERMS_SENT,
      snapshotApplicantEmail: TEST_EMAIL,
      snapshotApplicantName: 'Jane Applicant',
      organisation: {
        id: 'org_1',
        name: 'Acme Corp',
        url: 'acme-corp',
      },
      applicantUser: {
        id: 42,
        email: TEST_EMAIL,
      },
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.create.mockResolvedValue({
      id: 'profile_1',
      affiliateSlug: 'acme-corp-xyz',
    });
    prismaMock.resellerPackage.createMany.mockResolvedValue({ count: ESIGN_CREDIT_PACKAGES.length });

    const result = await retryResellerApplicationActivation({
      applicationId: 'app_1',
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.envelope.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: EnvelopeType.DOCUMENT,
          status: DocumentStatus.COMPLETED,
        }),
      }),
    );
  });

  it('rejects activation for applications without sent terms', async () => {
    const { retryResellerApplicationActivation } = await import(
      './retry-reseller-application-activation'
    );

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.PENDING,
    });

    await expect(
      retryResellerApplicationActivation({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow('Only applications with sent terms can be activated.');
  });

  it('rejects activation when no completed envelope is found', async () => {
    const { retryResellerApplicationActivation } = await import(
      './retry-reseller-application-activation'
    );

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.TERMS_SENT,
      termsEnvelopeId: null,
      externalDocGenRequestId: null,
    });

    prismaMock.envelope.findFirst.mockResolvedValue(null);

    await expect(
      retryResellerApplicationActivation({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow('No completed reseller terms document was found for this application.');
  });
});

describe('admin reseller application actions', () => {
  it('marks application as rejected with optional reason and emails applicant', async () => {
    const { rejectResellerApplication } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.PENDING,
      snapshotOrgName: 'Acme Corp',
      snapshotApplicantName: 'Jane Applicant',
      snapshotApplicantEmail: 'jane@example.com',
    });

    const rejectedApplication = {
      id: 'app_1',
      status: ResellerApplicationStatus.REJECTED,
      rejectionReason: 'Does not meet criteria',
    };

    prismaMock.resellerApplication.update.mockResolvedValue(rejectedApplication);

    const result = await rejectResellerApplication({
      applicationId: 'app_1',
      rejectionReason: 'Does not meet criteria',
    });

    expect(result).toEqual(rejectedApplication);
    expect(sendResellerRejectionEmailMock).toHaveBeenCalledWith({
      organisationName: 'Acme Corp',
      applicantName: 'Jane Applicant',
      applicantEmail: 'jane@example.com',
      rejectionReason: 'Does not meet criteria',
    });
  });

  it('rejects in-progress applications only', async () => {
    const { rejectResellerApplication } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
    });

    await expect(
      rejectResellerApplication({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow('This application can no longer be rejected or cancelled.');
  });

  it('marks application as cancelled with optional reason', async () => {
    const { cancelResellerApplication } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.TERMS_SENT,
    });

    const cancelledApplication = {
      id: 'app_1',
      status: ResellerApplicationStatus.CANCELLED,
    };

    prismaMock.resellerApplication.update.mockResolvedValue(cancelledApplication);

    const result = await cancelResellerApplication({
      applicationId: 'app_1',
      cancellationReason: 'Withdrawn by admin',
    });

    expect(result).toEqual(cancelledApplication);
    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: expect.objectContaining({
        status: ResellerApplicationStatus.CANCELLED,
        rejectionReason: 'Withdrawn by admin',
      }),
    });
  });

  it('deactivates an active reseller profile', async () => {
    const { deactivateResellerProfile } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.ACTIVE,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.INACTIVE,
    });

    const result = await deactivateResellerProfile({
      applicationId: 'app_1',
    });

    expect(result.status).toBe(ResellerProfileStatus.INACTIVE);
  });

  it('reactivates an inactive reseller profile', async () => {
    const { reactivateResellerProfile } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.INACTIVE,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.ACTIVE,
    });

    const result = await reactivateResellerProfile({
      applicationId: 'app_1',
    });

    expect(result.status).toBe(ResellerProfileStatus.ACTIVE);
  });

  it('enables negative credits for an active approved reseller', async () => {
    const { updateResellerAllowNegativeCredits } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: false,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: true,
    });

    const result = await updateResellerAllowNegativeCredits({
      applicationId: 'app_1',
      allowNegativeCredits: true,
    });

    expect(result.allowNegativeCredits).toBe(true);
    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile_1' },
      data: { allowNegativeCredits: true },
    });
  });

  it('rejects negative credit updates for inactive reseller profiles', async () => {
    const { updateResellerAllowNegativeCredits } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      status: ResellerProfileStatus.INACTIVE,
    });

    await expect(
      updateResellerAllowNegativeCredits({
        applicationId: 'app_1',
        allowNegativeCredits: true,
      }),
    ).rejects.toThrow('Negative credits can only be configured for active reseller profiles.');
  });

  it('detects when an organisation allows negative credits', async () => {
    const { organisationAllowsNegativeCredits } = await import(
      './organisation-allows-negative-credits'
    );

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: true,
    });

    await expect(organisationAllowsNegativeCredits('org_1')).resolves.toBe(true);

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: false,
    });

    await expect(organisationAllowsNegativeCredits('org_1')).resolves.toBe(false);

    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    await expect(organisationAllowsNegativeCredits('org_1')).resolves.toBe(false);
  });

  it('hard-deletes an approved reseller and detaches buyer purchase history', async () => {
    const { deleteReseller } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: ResellerProfileStatus.ACTIVE,
      affiliateSlug: 'acme',
      physicalAddress: '1 Main Street',
      vatStatus: 'REGISTERED',
      vatNumber: '4123456789',
      brandingCompanyDetails: 'Acme Trading',
      organisation: {
        name: 'Acme Org',
      },
    });

    prismaMock.resellerCreditTransaction.count.mockResolvedValue(0);
    prismaMock.organisation.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.resellerCreditTransaction.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.resellerProfile.delete.mockResolvedValue({
      id: 'profile_1',
    });
    prismaMock.resellerApplication.update.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.CANCELLED,
    });

    const result = await deleteReseller({
      applicationId: 'app_1',
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.resellerProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.resellerProfile.delete).toHaveBeenCalledWith({
      where: { id: 'profile_1' },
    });
    expect(prismaMock.resellerCreditTransaction.updateMany).toHaveBeenCalledWith({
      where: {
        resellerProfileId: 'profile_1',
        sellerVatStatus: null,
      },
      data: {
        sellerVatStatus: 'REGISTERED',
        sellerVatNumber: '4123456789',
      },
    });
    expect(prismaMock.resellerCreditTransaction.updateMany).toHaveBeenCalledWith({
      where: { resellerProfileId: 'profile_1' },
      data: {
        sellerDisplayName: 'Acme Trading',
        sellerPhysicalAddress: '1 Main Street',
        sellerAffiliateSlug: 'acme',
        resellerProfileId: null,
      },
    });
    expect(prismaMock.resellerApplication.update).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      data: expect.objectContaining({
        status: ResellerApplicationStatus.CANCELLED,
        rejectionReason: 'Reseller account deleted by admin',
      }),
    });
    expect(prismaMock.organisation.updateMany).toHaveBeenCalledWith({
      where: { associatedResellerProfileId: 'profile_1' },
      data: {
        associatedResellerProfileId: null,
        resellerAssociatedAt: null,
        resellerAssociationSource: null,
        resellerRequiresReconsent: false,
      },
    });
  });

  it('blocks delete when pending credit purchases exist', async () => {
    const { deleteReseller } = await import('./admin-reseller-actions');

    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      status: ResellerApplicationStatus.APPROVED,
      organisationId: 'org_1',
    });

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      status: ResellerProfileStatus.ACTIVE,
    });

    prismaMock.resellerCreditTransaction.count.mockResolvedValue(1);

    await expect(
      deleteReseller({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow('Cannot delete this reseller while credit purchases are still pending.');
  });
});

describe('sendResellerTerms flow', () => {
  it('requires a configured DocGen template when provider is Nomia DocGen', async () => {
    getResellerSiteSettingsMock.mockResolvedValue({});

    await expect(
      sendResellerTerms({
        applications: [],
        requestMetadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
        },
      }),
    ).rejects.toThrow('Nomia DocGen template ID is not configured');
  });

  it('requires DocGen organization id when DocGen template is configured', async () => {
    getResellerSiteSettingsMock.mockResolvedValue({
      termsProvider: 'NOMIA_DOCGEN',
      termsDocGenTemplateId: 839,
    });

    await expect(
      sendResellerTerms({
        applications: [],
        requestMetadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
        },
      }),
    ).rejects.toThrow('Nomia DocGen organization ID is not configured');
  });

  it('requires an internal template when provider is Internal', async () => {
    getResellerSiteSettingsMock.mockResolvedValue({
      termsProvider: 'INTERNAL',
    });

    await expect(
      sendResellerTerms({
        applications: [],
        requestMetadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
        },
      }),
    ).rejects.toThrow('Internal e-sign template ID is not configured');
  });
});

describe('initializeResellerPurchase flow', () => {
  const profile = {
    id: 'profile_1',
    organisationId: 'reseller_org',
    affiliateSlug: 'acme-reseller',
    status: ResellerProfileStatus.ACTIVE,
    allowNegativeCredits: false,
    payoutMode: 'OWN_PAYSTACK',
    paystackPublicKey: 'pk_test',
    paystackSecretKey: 'sk_test',
    paystackSubaccountCode: null,
    subaccountStatus: null,
    platformFeePercent: null,
    vatNumber: null,
    packages: [
      {
        id: 'pkg_1',
        catalogPackageId: 'payg-50',
        isEnabled: true,
        creditAmount: 50,
        priceInCents: 45000,
        currency: 'ZAR',
      },
    ],
    organisation: {
      id: 'reseller_org',
      name: 'Reseller Org',
    },
  };

  it('initializes Paystack transaction for valid purchase', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    getOrganisationCreditsMock.mockResolvedValue(100);
    createTransactionMock.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://paystack.test/pay',
        reference: 'ref_abc',
      },
    });

    const result = await initializeResellerPurchase({
      affiliateSlug: 'acme-reseller',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 99,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result.authorizationUrl).toBe('https://paystack.test/pay');
    expect(result.reference).toBe('ref_abc');
    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        amount: 45000,
        secretKey: 'sk_test',
        metadata: expect.objectContaining({
          type: 'reseller-credit-purchase',
          resellerProfileId: 'profile_1',
          purchaserOrganisationId: 'buyer_org',
          packageId: 'pkg_1',
          payoutMode: 'OWN_PAYSTACK',
        }),
      }),
    );
    expect(prismaMock.resellerCreditTransaction.create).not.toHaveBeenCalled();
  });

  it('blocks self-purchase from the reseller organisation', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);

    await expect(
      initializeResellerPurchase({
        affiliateSlug: 'acme-reseller',
        packageId: 'pkg_1',
        purchaserOrganisationId: 'reseller_org',
        purchaserUserId: 99,
        purchaserEmail: 'buyer@example.com',
      }),
    ).rejects.toThrow('You cannot purchase credits from your own reseller account');
  });

  it('blocks checkout when reseller payout is not configured', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      paystackPublicKey: null,
      paystackSecretKey: null,
    });

    await expect(
      initializeResellerPurchase({
        affiliateSlug: 'acme-reseller',
        packageId: 'pkg_1',
        purchaserOrganisationId: 'buyer_org',
        purchaserUserId: 99,
        purchaserEmail: 'buyer@example.com',
      }),
    ).rejects.toThrow('Paystack public and secret keys are required');

    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it('initializes Nomia subaccount checkout when Mode B is ready', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      payoutMode: 'NOMIA_SUBACCOUNT',
      paystackSubaccountCode: 'ACCT_test',
      subaccountStatus: 'ACTIVE',
      platformFeePercent: 0,
    });
    getOrganisationCreditsMock.mockResolvedValue(100);
    createTransactionMock.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://paystack.test/pay',
        reference: 'ref_subaccount',
      },
    });

    const result = await initializeResellerPurchase({
      affiliateSlug: 'acme-reseller',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 99,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result.reference).toBe('ref_subaccount');
    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subaccount: 'ACCT_test',
        bearer: 'subaccount',
        metadata: expect.objectContaining({
          payoutMode: 'NOMIA_SUBACCOUNT',
          subaccountCode: 'ACCT_test',
        }),
      }),
    );
  });

  it('uses shared fee bearing for hybrid single-checkout splits', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      payoutMode: 'NOMIA_SUBACCOUNT',
      paystackSubaccountCode: 'ACCT_test',
      subaccountStatus: 'ACTIVE',
      platformFeePercent: 0,
      packages: [
        {
          id: 'pkg_1000',
          catalogPackageId: 'payg-1000',
          isEnabled: true,
          creditAmount: 1000,
          priceInCents: 700000,
          currency: 'ZAR',
        },
      ],
    });
    getOrganisationCreditsMock.mockResolvedValue(20);
    createTransactionMock.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://paystack.test/pay',
        reference: 'ref_hybrid',
      },
    });

    await initializeResellerPurchase({
      affiliateSlug: 'acme-reseller',
      packageId: 'pkg_1000',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 99,
      purchaserEmail: 'buyer@example.com',
      hybridSingleCheckoutSplit: {
        resellerCredits: 20,
        nomiaCredits: 980,
        resellerAmountInCents: 14000,
        nomiaAmountInCents: 686000,
        totalAmountInCents: 700000,
        totalCredits: 1000,
        catalogPackageId: 'payg-1000',
      },
    });

    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 700000,
        split: {
          type: 'flat',
          bearer_type: 'all',
          subaccounts: [
            {
              subaccount: 'ACCT_test',
              share: 14000,
            },
          ],
        },
        metadata: expect.objectContaining({
          hybridSingleCheckout: true,
          resellerCredits: 20,
          nomiaCredits: 980,
        }),
      }),
    );
    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        bearer: 'account',
        subaccount: expect.anything(),
      }),
    );
  });

  it('blocks checkout when reseller has insufficient credits and negative credits are disabled', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    getOrganisationCreditsMock.mockResolvedValue(5);

    await expect(
      initializeResellerPurchase({
        affiliateSlug: 'acme-reseller',
        packageId: 'pkg_1',
        purchaserOrganisationId: 'buyer_org',
        purchaserUserId: 99,
        purchaserEmail: 'buyer@example.com',
      }),
    ).rejects.toThrow(
      'This reseller does not have enough credits to fulfill this purchase right now',
    );

    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it('allows checkout when negative credits are enabled even if balance is low', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      allowNegativeCredits: true,
    });
    getOrganisationCreditsMock.mockResolvedValue(-10);
    createTransactionMock.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://paystack.test/pay',
        reference: 'ref_abc',
      },
    });

    const result = await initializeResellerPurchase({
      affiliateSlug: 'acme-reseller',
      packageId: 'pkg_1',
      purchaserOrganisationId: 'buyer_org',
      purchaserUserId: 99,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result.reference).toBe('ref_abc');
    expect(createTransactionMock).toHaveBeenCalled();
  });

  it('rejects disabled or missing packages', async () => {
    const { initializeResellerPurchase } = await import('./initialize-reseller-purchase');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      packages: [
        {
          id: 'pkg_1',
          isEnabled: false,
          creditAmount: 50,
          priceInCents: 45000,
        },
      ],
    });

    await expect(
      initializeResellerPurchase({
        affiliateSlug: 'acme-reseller',
        packageId: 'pkg_1',
        purchaserOrganisationId: 'buyer_org',
        purchaserUserId: 99,
        purchaserEmail: 'buyer@example.com',
      }),
    ).rejects.toThrow('Package is not available for purchase');
  });
});

describe('processResellerPaystackWebhook flow', () => {
  const baseMetadata = {
    type: 'reseller-credit-purchase' as const,
    resellerProfileId: 'profile_1',
    purchaserOrganisationId: 'buyer_org',
    purchaserUserId: 99,
    packageId: 'pkg_1',
    expectedAmount: 45000,
  };

  const profile = {
    id: 'profile_1',
    organisationId: 'reseller_org',
    status: ResellerProfileStatus.ACTIVE,
    vatNumber: '4123456789',
    allowNegativeCredits: false,
    organisation: {
      id: 'reseller_org',
      name: 'Reseller Org',
      url: 'reseller-org',
      owner: {
        email: 'reseller@example.com',
      },
    },
  };

  const pkg = {
    id: 'pkg_1',
    resellerProfileId: 'profile_1',
    isEnabled: true,
    creditAmount: 50,
    priceInCents: 45000,
    currency: 'ZAR',
  };

  const purchaserOrganisation = {
    id: 'buyer_org',
    name: 'Buyer Org',
    ownerUserId: 99,
    owner: {
      name: 'Buyer Name',
    },
  };

  const setupSuccessfulWebhookMocks = () => {
    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    prismaMock.resellerPackage.findUnique.mockResolvedValue(pkg);
    prismaMock.organisation.findUnique.mockResolvedValue(purchaserOrganisation);
    prismaMock.organisation.findUniqueOrThrow
      .mockResolvedValueOnce({ ownerUserId: 1 })
      .mockResolvedValueOnce({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst
      .mockResolvedValueOnce({ id: 'credits_reseller', credits: 100 })
      .mockResolvedValueOnce({ id: 'credits_buyer', credits: 20 });
    prismaMock.userCredits.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.resellerCreditTransaction.create.mockResolvedValue({
      id: 'txn_1',
      status: ResellerCreditTransactionStatus.PENDING,
    });
    prismaMock.resellerCreditTransaction.update.mockResolvedValue({
      id: 'txn_1',
      status: ResellerCreditTransactionStatus.COMPLETED,
    });
    prismaMock.userCredits.update.mockResolvedValue({ id: 'credits_buyer', credits: 70 });
  };

  it('ignores non-reseller webhook events', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_1',
      metadata: { type: 'other-event' },
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result).toEqual({ handled: false });
  });

  it('transfers credits and completes transaction on successful payment', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    setupSuccessfulWebhookMocks();

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_success',
      metadata: baseMetadata,
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
      purchaserName: 'Buyer Name',
    });

    expect(result.handled).toBe(true);
    expect(result.fulfilled).toBe(true);
    expect(result).toHaveProperty('transaction');
    expect(prismaMock.userCredits.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'credits_reseller',
          credits: { gte: 50 },
        }),
      }),
    );
    expect(prismaMock.userCredits.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credits: { increment: 50 },
        }),
      }),
    );
    expect(sendResellerInsufficientCreditsEmailMock).not.toHaveBeenCalled();
  });

  it('credits clients and allows reseller balance to go negative when enabled', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      ...profile,
      allowNegativeCredits: true,
    });
    prismaMock.resellerPackage.findUnique.mockResolvedValue(pkg);
    prismaMock.organisation.findUnique.mockResolvedValue(purchaserOrganisation);
    prismaMock.organisation.findUniqueOrThrow
      .mockResolvedValueOnce({ ownerUserId: 1 })
      .mockResolvedValueOnce({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst
      .mockResolvedValueOnce({ id: 'credits_reseller', credits: 0 })
      .mockResolvedValueOnce({ id: 'credits_buyer', credits: 20 });
    prismaMock.userCredits.update.mockResolvedValueOnce({ id: 'credits_reseller', credits: -50 });
    prismaMock.userCredits.update.mockResolvedValueOnce({ id: 'credits_buyer', credits: 70 });
    prismaMock.resellerCreditTransaction.create.mockResolvedValue({
      id: 'txn_negative',
      status: ResellerCreditTransactionStatus.PENDING,
    });
    prismaMock.resellerCreditTransaction.update.mockResolvedValue({
      id: 'txn_negative',
      status: ResellerCreditTransactionStatus.COMPLETED,
    });

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_negative',
      metadata: baseMetadata,
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
      purchaserName: 'Buyer Name',
    });

    expect(result.fulfilled).toBe(true);
    expect(prismaMock.userCredits.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.userCredits.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'credits_reseller' },
        data: expect.objectContaining({
          credits: { decrement: 50 },
        }),
      }),
    );
    expect(sendResellerInsufficientCreditsEmailMock).not.toHaveBeenCalled();
  });

  it('records pending manual transfer and emails reseller when credits are insufficient', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    prismaMock.resellerPackage.findUnique.mockResolvedValue(pkg);
    prismaMock.organisation.findUnique.mockResolvedValue(purchaserOrganisation);
    prismaMock.organisation.findUniqueOrThrow
      .mockResolvedValueOnce({ ownerUserId: 1 })
      .mockResolvedValueOnce({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst.mockResolvedValueOnce({ id: 'credits_reseller', credits: 5 });
    prismaMock.userCredits.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.resellerCreditTransaction.create.mockResolvedValue({
      id: 'txn_pending_manual',
      status: ResellerCreditTransactionStatus.PENDING,
    });

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_low_credits',
      metadata: baseMetadata,
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
      purchaserName: 'Buyer Name',
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        fulfilled: false,
        awaitingManualTransfer: true,
      }),
    );
    expect(sendResellerInsufficientCreditsEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resellerOwnerEmail: 'reseller@example.com',
        purchaserOrganisationName: 'Buyer Org',
        creditsRequired: 50,
      }),
    );
    expect(prismaMock.userCredits.update).not.toHaveBeenCalled();
  });

  it('fulfills hybrid single-checkout purchases with reseller and Nomia credits', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    setupSuccessfulWebhookMocks();
    prismaMock.organisationCreditPurchase.upsert.mockResolvedValue({
      id: 'nomia_purchase_1',
      status: 'COMPLETED',
    });
    prismaMock.userCredits.update.mockResolvedValue({ id: 'credits_buyer', credits: 120 });

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_hybrid',
      metadata: {
        ...baseMetadata,
        creditAmount: 50,
        expectedAmount: 45000,
        hybridSingleCheckout: true,
        resellerCredits: 10,
        nomiaCredits: 40,
        resellerAmountInCents: 9000,
        nomiaAmountInCents: 36000,
        purchaseGroupId: 'pur_hybrid',
      },
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
      purchaserName: 'Buyer Name',
    });

    expect(result.fulfilled).toBe(true);
    expect(prismaMock.userCredits.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          credits: { gte: 10 },
        }),
      }),
    );
    expect(prismaMock.userCredits.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credits: { increment: 50 },
        }),
      }),
    );
    expect(prismaMock.organisationCreditPurchase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paystackReference: 'ref_hybrid#nomia' },
        create: expect.objectContaining({
          credits: 40,
          grossAmount: 36000,
          purchaseGroupId: 'pur_hybrid',
        }),
      }),
    );
  });

  it('returns duplicate for already completed transactions', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue({
      status: ResellerCreditTransactionStatus.COMPLETED,
    });

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_dup',
      metadata: baseMetadata,
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result).toEqual({ handled: true, duplicate: true, fulfilled: true });
    expect(prismaMock.resellerProfile.findUnique).not.toHaveBeenCalled();
  });

  it('rejects payments with mismatched amounts', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue(null);
    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    prismaMock.resellerPackage.findUnique.mockResolvedValue(pkg);
    prismaMock.organisation.findUnique.mockResolvedValue(purchaserOrganisation);

    await expect(
      processResellerPaystackWebhook({
        paystackReference: 'ref_mismatch',
        metadata: baseMetadata,
        amountInCents: 100,
        purchaserEmail: 'buyer@example.com',
      }),
    ).rejects.toThrow('Payment amount does not match expected reseller purchase amount');
  });

  it('retries fulfillment for pending transactions when credits become available', async () => {
    const { processResellerPaystackWebhook } = await import('./process-reseller-paystack-webhook');

    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue({
      id: 'txn_pending_manual',
      status: ResellerCreditTransactionStatus.PENDING,
    });
    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile);
    prismaMock.resellerPackage.findUnique.mockResolvedValue(pkg);
    prismaMock.organisation.findUnique.mockResolvedValue(purchaserOrganisation);
    prismaMock.organisation.findUniqueOrThrow
      .mockResolvedValueOnce({ ownerUserId: 1 })
      .mockResolvedValueOnce({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst
      .mockResolvedValueOnce({ id: 'credits_reseller', credits: 100 })
      .mockResolvedValueOnce({ id: 'credits_buyer', credits: 20 });
    prismaMock.userCredits.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.userCredits.update.mockResolvedValue({ id: 'credits_buyer', credits: 70 });
    prismaMock.resellerCreditTransaction.update.mockResolvedValue({
      id: 'txn_pending_manual',
      status: ResellerCreditTransactionStatus.COMPLETED,
    });

    const result = await processResellerPaystackWebhook({
      paystackReference: 'ref_retry',
      metadata: baseMetadata,
      amountInCents: 45000,
      purchaserEmail: 'buyer@example.com',
    });

    expect(result.fulfilled).toBe(true);
    expect(sendResellerInsufficientCreditsEmailMock).not.toHaveBeenCalled();
  });
});

describe('reseller profile and packages flow', () => {
  it('returns null profile data for organisations without a reseller profile', async () => {
    const { getResellerProfileByOrganisationId } = await import('./reseller-profile');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const profile = await getResellerProfileByOrganisationId('org_1');

    expect(profile).toBeNull();
  });

  it('returns only enabled packages on public affiliate lookup', async () => {
    const { getResellerProfileByAffiliateSlug } = await import('./reseller-profile');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      affiliateSlug: 'acme-reseller',
      status: ResellerProfileStatus.ACTIVE,
      packages: [{ id: 'pkg_enabled', isEnabled: true, creditAmount: 50 }],
      organisation: { id: 'org_1', name: 'Acme', url: 'acme' },
    });
    getOrganisationCreditsMock.mockResolvedValue(80);

    const profile = await getResellerProfileByAffiliateSlug('acme-reseller');

    expect(profile?.availableCredits).toBe(80);
    expect(profile?.packages).toHaveLength(1);
    expect(prismaMock.resellerProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { affiliateSlug: 'acme-reseller' },
        include: expect.objectContaining({
          packages: expect.objectContaining({
            where: { isEnabled: true },
          }),
        }),
      }),
    );
  });

  it('toggles package availability by catalog package id', async () => {
    const { updateResellerPackages } = await import('./reseller-profile');

    prismaMock.resellerProfile.findUnique
      .mockResolvedValueOnce({
        id: 'profile_1',
        packages: [
          { id: 'pkg_1', catalogPackageId: 'payg-20' },
          { id: 'pkg_2', catalogPackageId: 'payg-50' },
        ],
      })
      .mockResolvedValueOnce({
        id: 'profile_1',
        organisationId: 'org_1',
        packages: [],
        organisation: { id: 'org_1', name: 'Acme', url: 'acme' },
      });

    getOrganisationCreditsMock.mockResolvedValue(50);
    prismaMock.resellerPackage.update.mockResolvedValue({});

    await updateResellerPackages({
      organisationId: 'org_1',
      enabledCatalogPackageIds: ['payg-50'],
    });

    expect(prismaMock.resellerPackage.update).toHaveBeenCalledWith({
      where: { id: 'pkg_1' },
      data: { isEnabled: false },
    });
    expect(prismaMock.resellerPackage.update).toHaveBeenCalledWith({
      where: { id: 'pkg_2' },
      data: { isEnabled: true },
    });
  });
});

describe('completePendingResellerTransaction flow', () => {
  it('transfers credits and completes a pending transaction', async () => {
    const { completePendingResellerTransaction } = await import(
      './complete-pending-reseller-transaction'
    );

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'reseller_org',
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: false,
      organisation: {
        ownerUserId: 1,
      },
    });

    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue({
      id: 'txn_pending_manual',
      resellerProfileId: 'profile_1',
      purchaserOrganisationId: 'buyer_org',
      credits: 50,
      status: ResellerCreditTransactionStatus.PENDING,
    });
    prismaMock.organisation.findUniqueOrThrow.mockResolvedValue({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst
      .mockResolvedValueOnce({ id: 'credits_reseller', credits: 100 })
      .mockResolvedValueOnce({ id: 'credits_buyer', credits: 20 });
    prismaMock.userCredits.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.userCredits.update.mockResolvedValue({ id: 'credits_buyer', credits: 70 });
    prismaMock.resellerCreditTransaction.update.mockResolvedValue({
      id: 'txn_pending_manual',
      status: ResellerCreditTransactionStatus.COMPLETED,
      completedAt: new Date('2026-07-13T10:00:00.000Z'),
    });

    const result = await completePendingResellerTransaction({
      organisationId: 'reseller_org',
      transactionId: 'txn_pending_manual',
    });

    expect(result.status).toBe(ResellerCreditTransactionStatus.COMPLETED);
    expect(prismaMock.userCredits.updateMany).toHaveBeenCalled();
    expect(prismaMock.userCredits.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'credits_buyer' },
        data: expect.objectContaining({
          credits: { increment: 50 },
        }),
      }),
    );
  });

  it('rejects manual transfer when credits are still insufficient', async () => {
    const { completePendingResellerTransaction } = await import(
      './complete-pending-reseller-transaction'
    );

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'reseller_org',
      status: ResellerProfileStatus.ACTIVE,
      allowNegativeCredits: false,
      organisation: {
        ownerUserId: 1,
      },
    });

    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.resellerCreditTransaction.findUnique.mockResolvedValue({
      id: 'txn_pending_manual',
      resellerProfileId: 'profile_1',
      purchaserOrganisationId: 'buyer_org',
      credits: 50,
      status: ResellerCreditTransactionStatus.PENDING,
    });
    prismaMock.organisation.findUniqueOrThrow.mockResolvedValue({ ownerUserId: 99 });
    prismaMock.userCredits.findFirst.mockResolvedValue({ id: 'credits_reseller', credits: 5 });
    prismaMock.userCredits.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      completePendingResellerTransaction({
        organisationId: 'reseller_org',
        transactionId: 'txn_pending_manual',
      }),
    ).rejects.toThrow('Insufficient credits to complete this transfer');
  });
});

describe('reseller transactions flow', () => {
  it('returns empty results when organisation has no reseller profile', async () => {
    const { findResellerTransactions } = await import('./reseller-profile');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const result = await findResellerTransactions({
      organisationId: 'org_1',
    });

    expect(result).toEqual({
      data: [],
      count: 0,
      currentPage: 1,
      perPage: 20,
      totalPages: 0,
    });
  });

  it('exports transactions and flags truncation above the export limit', async () => {
    const { exportResellerTransactions, RESELLER_TRANSACTION_EXPORT_LIMIT } = await import(
      './reseller-profile'
    );

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      vatNumber: '4123456789',
      organisation: { id: 'org_1', name: 'Acme Corp' },
    });
    prismaMock.resellerCreditTransaction.count.mockResolvedValue(
      RESELLER_TRANSACTION_EXPORT_LIMIT + 1,
    );
    prismaMock.resellerCreditTransaction.findMany.mockResolvedValue([
      {
        id: 'txn_1',
        grossAmount: 45000,
        vatAmount: 5870,
        createdAt: new Date('2026-07-03T10:00:00.000Z'),
      },
    ]);

    const result = await exportResellerTransactions({
      organisationId: 'org_1',
      fromDate: new Date('2026-07-01'),
      toDate: new Date('2026-07-31'),
    });

    expect(result.resellerOrganisationName).toBe('Acme Corp');
    expect(result.truncated).toBe(true);
    expect(result.count).toBe(RESELLER_TRANSACTION_EXPORT_LIMIT + 1);
    expect(prismaMock.resellerCreditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: RESELLER_TRANSACTION_EXPORT_LIMIT,
      }),
    );
  });
});

describe('reseller affiliate slug flow', () => {
  it('reports availability for valid unused slugs', async () => {
    const { checkResellerAffiliateSlugAvailability } = await import('./affiliate-slug');

    prismaMock.resellerProfile.findUnique.mockResolvedValue(null);

    const result = await checkResellerAffiliateSlugAvailability({
      organisationId: 'org_1',
      affiliateSlug: 'acme-partner',
    });

    expect(result).toEqual({
      isValid: true,
      isAvailable: true,
      normalizedSlug: 'acme-partner',
      message: null,
    });
  });

  it('reports taken slugs as unavailable', async () => {
    const { checkResellerAffiliateSlugAvailability } = await import('./affiliate-slug');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      organisationId: 'org_2',
    });

    const result = await checkResellerAffiliateSlugAvailability({
      organisationId: 'org_1',
      affiliateSlug: 'acme-partner',
    });

    expect(result.isAvailable).toBe(false);
    expect(result.message).toBe('This affiliate URL is already in use.');
  });

  it('treats the current organisation slug as available', async () => {
    const { checkResellerAffiliateSlugAvailability } = await import('./affiliate-slug');

    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      organisationId: 'org_1',
    });

    const result = await checkResellerAffiliateSlugAvailability({
      organisationId: 'org_1',
      affiliateSlug: 'acme-partner',
    });

    expect(result.isAvailable).toBe(true);
  });

  it('updates affiliate slug when the new value is unique', async () => {
    const { updateResellerAffiliateSlug } = await import('./affiliate-slug');

    prismaMock.resellerProfile.findUnique
      .mockResolvedValueOnce({
        id: 'profile_1',
        organisationId: 'org_1',
        affiliateSlug: 'old-slug',
      })
      .mockResolvedValueOnce(null);

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      affiliateSlug: 'new-slug',
    });

    const result = await updateResellerAffiliateSlug({
      organisationId: 'org_1',
      affiliateSlug: 'new-slug',
    });

    expect(result.affiliateSlug).toBe('new-slug');
    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith({
      where: { organisationId: 'org_1' },
      data: { affiliateSlug: 'new-slug' },
    });
  });

  it('rejects duplicate affiliate slugs', async () => {
    const { updateResellerAffiliateSlug } = await import('./affiliate-slug');

    prismaMock.resellerProfile.findUnique
      .mockResolvedValueOnce({
        id: 'profile_1',
        organisationId: 'org_1',
        affiliateSlug: 'old-slug',
      })
      .mockResolvedValueOnce({
        organisationId: 'org_2',
      });

    await expect(
      updateResellerAffiliateSlug({
        organisationId: 'org_1',
        affiliateSlug: 'taken-slug',
      }),
    ).rejects.toThrow('This affiliate URL is already in use. Please choose another.');
  });
});

describe('reseller formatting helpers', () => {
  it('formats cents as decimal currency strings', () => {
    expect(formatCentsAsDecimal(45000)).toBe('450.00');
    expect(formatCentsAsDecimal(0)).toBe('0.00');
  });
});

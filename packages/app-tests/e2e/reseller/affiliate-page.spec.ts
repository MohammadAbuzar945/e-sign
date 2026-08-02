import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { nanoid } from '@documenso/lib/universal/id';
import { ResellerProfileStatus } from '@prisma/client';
import { seedActiveReseller, seedResellerProfile } from '@documenso/prisma/seed/reseller';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

test('[RESELLER AFFILIATE]: shows enabled packages on public affiliate page', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const affiliateSlug = `affiliate-${nanoid()}`;

  const { user, organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await seedActiveReseller({
    organisationId: organisation.id,
    applicantUserId: user.id,
    applicantName: user.name ?? user.email,
    applicantEmail: user.email,
    organisationName: organisation.name,
    affiliateSlug,
    enabledCatalogPackageIds: ['payg-50'],
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}`);

  await expect(page.getByRole('heading', { name: 'Buy e-sign credits' })).toBeVisible();
  await expect(page.getByText('50 envelopes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy now' }).first()).toBeVisible();
});

test('[RESELLER AFFILIATE]: unauthenticated buy redirects to sign in', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const affiliateSlug = `affiliate-${nanoid()}`;

  const { user, organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await seedActiveReseller({
    organisationId: organisation.id,
    applicantUserId: user.id,
    applicantName: user.name ?? user.email,
    applicantEmail: user.email,
    organisationName: organisation.name,
    affiliateSlug,
    enabledCatalogPackageIds: ['payg-50'],
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}`);
  await page.getByRole('button', { name: 'Buy now' }).first().click();

  await page.waitForURL(/\/signin/);
  await expect(page.url()).toContain(`returnTo=${encodeURIComponent(`/r/${affiliateSlug}`)}`);
});

test('[RESELLER AFFILIATE]: inactive reseller shows not found message', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const affiliateSlug = `inactive-${nanoid()}`;

  const { organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await seedResellerProfile({
    organisationId: organisation.id,
    affiliateSlug,
    status: ResellerProfileStatus.INACTIVE,
    enabledCatalogPackageIds: ['payg-50'],
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}`);

  await expect(page.getByText('Reseller not found')).toBeVisible();
  await expect(page.getByText('This affiliate link is invalid or no longer active.')).toBeVisible();
});

test('[RESELLER AFFILIATE]: reseller without enabled packages shows empty state', async ({
  page,
}) => {
  const resellerEmail = seedTestEmail();
  const affiliateSlug = `no-packages-${nanoid()}`;

  const { user, organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await seedActiveReseller({
    organisationId: organisation.id,
    applicantUserId: user.id,
    applicantName: user.name ?? user.email,
    applicantEmail: user.email,
    organisationName: organisation.name,
    affiliateSlug,
    enabledCatalogPackageIds: [],
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}`);

  await expect(page.getByText('No packages available')).toBeVisible();
  await expect(page.getByText('No packages are currently available for sale.')).toBeVisible();
});

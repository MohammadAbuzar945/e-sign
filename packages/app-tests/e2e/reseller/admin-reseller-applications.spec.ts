import { expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { seedResellerApplication } from '@documenso/prisma/seed/reseller';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible, expectToastTextToBeVisible } from '../fixtures/generic';

test('[RESELLER ADMIN]: can view and reject a pending application', async ({ page }) => {
  const adminEmail = seedTestEmail();
  const applicantEmail = seedTestEmail();
  const rejectionReason = `E2E rejection ${nanoid()}`;

  const { user: adminUser } = await seedUser({
    email: adminEmail,
    isAdmin: true,
  });

  const { user: applicantUser, organisation } = await seedUser({
    email: applicantEmail,
    isPersonalOrganisation: false,
  });

  await seedResellerApplication({
    organisationId: organisation.id,
    applicantUserId: applicantUser.id,
    applicantName: applicantUser.name ?? applicantUser.email,
    applicantEmail: applicantUser.email,
    organisationName: organisation.name,
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/reseller-applications',
  });

  await expect(page.getByText('Reseller Applications')).toBeVisible();

  await page.getByPlaceholder('Search by organisation, applicant, or email').fill(organisation.name);
  await page.waitForTimeout(600);

  const applicationRow = page.getByRole('row', { name: organisation.name });
  await expect(applicationRow).toBeVisible();

  await applicationRow.getByRole('checkbox').click();

  await expect(page.getByText('Selected application')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Terms & Conditions' })).toBeVisible();

  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.locator('#reseller-application-action-reason').fill(rejectionReason);
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();

  await expectToastTextToBeVisible(page, 'Application rejected');

  await page.reload();
  await page.getByPlaceholder('Search by organisation, applicant, or email').fill(organisation.name);
  await page.waitForTimeout(600);

  await applicationRow.getByRole('checkbox').click();
  await expect(page.getByText(rejectionReason)).toBeVisible();
});

test('[RESELLER ADMIN]: applicant sees rejected application timeline', async ({ page }) => {
  const adminEmail = seedTestEmail();
  const applicantEmail = seedTestEmail();
  const rejectionReason = `E2E rejection ${nanoid()}`;

  const { user: adminUser } = await seedUser({
    email: adminEmail,
    isAdmin: true,
  });

  const { user: applicantUser, organisation } = await seedUser({
    email: applicantEmail,
    isPersonalOrganisation: false,
  });

  await seedResellerApplication({
    organisationId: organisation.id,
    applicantUserId: applicantUser.id,
    applicantName: applicantUser.name ?? applicantUser.email,
    applicantEmail: applicantUser.email,
    organisationName: organisation.name,
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/reseller-applications',
  });

  await page.getByPlaceholder('Search by organisation, applicant, or email').fill(organisation.name);
  await page.waitForTimeout(600);

  const applicationRow = page.getByRole('row', { name: organisation.name });
  await applicationRow.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.locator('#reseller-application-action-reason').fill(rejectionReason);
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
  await expectToastTextToBeVisible(page, 'Application rejected');

  await apiSignin({
    page,
    email: applicantUser.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await expectTextToBeVisible(page, 'Application rejected');
  await expect(page.getByText(rejectionReason)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to resell' })).toBeEnabled();
});

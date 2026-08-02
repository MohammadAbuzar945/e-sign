import { expect, test } from '@playwright/test';

import { seedTestEmail } from '@documenso/prisma/seed/users';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible, expectToastTextToBeVisible } from '../fixtures/generic';

test('[RESELLER]: shows reseller programme for any signed-in org owner', async ({ page }) => {
  const { user, organisation } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await expect(page.getByText('Reseller programme')).toBeVisible();
});

test('[RESELLER]: user can submit a reseller application', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const { user, organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await expect(page.getByText('Reseller programme')).toBeVisible();
  await expect(page.getByText('Ready to apply')).toBeVisible();

  await page.getByRole('button', { name: 'Apply to resell' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Your organisation snapshot')).toBeVisible();

  await page.getByRole('button', { name: 'Submit application' }).click();

  await expectToastTextToBeVisible(page, 'Application submitted');

  await expect(page.getByText('Application in review')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Application submitted' })).toBeDisabled();
});

test('[RESELLER]: blocks duplicate application while one is in review', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const { user, organisation } = await seedUser({
    email: resellerEmail,
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  await page.getByRole('button', { name: 'Apply to resell' }).click();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expectToastTextToBeVisible(page, 'Application submitted');

  await page.reload();

  await expect(page.getByRole('button', { name: 'Application submitted' })).toBeDisabled();
  await expect(page.getByText('Application in review')).toBeVisible();
});

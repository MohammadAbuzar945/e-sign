import { expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { seedActiveReseller } from '@documenso/prisma/seed/reseller';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectToastTextToBeVisible } from '../fixtures/generic';

test('[RESELLER]: active reseller can manage settings and enable packages', async ({ page }) => {
  const resellerEmail = seedTestEmail();
  const affiliateSlug = `reseller-${nanoid()}`;

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
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/reseller`,
  });

  await expect(page.getByRole('heading', { name: 'Reseller', level: 3 })).toBeVisible();
  await expect(page.getByText('Manage your affiliate link, Paystack settings, branding, packages, and sales records.')).toBeVisible();

  await page.getByLabel('Paystack public key').fill('pk_test_e2e_public_key');
  await page.getByLabel('Paystack secret key').fill('sk_test_e2e_secret_key');
  await page.getByRole('button', { name: 'Save Paystack settings' }).click();
  await expectToastTextToBeVisible(page, 'Reseller settings updated');

  const packageLabel = page.locator('label').filter({ hasText: '50 envelopes' });
  await packageLabel.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Save packages' }).click();
  await expectToastTextToBeVisible(page, 'Packages updated');

  await page.reload();

  await expect(packageLabel.getByRole('checkbox')).toBeChecked();
});

test('[RESELLER]: redirects non-allowlisted users away from reseller settings', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/reseller`,
  });

  await expect(page).toHaveURL(new RegExp(`/o/${organisation.url}/settings/general`));
});

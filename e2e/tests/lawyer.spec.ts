import { expect, test } from '@playwright/test';
import { t } from '@sba/shared';

import { createLawyer, signInLawyer } from '../support/fixtures.js';

test('a lawyer files a grievance and follows it in “my requests”', async ({ page }) => {
  const lawyer = await createLawyer();
  await signInLawyer(page, lawyer);

  await page.getByRole('tab', { name: t('lawyer.tabs.grievance') }).click();
  await page.getByLabel(t('lawyer.grievanceTypes.JUDICIAL_MATTER')).check();
  const subject = `Delay ${Date.now().toString(36)}`;
  await page.locator('#subject').fill(subject);
  await page
    .locator('#description')
    .fill('The hearing has been postponed repeatedly without notice to the parties.');
  await page.locator('#court').fill('Court of First Instance');
  await page.getByRole('button', { name: t('lawyer.submit') }).click();

  await expect(page.getByRole('status')).toContainText('GRV-');
  await expect(page.getByText(subject)).toBeVisible();
  await expect(page.getByText(t('labels.status.PENDING_REVIEW')).first()).toBeVisible();
});

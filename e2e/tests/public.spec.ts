import { expect, test } from '@playwright/test';
import { t } from '@sba/shared';

import { owner } from '../support/fixtures.js';

test('a visitor submits an audience request and receives a reference number @phone', async ({
  page,
}) => {
  const name = `Visitor ${Date.now().toString(36)}`;
  await page.goto('/request');
  await page.locator('#name').fill(name);
  await page.locator('#capacity').fill('Citizen');
  await page.locator('#phone').fill('+963933000111');
  await page.locator('#purpose').fill('Requesting an audience about a professional matter.');
  await page.getByRole('button', { name: t('request.submit') }).click();

  await expect(page.getByText(t('request.receivedTitle'))).toBeVisible();
  const reference = (await page.locator('p[dir=ltr]').innerText()).trim();
  expect(reference).toMatch(/^REQ-\d{4}-[0-9A-Z]{6}$/);

  const ticket = await owner().ticket.findUniqueOrThrow({ where: { referenceCode: reference } });
  // Never confirmed automatically (hard rule 1).
  expect(ticket.status).toBe('PENDING_REVIEW');
});

test('invalid input is reported without sending anything', async ({ page }) => {
  await page.goto('/request');
  await page.locator('#name').fill('A');
  await page.locator('#capacity').fill('Citizen');
  await page.locator('#phone').fill('0933');
  await page.locator('#purpose').fill('short');
  await page.getByRole('button', { name: t('request.submit') }).click();
  // The browser's own validation stops the submission; no reference appears.
  await expect(page.getByText(t('request.receivedTitle'))).toHaveCount(0);
  expect(await page.locator('#phone').evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(
    false,
  );
});

import { expect, test, type APIRequestContext } from '@playwright/test';
import { t } from '@sba/shared';

import { createRescheduleLink, createStaff, owner, signInStaff } from '../support/fixtures.js';

async function submitRequest(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/api/v1/public/audience-requests', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      requesterType: 'CITIZEN',
      requesterFullName: name,
      officialCapacity: 'Citizen',
      contactPhone: '+963933000111',
      purpose: 'Requesting an audience about a professional matter.',
    },
  });
  expect(res.status()).toBe(201);
  const { referenceCode } = (await res.json()) as { referenceCode: string };
  return (await owner().ticket.findUniqueOrThrow({ where: { referenceCode } })).id;
}

test('a matter delegated to a branch is closed from the branch inbox', async ({
  page,
  browser,
}) => {
  const officer = await createStaff(['SECRETARIAT_OFFICER']);
  const branch = await createStaff(['BRANCH_OFFICER'], { orgUnitCode: 'BRANCH_DAMASCUS' });
  const name = `Delegated ${Date.now().toString(36)}`;
  const ticketId = await submitRequest(page.request, name);

  await signInStaff(page, officer);
  await page.locator('#queue-search').fill(name);
  await page.getByRole('button', { name: t('secretariat.queue.search') }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: t('secretariat.actions.delegate') }).click();
  await page.locator('#target').selectOption('UNIT:BRANCH_DAMASCUS');
  await page
    .locator('dialog')
    .getByRole('button', { name: t('secretariat.actions.confirm') })
    .click();
  await expect(page.getByText(t('secretariat.delegate.success'))).toBeVisible();

  const branchPage = await (await browser.newContext()).newPage();
  await signInStaff(branchPage, branch);
  await expect(branchPage).toHaveURL(/\/units$/);
  await branchPage.getByRole('button', { name: new RegExp(name) }).click();
  await branchPage.getByRole('button', { name: t('units.close') }).click();
  await branchPage.locator('#note').fill('Handled by the branch council.');
  await branchPage.getByRole('button', { name: t('secretariat.actions.confirm') }).click();
  await expect(branchPage.getByText(t('units.closed'))).toBeVisible();

  const ticket = await owner().ticket.findUniqueOrThrow({ where: { id: ticketId } });
  expect(ticket.status).toBe('CLOSED');
});

test('a reschedule link works once and shows no free times @phone', async ({ page }) => {
  const ticketId = await submitRequest(page.request, `Postponed ${Date.now().toString(36)}`);
  const token = await createRescheduleLink(ticketId);

  await page.goto(`/reschedule#${token}`);
  // The token is removed from the address bar as soon as it is read.
  await expect(page).toHaveURL(/\/reschedule$/);
  await page.locator('#preference').fill('Sunday mornings');
  await page.getByRole('button', { name: t('reschedule.confirm') }).click();
  await expect(page.getByText(t('reschedule.doneTitle'))).toBeVisible();

  const used = await owner().actionToken.findFirstOrThrow({ where: { ticketId } });
  expect(used.consumedAt).not.toBeNull();

  // Open the same link again, as a fresh visit.
  await page.goto('about:blank');
  await page.goto(`/reschedule#${token}`);
  await page.getByRole('button', { name: t('reschedule.confirm') }).click();
  await expect(page.getByText(t('errors.linkInvalid'))).toBeVisible();
});

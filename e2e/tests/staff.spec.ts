import { expect, test, type APIRequestContext } from '@playwright/test';
import { t } from '@sba/shared';

import { createStaff, damascusDate, ensureRoom, owner, signInStaff } from '../support/fixtures.js';

async function submitRequest(request: APIRequestContext, name: string) {
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
}

test('staff screens send a visitor without a session to sign in', async ({ page }) => {
  await page.goto('/secretariat');
  await expect(page).toHaveURL(/\/login\?next=%2Fsecretariat$/);
});

test('the Secretariat approves a request and it appears on the Grand Syndic’s agenda', async ({
  page,
  browser,
}) => {
  await ensureRoom();
  const syndic = await createStaff(['GRAND_SYNDIC']);
  const officer = await createStaff(['SECRETARIAT_OFFICER']);
  const name = `Visitor ${Date.now().toString(36)}`;
  await submitRequest(page.request, name);

  await signInStaff(page, officer);
  await expect(page).toHaveURL(/\/secretariat$/);
  await page.locator('#queue-search').fill(name);
  await page.getByRole('button', { name: t('secretariat.queue.search') }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: t('secretariat.actions.approve') }).click();
  const tomorrow = damascusDate(1);
  await page.locator('#ap-date').fill(tomorrow);
  await page.locator('#ap-time').fill('10:00');
  await page
    .locator('dialog')
    .getByRole('button', { name: t('secretariat.actions.confirm') })
    .click();
  await expect(page.getByText(t('secretariat.approve.success'))).toBeVisible();

  const ticket = await owner().ticket.findFirstOrThrow({
    where: { audienceRequest: { requesterFullName: name } },
  });
  expect(ticket.status).toBe('APPROVED');

  const syndicPage = await (await browser.newContext()).newPage();
  await signInStaff(syndicPage, syndic);
  await expect(syndicPage).toHaveURL(/\/syndic$/);
  await syndicPage.getByRole('tab', { name: t('syndic.tabs.calendar') }).click();
  if (tomorrow.slice(0, 7) !== damascusDate(0).slice(0, 7)) {
    await syndicPage.getByRole('button', { name: t('agenda.nextMonth') }).click();
  }
  await expect(syndicPage.getByText(name)).toBeVisible();
});

test('a network failure shows an error with retry, not stale success', async ({ page }) => {
  const officer = await createStaff(['SECRETARIAT_OFFICER']);
  await signInStaff(page, officer);
  await expect(page).toHaveURL(/\/secretariat$/);

  await page.route('**/api/v1/secretariat/queue**', (route) => route.abort());
  await page.reload();
  const alert = page.getByRole('alert').filter({ hasText: t('errors.network') });
  await expect(alert).toBeVisible();

  await page.unroute('**/api/v1/secretariat/queue**');
  await alert.getByRole('button', { name: t('common.retry') }).click();
  await expect(alert).toHaveCount(0);
});

test('a staff member without the role is refused the screen', async ({ page }) => {
  const member = await createStaff(['COUNCIL_MEMBER']);
  await signInStaff(page, member);
  await expect(page).toHaveURL(/\/member$/);
  await page.goto('/secretariat');
  await expect(page.getByText(t('errors.forbidden'))).toBeVisible();
});

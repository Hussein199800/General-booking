import { expect, test, type Page } from '@playwright/test';
import { t } from '@sba/shared';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('public pages render without console errors or CSP violations @phone', async ({ page }) => {
  const errors = collectErrors(page);
  for (const path of ['/', '/login', '/request', '/reschedule']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
  // Nothing wider than the screen (no sideways scrolling on phones).
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the roles directory searches (Arabic-aware) and filters by category', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(t('home.hero.title1'));

  const search = page.locator('#roles-search');
  const status = page.locator('#roles').getByRole('status');
  await expect(status).toHaveText(t('home.roles.count', { count: 9 }));

  await search.fill(t('home.roles.items.AUDITOR.title'));
  await expect(status).toHaveText(t('home.roles.count', { count: 1 }));
  await expect(page.locator('#roles mark.hit').first()).toBeVisible();

  await search.fill('zzzz');
  await expect(page.getByText(t('home.roles.empty'))).toBeVisible();
  await page.getByRole('button', { name: t('home.roles.clear') }).click();
  await expect(status).toHaveText(t('home.roles.count', { count: 9 }));

  await page.getByRole('button', { name: t('home.roles.categories.LEADERSHIP') }).click();
  await expect(status).toHaveText(t('home.roles.count', { count: 2 }));
  await expect(
    page.getByRole('heading', { name: t('home.roles.items.GRAND_SYNDIC.title') }),
  ).toBeVisible();
});

test('FAQ answers open, and header links reach their sections', async ({ page }) => {
  await page.goto('/');
  const answer = page.getByText(t('home.faq.a1'));
  await expect(answer).toBeHidden();
  await page.getByText(t('home.faq.q1')).click();
  await expect(answer).toBeVisible();

  await page
    .getByRole('navigation', { name: t('site.nav.label') })
    .getByRole('link', { name: t('site.nav.journey') })
    .click();
  await expect(page).toHaveURL(/#journey$/);
  await expect(page.locator('#journey-title')).toBeInViewport();

  await page
    .getByRole('link', { name: t('home.hero.ctaRequest') })
    .first()
    .click();
  await expect(page).toHaveURL(/\/request$/);
});

test('the phone menu opens, navigates and closes @phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.goto('/');
  await page.getByRole('button', { name: t('nav.openMenu') }).click();
  const menu = page.locator('#site-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: t('site.nav.roles') }).click();
  await expect(page).toHaveURL(/#roles$/);
  await expect(menu).toBeHidden();
});

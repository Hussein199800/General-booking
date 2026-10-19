import { expect, test, type Page } from '@playwright/test';
import { foldArabic, t } from '@sba/shared';

const ROLE_COUNT = 10;

const roleCards = (page: Page) => page.locator('[data-role]');

/** Collects console errors and CSP violations from the first script onwards. */
async function watchProblems(page: Page): Promise<string[]> {
  const problems: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

test('the home page renders cleanly: no errors, no CSP violations, no sideways scroll @phone', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(t('home.hero.titleLead'));
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await expectNoHorizontalScroll(page);
  expect(problems).toEqual([]);
});

test('the two main calls to action lead to the request form and the lawyers’ door', async ({
  page,
}) => {
  const hero = page.locator('section[aria-labelledby="hero-title"]');
  await page.goto('/');
  await hero.getByRole('link', { name: t('home.hero.primary') }).click();
  await expect(page).toHaveURL(/\/request$/);
  await expect(page.getByRole('heading', { name: t('request.title') })).toBeVisible();

  await page.goto('/');
  await hero.getByRole('link', { name: t('home.hero.secondary') }).click();
  await expect(page).toHaveURL(/\/login\?door=lawyer$/);
  await expect(page.getByRole('tab', { name: t('login.lawyerDoor') })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#registrationNumber')).toBeVisible();
});

test('the roles directory searches Arabic text regardless of hamza and taa marbuta @phone', async ({
  page,
}) => {
  await page.goto('/');
  await expect(roleCards(page)).toHaveCount(ROLE_COUNT);
  // The folded form drops the hamza on the alef and turns taa marbuta into haa.
  const query = foldArabic(t('home.directory.roles.SECRETARIAT_HEAD.title'));
  expect(query).not.toBe(t('home.directory.roles.SECRETARIAT_HEAD.title'));

  await page.getByRole('searchbox', { name: t('home.directory.searchLabel') }).fill(query);
  const head = page.locator('[data-role="SECRETARIAT_HEAD"]');
  await expect(head).toBeVisible();
  await expect(head.locator('mark.hit').first()).toBeVisible();
  const count = await roleCards(page).count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(ROLE_COUNT);
  for (const card of await roleCards(page).all()) {
    await expect(card.locator('mark.hit').first()).toBeVisible();
  }
  await expect(
    page.getByRole('status').filter({ hasText: t('home.directory.results', { count }) }),
  ).toBeVisible();
});

test('the roles directory filters by category and explains an empty result', async ({ page }) => {
  await page.goto('/');
  const units = page.getByRole('button', { name: t('home.directory.categories.UNITS') });
  await units.click();
  await expect(units).toHaveAttribute('aria-pressed', 'true');
  await expect(roleCards(page)).toHaveCount(2);
  await expect(page.locator('[data-role="BRANCH_OFFICER"]')).toBeVisible();
  await expect(page.locator('[data-role="COMMITTEE_MEMBER"]')).toBeVisible();

  await page.getByRole('searchbox', { name: t('home.directory.searchLabel') }).fill('zzzz');
  await expect(roleCards(page)).toHaveCount(0);
  await expect(page.getByText(t('home.directory.empty'))).toBeVisible();
  await page.getByRole('button', { name: t('home.directory.reset') }).click();
  await expect(roleCards(page)).toHaveCount(ROLE_COUNT);
  await expect(
    page.getByRole('button', { name: t('home.directory.categories.ALL') }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('FAQ answers open and close', async ({ page }) => {
  await page.goto('/');
  const item = page.locator('details.faq-item').first();
  const answer = item.getByText(t('home.faq.a1'));
  await expect(answer).toBeHidden();
  await item.getByText(t('home.faq.q1')).click();
  await expect(answer).toBeVisible();
  await item.getByText(t('home.faq.q1')).click();
  await expect(answer).toBeHidden();
});

test('the phone menu opens, navigates to a section and closes @phone', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'The dropdown menu is the phone layout.');
  await page.goto('/');
  const menu = page.locator('details.site-menu');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  await menu.getByRole('link', { name: t('nav.faq') }).click();
  await expect(page).toHaveURL(/#faq$/);
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: t('home.faq.heading') })).toBeInViewport();

  await menu.locator('summary').click();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('every internal link on the home page resolves', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
  expect(hrefs.length).toBeGreaterThan(5);
  const ids = new Set(
    await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id)),
  );
  for (const href of hrefs) {
    const [path, hash] = href.split('#');
    if (hash) expect(ids, `${href} points at a missing section`).toContain(hash);
    const response = await request.get(path || '/');
    expect(response.status(), href).toBeLessThan(400);
  }
});

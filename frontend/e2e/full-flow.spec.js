const { test, expect } = require('@playwright/test');

test.describe('Flix Browser E2E Full Flow', () => {
  const email = `pw-e2e-${Date.now()}@flix.test`;
  const password = 'Password123!';
  const name = 'Playwright E2E User';

  test('1. Unauthenticated user is redirected from /home to /login', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('2. Invalid login credentials display a handled error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nonexistent-e2e@flix.test');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.text-error')).toBeVisible();
  });

  test('3. Full user journey: Register -> Home -> Movie Detail -> My List persistence -> Watch Mux -> Profile', async ({
    page,
  }) => {
    // Register via UI
    await page.goto('/register');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/sign-up/email') && res.status() === 200,
      ),
      page.getByRole('button', { name: 'Sign Up' }).click(),
    ]);

    // Redirects to /home with TMDB catalog
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await expect(page.locator('header')).toBeVisible();

    // Navigate to seeded playable movie (TMDB #129 - Spirited Away)
    await page.goto('/movie/129');
    await expect(page.getByRole('button', { name: /My List/i })).toBeVisible();

    // Add to My List and verify persistence after reload
    await page.getByRole('button', { name: /My List/i }).click();
    await expect(page.getByRole('button', { name: /In My List/i })).toBeVisible();

    await page.goto('/my-list');
    await expect(page.getByRole('heading', { name: 'My List' })).toBeVisible();
    await page.reload();
    await expect(page.locator('a[href="/movie/129"]').first()).toBeVisible();

    // Play movie via player (Mux or trailer)
    await page.goto('/movie/129');
    await page.getByRole('link', { name: /^Play$/i }).click();
    await expect(page).toHaveURL(/\/watch\//);
    await expect(
      page.locator('mux-player, video, iframe').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Verify Profile page shows user & region
    await page.goto('/profile');
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText('Watch Region')).toBeVisible();
  });
});

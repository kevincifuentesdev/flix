const { test, expect } = require('@playwright/test');

test.describe('Error Suite 1: Authentication & Route Protection', () => {
  test('Unauthenticated access to protected routes redirects to /login', async ({ page }) => {
    for (const route of ['/home', '/my-list', '/profile', '/settings', '/admin']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('Invalid login credentials display a handled error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('missing-user@flix.test');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.text-error')).toBeVisible();
  });
});

test.describe('Error Suite 2: Registration Form Validation Errors', () => {
  test('Mismatched passwords show validation error without creating session', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Name').fill('Mismatch User');
    await page.getByLabel('Email').fill(`mismatch-${Date.now()}@flix.test`);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('.text-error')).toBeVisible();
  });

  test('Duplicate email registration shows server error', async ({ page }) => {
    const duplicateEmail = `dup-${Date.now()}@flix.test`;

    // First registration succeeds
    await page.goto('/register');
    await page.getByLabel('Name').fill('Original User');
    await page.getByLabel('Email').fill(duplicateEmail);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Clear cookies and try registering again with the same email
    await page.context().clearCookies();
    await page.goto('/register');
    await page.getByLabel('Name').fill('Duplicate User');
    await page.getByLabel('Email').fill(duplicateEmail);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('.text-error')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Error Suite 3: Authorization (403) & Not Found (404)', () => {
  test('Standard user visiting /admin is redirected to /home and /non-existent shows 404', async ({
    page,
  }) => {
    const email = `std-err-${Date.now()}@flix.test`;
    await page.goto('/register');
    await page.getByLabel('Name').fill('Standard User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Non-admin user cannot stay on /admin
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/home/);

    // Non-existent route renders NotFoundView
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});

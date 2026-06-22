/**
 * Gate: Auth
 *
 * Merge-blocking test that verifies:
 * 1. Test login endpoint returns a valid JWT
 * 2. Token injection into localStorage works
 * 3. Protected route renders with auth (not redirected to login)
 * 4. Expected anchor element is present on the protected page
 *
 * This gate ensures authentication is not broken.
 * Requires: backend running with APP_ENV=test
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth.js';
import { SELECTORS } from '../selectors.js';
import { readFileSync, existsSync } from 'fs';

// Load config for dynamic values
const configPath = new URL('../e2e.config.json', import.meta.url).pathname;
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};
const protectedRoute = config.urls?.protectedRoute || '/dashboard';
const authType = config.auth?.type || 'jwt-localstorage';
const tokenKey = config.auth?.tokenKey || 'token';

test.describe('Gate: Auth', () => {
  test('authenticated user can access protected route', async ({ page, request }) => {
    // 1. Login via test endpoint + token injection
    const auth = await loginAsTestUser(page, request);

    // ASSERT 1: Token was obtained and is a valid JWT (3-part base64)
    expect(auth.token, 'Test login must return a token').toBeTruthy();
    expect(
      auth.token.split('.').length,
      'Token must be a valid JWT (header.payload.signature)',
    ).toBe(3);

    // 2. Navigate to protected route
    await page.goto(protectedRoute);
    await page.waitForLoadState('networkidle');

    // ASSERT 2: Page URL contains the protected route (no redirect to login)
    expect(
      page.url(),
      `Must stay on ${protectedRoute}, not redirect to login`,
    ).toContain(protectedRoute);

    // ASSERT 3: Expected anchor element is visible on the protected page
    const anchor = page.locator(SELECTORS.dashboardAnchor);
    await expect(
      anchor,
      'Dashboard anchor element must be visible on protected route',
    ).toBeVisible({ timeout: 10_000 });

    // ASSERT 4: Token persists in storage
    if (authType === 'jwt-localstorage' || authType === 'oauth-mock') {
      const storedToken = await page.evaluate(
        (key) => localStorage.getItem(key),
        tokenKey,
      );
      expect(storedToken, 'Token must persist in localStorage').toBe(auth.token);
    }
  });
});

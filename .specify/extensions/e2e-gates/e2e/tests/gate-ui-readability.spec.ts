/**
 * Gate: UI Readability
 *
 * Merge-blocking test that verifies core UI elements are:
 * 1. Visible (not display:none, visibility:hidden)
 * 2. Readable (not invisible text via opacity:0, font-size:0, color-on-color, clip, offscreen)
 * 3. Not blocked by overlays (modal, backdrop, absolute-positioned element on top)
 *
 * Uses computed style checks — NOT pixel diffing.
 * Catches: invisible text, hidden inputs, broken overlays, zero-size elements.
 *
 * Requires: backend running with APP_ENV=test (for auth)
 */

import { test } from '@playwright/test';
import { loginAsTestUser, clearAuth } from '../helpers/auth.js';
import { assertReadable, assertAllReadable } from '../helpers/readability.js';
import { SELECTORS } from '../selectors.js';
import { readFileSync, existsSync } from 'fs';

// Load config
const configPath = new URL('../e2e.config.json', import.meta.url).pathname;
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};
const protectedRoute = config.urls?.protectedRoute || '/dashboard';

test.describe('Gate: UI Readability', () => {
  test('protected page: core elements are visible, readable, and unblocked', async ({
    page,
    request,
  }) => {
    // Setup: authenticate and navigate to protected page
    await loginAsTestUser(page, request);
    await page.goto(protectedRoute);
    await page.waitForLoadState('networkidle');

    // ASSERT 1: Dashboard heading is readable
    await assertReadable(page, SELECTORS.dashboardHeading, 'Dashboard heading');

    // ASSERT 2: Navigation bar is readable
    await assertReadable(page, SELECTORS.navBar, 'Navigation bar');

    // ASSERT 3: Main content area is readable
    await assertReadable(page, SELECTORS.mainContent, 'Main content');

    // ASSERT 4: Dashboard anchor is readable (the key auth-dependent element)
    await assertReadable(page, SELECTORS.dashboardAnchor, 'Dashboard anchor');
  });

  test('login page: form elements are visible and readable', async ({ page, request }) => {
    // Navigate to login page (no auth needed)
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check all login form elements in batch
    await assertAllReadable(page, [
      // ASSERT 1: Login page container
      { selector: SELECTORS.loginPage, label: 'Login page' },
      // ASSERT 2: Email input
      { selector: SELECTORS.loginEmailInput, label: 'Email input' },
      // ASSERT 3: Submit button
      { selector: SELECTORS.loginSubmitButton, label: 'Submit button' },
    ]);
  });
});

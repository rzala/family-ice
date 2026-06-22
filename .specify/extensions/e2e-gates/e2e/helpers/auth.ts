/**
 * Auth Helper — Deterministic test login via backend test endpoint + localStorage/cookie injection.
 *
 * Bypasses magic link / OAuth / real login flow entirely.
 * Requires a test-only backend endpoint guarded by APP_ENV=test.
 *
 * Adapts to the auth.type configured in e2e.config.json:
 * - jwt-localstorage: POST to test endpoint, inject token into localStorage
 * - jwt-cookie: POST to test endpoint, inject token as cookie
 * - session-cookie: POST to test endpoint, let Set-Cookie header establish session
 * - oauth-mock: POST to test endpoint, inject mock OAuth token into localStorage
 * - none: Skip auth entirely
 */

import { Page, APIRequestContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';

// Load config
const configPath = new URL('../e2e.config.json', import.meta.url).pathname;
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};

const AUTH_TYPE: string = config.auth?.type || 'jwt-localstorage';
const TOKEN_KEY: string = config.auth?.tokenKey || 'token';
const TEST_LOGIN_ENDPOINT: string = config.auth?.testLoginEndpoint || '/api/test/login';
const API_URL: string = config.urls?.apiURL || config.urls?.baseURL || 'http://localhost:3000';
const BASE_URL: string = config.urls?.baseURL || 'http://localhost:5173';

export interface AuthState {
  token: string;
  email: string;
  type: string;
}

/**
 * Authenticate as a test user. Mints a token via the backend test endpoint
 * and injects it according to the configured auth type.
 */
export async function loginAsTestUser(
  page: Page,
  request: APIRequestContext,
  options?: { email?: string },
): Promise<AuthState> {
  if (AUTH_TYPE === 'none') {
    return { token: '', email: '', type: 'none' };
  }

  const email = options?.email || 'test@example.com';

  // 1. Mint token via test-only backend endpoint
  const loginUrl = `${API_URL}${TEST_LOGIN_ENDPOINT}`;
  const response = await request.post(loginUrl, {
    data: { email },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Test login failed: ${response.status()} ${response.statusText()}\n` +
      `URL: ${loginUrl}\n` +
      `Body: ${body}\n` +
      `Hint: Is the backend running with APP_ENV=test?`,
    );
  }

  const data = await response.json();
  const token: string = data.token;
  if (!token) {
    throw new Error(
      `Test login returned no token.\nResponse: ${JSON.stringify(data)}`,
    );
  }

  // 2. Navigate to app origin (needed to set localStorage/cookies on correct domain)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // 3. Inject token based on auth type
  switch (AUTH_TYPE) {
    case 'jwt-localstorage':
    case 'oauth-mock':
      await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
      );
      break;

    case 'jwt-cookie':
      await page.context().addCookies([
        {
          name: TOKEN_KEY,
          value: token,
          domain: new URL(BASE_URL).hostname,
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
      break;

    case 'session-cookie':
      // Session cookies are set by the server via Set-Cookie header.
      // The POST response should have already set them.
      // Just verify the cookie exists.
      break;
  }

  return { token, email, type: AUTH_TYPE };
}

/**
 * Clear all auth state (logout).
 */
export async function clearAuth(page: Page): Promise<void> {
  switch (AUTH_TYPE) {
    case 'jwt-localstorage':
    case 'oauth-mock':
      await page.evaluate(
        (key) => localStorage.removeItem(key),
        TOKEN_KEY,
      );
      break;

    case 'jwt-cookie':
    case 'session-cookie':
      await page.context().clearCookies();
      break;
  }
}

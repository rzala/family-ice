/**
 * Polling Helper — Wrappers for async backend operations that need time to propagate.
 *
 * Uses Playwright's expect.poll where possible, with config-driven defaults.
 * Config: reads `polling` section from e2e.config.json.
 */

import { Page, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';

// Load config
const configPath = new URL('../e2e.config.json', import.meta.url).pathname;
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};

const DEFAULT_INTERVAL_MS: number = config.polling?.defaultIntervalMs || 500;
const DEFAULT_TIMEOUT_MS: number = config.polling?.defaultTimeoutMs || 30000;

export interface PollOptions {
  /** Polling interval in ms (defaults to config or 500) */
  intervalMs?: number;
  /** Timeout in ms (defaults to config or 30000) */
  timeoutMs?: number;
  /** Message shown on timeout */
  message?: string;
}

/**
 * Poll until an element's text content matches the expected value.
 */
export async function pollForText(
  page: Page,
  selector: string,
  expected: string | RegExp,
  options?: PollOptions,
): Promise<void> {
  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const msg = options?.message ?? `Expected "${selector}" to contain "${expected}"`;

  await expect
    .poll(
      async () => {
        const el = page.locator(selector).first();
        const count = await el.count();
        if (count === 0) return null;
        return el.textContent();
      },
      { intervals: [interval], timeout, message: msg },
    )
    .toMatch(expected instanceof RegExp ? expected : new RegExp(expected));
}

/**
 * Poll until an element becomes visible.
 */
export async function pollForVisible(
  page: Page,
  selector: string,
  options?: PollOptions,
): Promise<void> {
  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const msg = options?.message ?? `Expected "${selector}" to become visible`;

  await expect
    .poll(
      async () => {
        const el = page.locator(selector).first();
        const count = await el.count();
        if (count === 0) return false;
        return el.isVisible();
      },
      { intervals: [interval], timeout, message: msg },
    )
    .toBe(true);
}

/**
 * Generic boolean poll — keep calling callback until it returns true.
 */
export async function pollUntil(
  callback: () => Promise<boolean>,
  options?: PollOptions,
): Promise<void> {
  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const msg = options?.message ?? 'Poll condition not met';

  await expect
    .poll(callback, { intervals: [interval], timeout, message: msg })
    .toBe(true);
}

/**
 * Poll an API endpoint until the response matches a condition.
 *
 * @param page - Playwright page (used for request context)
 * @param url - API endpoint URL (absolute or relative to baseURL)
 * @param matcher - Function that receives the JSON response and returns true when satisfied
 */
export async function pollApi(
  page: Page,
  url: string,
  matcher: (data: unknown) => boolean,
  options?: PollOptions,
): Promise<unknown> {
  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const msg = options?.message ?? `API poll condition not met for ${url}`;

  let lastData: unknown = null;

  await expect
    .poll(
      async () => {
        try {
          const response = await page.request.get(url);
          if (!response.ok()) return false;
          lastData = await response.json();
          return matcher(lastData);
        } catch {
          return false;
        }
      },
      { intervals: [interval], timeout, message: msg },
    )
    .toBe(true);

  return lastData;
}

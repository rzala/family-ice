import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';

// Load project-specific config if it exists
const configPath = './e2e.config.json';
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};

const baseURL = config.urls?.baseURL || process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results.json' }],
    ['playwright-ctrf-json-reporter', { outputFile: 'ctrf-report.json' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: './artifacts',
});

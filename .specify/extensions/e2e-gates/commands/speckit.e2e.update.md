---
description: Discover routes, map user journeys, and generate Playwright test suites.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Update an existing E2E test suite by discovering app routes, mapping multi-stage user journeys, and generating Playwright test files with appropriate helpers (email verification, polling, file upload).

This command is **additive** — it never deletes existing tests. It reads current coverage and generates only what's missing.

## Prerequisites

This command requires:
1. `e2e/` directory already initialized (run `/speckit.e2e.init` first)
2. `e2e/e2e.config.json` exists and is valid
3. The e2e-gates extension installed (helpers are read from `.specify/extensions/e2e-gates/e2e/helpers/`)

## Step 1: Read Existing Coverage

Read and catalog what's already covered:

1. **Existing tests**: Read all `e2e/tests/*.spec.ts` files — extract test names, routes tested, selectors used
2. **Existing selectors**: Read `e2e/selectors.ts` — catalog all registered selectors
3. **Existing contracts**: Read `e2e/ui-contracts.md` — catalog all documented `data-testid` attributes
4. **Config**: Read `e2e/e2e.config.json` — note stack, auth type, URLs

Build an internal map:
```
coveredRoutes: ["/login", "/dashboard", ...]
coveredJourneys: ["auth-gate", "ui-readability", ...]
coveredSelectors: { loginPage: '[data-testid="login-page"]', ... }
```

## Step 2: Discover Routes and Page Capabilities

This step has two phases: find routes, then understand what each page **does**.

### 2a: Discover Route Definitions

Detect the routing framework from `e2e.config.json` stack info and scan source files.

**React Router (v6+):**
- Grep for `<Route path=`, `createBrowserRouter`, `createRoutesFromElements`
- Check `src/router.*`, `src/routes.*`, `src/App.*`

**Next.js (pages router):**
- Scan `pages/` directory — each `.tsx`/`.jsx` file = a route
- `pages/api/` = API routes (skip for E2E)

**Next.js (app router):**
- Scan `app/` directory — each `page.tsx` = a route
- `app/api/` = API routes (skip for E2E)

**Vue Router:**
- Grep for `createRouter`, `routes:`, `path:`
- Check `src/router/index.*`, `src/router.*`

**SvelteKit:**
- Scan `src/routes/` — each `+page.svelte` = a route

**Static / Vanilla:**
- Scan for `<a href=`, `window.location`, `navigate(` patterns
- Check for any routing config files or hash-based routing

### 2b: Read Every Page Component (CRITICAL)

For **each discovered route**, read the full source of the page/component file. Extract:

**Interactive elements** — what can the user DO on this page?
- `<input type="file">`, `<input>`, `<textarea>`, `<select>` — forms and uploads
- `<button>`, `<a>`, `onClick`, `onSubmit` — actions the user can trigger
- Drag-and-drop zones: `onDrop`, `onDragOver`, `dropzone`, `drag`
- File pickers, upload components
- Tabs, accordions, toggles, switches, dropdowns, modals, drawers
- Pagination, infinite scroll, "load more" buttons
- Search/filter inputs, sort controls

**Media and rich content** — detect these by scanning imports and JSX:
- `<video>`, `<audio>`, `<iframe>` elements → playback tests required
- Player libraries: `react-player`, `video.js`, `plyr`, `hls.js`, `dash.js`, `shaka-player`, `howler`, `wavesurfer`
- Player controls: play, pause, stop, seek, forward, rewind, volume, mute, fullscreen, picture-in-picture
- Streaming: HLS/DASH manifests (`.m3u8`, `.mpd`), WebRTC, MediaSource API
- Canvas/WebGL renderers, PDF viewers, image galleries with lightbox
- **If there is ANY media element in the codebase, the generated tests MUST exercise every control**: play → assert playing, pause → assert paused, seek forward → assert time advanced, fullscreen → assert fullscreen state. A player is not a decoration — every button on it is a user interaction.

**State-changing operations** — what API calls does this page make?
- `fetch(`, `axios.`, `useMutation`, `useSWRMutation` — find the HTTP method and URL
- `POST`, `PUT`, `DELETE`, `PATCH` calls = mutating operations
- `GET` calls with query params = read operations
- Streaming endpoints (range requests, chunked responses, SSE, WebSocket)

**Async patterns** — what takes time on this page?
- Loading spinners, skeleton screens, progress bars
- `useEffect` with polling, `setInterval`, WebSocket connections
- Status fields that change over time (pending → processing → complete)
- Toast notifications, success/error messages
- Media buffering, transcoding progress, download progress

**Domain objects** — what entities does this page work with?
- List/table components showing collections (items, files, users, torrents, etc.)
- Detail/show pages for individual entities
- Create/edit forms for entities
- **If a list page exists, the test MUST click into at least one item** to reach the detail page

### 2c: Discover Backend API Endpoints

Scan backend source for API routes that the frontend calls:

**Go (Fiber / Gin / Echo):**
- Grep for `app.Get(`, `app.Post(`, `app.Put(`, `app.Delete(`, `r.GET(`, `r.POST(`
- Read handler functions to understand request/response shape

**Express / Fastify / NestJS:**
- Grep for `app.get(`, `app.post(`, `router.get(`, `@Get(`, `@Post(`

**FastAPI / Flask / Django:**
- Grep for `@app.get(`, `@app.post(`, `@router.get(`, `urlpatterns`

For each endpoint, note:
- HTTP method (GET = read, POST/PUT/DELETE = mutating)
- What entity it operates on
- Whether it accepts file uploads (`multipart/form-data`, `FormFile`, `multer`)
- Whether it triggers async processing (background jobs, queues, workers)

### 2d: Build Rich Route Map

Combine route definitions + page capabilities + API endpoints into a complete picture:

```
## Discovered Routes

| Route | Source File | Auth | User Actions | API Calls | Async? |
|-------|-----------|------|-------------|-----------|--------|
| /login | src/pages/Login.tsx | No | Email input, submit | POST /api/auth/login | No |
| /dashboard | src/pages/Dashboard.tsx | Yes | View list, click items | GET /api/items | No |
| /upload | src/pages/Upload.tsx | Yes | File picker, drag-drop, submit | POST /api/upload (multipart) | Yes — processing |
| /items/:id | src/pages/ItemDetail.tsx | Yes | Play, delete, edit | GET /api/items/:id, DELETE | Yes — playback |
```

## Step 3: Map User Journeys from Page Capabilities

**DO NOT guess journeys from route names alone.** Build journeys from the actual user capabilities discovered in Step 2b/2c.

### MANDATORY: Generate nav traversal test FIRST

Before mapping any domain journeys, **always** generate a nav/menu smoke test. This is the most basic test — if the app has clickable navigation, every item must be clicked and verified.

**Detection:**
1. Read the app's layout/shell component (e.g., `Layout.tsx`, `Sidebar.tsx`, `Nav.tsx`, `AppShell.tsx`)
2. Find all navigation elements: sidebar links, top nav items, tab bars, menu items, drawer items
3. Extract the link text and target route for each nav item

**Generate `journey-nav-smoke.spec.ts` [IDEMPOTENT]:**

```typescript
test.describe.serial('Journey: Nav Smoke Test', () => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  test.beforeAll(async ({ browser }) => {
    // These are reset per-test below, but declared here for shared scope
  });

  test('login', async ({ page, request }) => {
    await loginAsTestUser(page, request);
  });

  // One test per nav item — click it, assert no errors
  for (const item of NAV_ITEMS) {
    test(`nav: ${item.label}`, async ({ page }) => {
      // Collect console errors for this navigation
      const pageErrors: string[] = [];
      const netFailures: { url: string; status: number; method: string }[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') pageErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });
      page.on('response', (res) => {
        if (res.status() >= 400) {
          netFailures.push({
            url: res.url(),
            status: res.status(),
            method: res.request().method(),
          });
        }
      });

      // Click the nav item
      await page.click(item.selector);

      // Wait for navigation and network to settle
      await page.waitForLoadState('networkidle');

      // 1. Assert no failed network requests (4xx/5xx)
      expect(
        netFailures,
        `"${item.label}" page had failed API calls:\n` +
          netFailures.map((f) => `  ${f.method} ${f.url} → ${f.status}`).join('\n'),
      ).toHaveLength(0);

      // 2. Assert no console errors
      expect(
        pageErrors,
        `"${item.label}" page had console errors:\n` +
          pageErrors.map((e) => `  ${e}`).join('\n'),
      ).toHaveLength(0);

      // 3. Assert no error toasts/banners/messages in the DOM
      const errorToasts = page.locator(
        '[role="alert"], .toast-error, .error-toast, .notification-error, ' +
        '[data-testid*="error"], .Toastify__toast--error, .ant-message-error, ' +
        '.chakra-alert[data-status="error"], .mantine-Notification-error'
      );
      await expect(
        errorToasts,
        `"${item.label}" page should not show error notifications`,
      ).toHaveCount(0);

      // 4. Assert the page rendered content (not blank)
      const mainContent = page.locator('main, [role="main"], [data-testid="main-content"]');
      await expect(mainContent).toBeVisible();
    });
  }
});
```

**This test catches (per nav item):**
- **Failed network calls**: Any 4xx/5xx API response (e.g., `GET /api/invites → 500`)
- **Console errors**: Uncaught exceptions, React error boundaries, failed fetch logs
- **Error UI**: Toast notifications, alert banners, error messages rendered in the DOM
- **Blank pages**: Routes that render nothing or crash on mount

**The nav items list must come from reading the actual component**, not from route definitions. A sidebar with `<NavLink to="/users">Users</NavLink>` items is the source of truth — the user clicks those items, not route paths.

### MANDATORY: Deep interaction test — every interactive element must be exercised

The nav smoke test covers breadth (every page loads). This step covers **depth** — every interactive element the user can see must be tested.

**Core rule: If it's a user interaction, it must be tested. Buttons, links, players, toggles, tabs, dropdowns, inputs — none of these are decorations. They exist to be used, so the test must use them.**

For **every page** discovered in Step 2, read the component source and identify all interactive elements:
- Buttons (play, submit, delete, edit, toggle, expand, close)
- Links within content (not just nav — table row links, card links, detail links)
- Media controls (play/pause, seek, volume, fullscreen)
- Form inputs (text, select, checkbox, radio, file)
- Tabs, accordions, dropdowns, modals triggered by clicks
- List items that link to detail views

Then generate tests that:
1. **Click into list items**: If a page shows a table/list/grid of items, click the first item and assert the detail page loads without errors
2. **Exercise controls**: If a detail page has a play button, click it and assert playback starts (no console errors, no failed network requests, media element has `currentTime > 0` or equivalent)
3. **Open modals/drawers**: If there are buttons that open modals, click them and assert the modal renders
4. **Submit forms**: If there are forms, fill and submit with test data and assert no errors
5. **Follow every link**: Any clickable element on the page must be clicked in at least one test

Apply the same error collection pattern to every interaction:
- Collect `page.on('response')` for 4xx/5xx failures
- Collect `page.on('console', 'error')` and `page.on('pageerror')`
- Check for error toasts/banners after each interaction
- If it's an async action, use the polling helper to wait for completion

**If a page has 5 buttons, there must be 5 interactions tested.** Not one. Not "the main ones". All of them. The user can click any of them, so the test must click all of them.

### Domain journey inference rules:

**1. Follow the user's POV** — every journey starts from what the user sees and does:
- User lands on page → sees elements → interacts → expects outcome
- Chain pages together when one action leads to another (upload → view uploaded item → play)

**2. Infer journeys from capability clusters:**

| Capability Pattern | Journey Type | Example |
|-------------------|-------------|---------|
| Sidebar/nav/menu with N items | Nav smoke test (MANDATORY) | Click each menu item, assert no errors |
| Form + POST + redirect | Submit flow | Login, signup, create item |
| File input + POST multipart + progress/status | Upload + verify flow | Upload torrent, upload document |
| List page + detail page + actions | CRUD flow | Browse items, view detail, delete |
| Form + POST + email trigger + activation link | Email verification flow | Signup, invite, password reset |
| Action + status change over time | Async processing flow | Upload → pending → processing → ready |
| Detail page + media element + controls | Playback/preview flow | Play video, preview document |

**3. Connect related pages into end-to-end journeys:**

If the app has: login page + upload page + item list + item detail with playback, the journey is:

```
### journey-upload-and-play [MUTATING]
Steps:
  1. Login as test user (auth helper)
  2. Navigate to upload page
  3. Upload file via file input or drag-drop (upload helper)
  4. Assert upload accepted (check redirect or success message)
  5. Poll for processing completion (polling helper) — watch status change from pending → ready
  6. Navigate to uploaded item's detail page
  7. Assert item is playable/viewable
  8. Trigger playback/preview and assert it works
Helpers: upload, polling
Environment: ephemeral (creates DB records)
```

NOT just "journey-upload" and separately "journey-play" — test the **full user story**.

**4. Read backend worker/queue code** to understand async processing:
- If there's a worker that processes uploads (e.g., validation, transcoding, parsing), note:
  - What status transitions happen (PENDING → PROCESSING → READY / FAILED)
  - How long processing typically takes (informs polling timeout)
  - What the user sees during processing (progress bar, status text, spinner)

### Helper identification:

- **Email helper**: Page has email verification, signup with confirmation, invite flow, password reset
- **Polling helper**: Page shows status that changes over time, has loading states after mutations, async processing
- **Upload helper**: Page has `<input type="file">`, drag-drop zone, or multipart form submission

### Classify each journey:
- **Idempotent**: Read-only flows, login, navigation, viewing pages — safe against a live dev DB
- **Mutating**: Signup, CRUD, uploads, deletes — alters DB state and needs isolation

```
### journey-upload-verify-play [MUTATING]
Steps:
  1. Login (auth helper)
  2. Navigate to /upload
  3. Upload test file via file input (upload helper)
  4. Assert upload accepted (success toast or redirect)
  5. Poll until processing completes: status PENDING → READY (polling helper)
  6. Navigate to uploaded item detail page
  7. Assert item metadata displayed correctly
  8. Trigger playback and assert media loads
Helpers: upload, polling
Environment: ephemeral (creates DB records, triggers worker processing)

### journey-login [IDEMPOTENT]
Steps:
  1. Navigate to /login
  2. Enter credentials and submit
  3. Assert redirected to protected route
  4. Assert user-specific content visible
Helpers: none (tests the actual login flow, not auth bypass)
Environment: local
```

**Rules for journey mapping:**
- **Test the full user story** — chain related pages together (upload → verify → play), don't split into isolated per-page tests
- Each journey must start from what the user **sees** and follow what they **do** — strictly user POV
- Journeys should be independent (each starts from a clean state)
- Prefer fewer, longer journeys over many short ones
- Mark which journeys need `beforeAll` auth setup vs. which test the auth flow itself
- If a route is already covered by an existing test, skip it unless it's part of a multi-step journey
- Tag each journey `[IDEMPOTENT]` or `[MUTATING]` — mutating journeys require ephemeral environment
- **Read the actual page components** — if a page has a file input, the journey MUST include the upload step; if it shows a status that changes, the journey MUST poll for that change

## Step 4: Present Journey Map for Approval

Present the full journey map to the user using `AskUserQuestion`:

```
I've discovered N routes and mapped M user journeys:

1. journey-signup-verify — Signup → email verification → dashboard (needs: email, polling helpers)
2. journey-settings-profile — Login → settings → profile update with avatar (needs: upload, polling helpers)
3. journey-crud-items — Login → CRUD operations on items (needs: polling helper)

Which journeys should I generate?
```

Options:
- "All of them" (Recommended)
- "Let me pick" — show checkboxes
- "None — just show the route map"

Wait for user approval before proceeding. If the user wants to modify journeys, iterate.

## Step 5: Copy Required Helpers

Based on approved journeys, copy needed helpers from the extension templates:

**Source**: `.specify/extensions/e2e-gates/e2e/helpers/`
**Destination**: `e2e/helpers/`

Only copy helpers that are actually needed by approved journeys:
- If any journey needs email verification → copy `email.ts` (if not already present)
- If any journey needs polling → copy `polling.ts` (if not already present)
- If any journey needs file upload → copy `upload.ts` (if not already present)

If a helper already exists in `e2e/helpers/`, do NOT overwrite it. Print a note instead.

## Step 6: Update e2e.config.json

If email helper is being used, add the `email` section to `e2e.config.json` (if not already present):

```json
{
  "email": {
    "imap": { "host": "imap.gmail.com", "port": 993, "tls": true },
    "auth": {
      "user": "",
      "appPasswordFile": "~/.config/himalaya/.gmail-app-pw"
    },
    "pollIntervalMs": 2000,
    "timeoutMs": 60000
  }
}
```

Ask the user for `email.auth.user` if not already set.

If polling helper is being used, add the `polling` section (if not already present):

```json
{
  "polling": {
    "defaultIntervalMs": 500,
    "defaultTimeoutMs": 30000
  }
}
```

## Step 6b: Configure Ephemeral Environment (if any journey is MUTATING)

If any approved journey is tagged `[MUTATING]`, the tests need an isolated environment.

**1. Detect existing Docker setup:**
- Check for `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml` in the project root
- Check for `Dockerfile` or `Dockerfile.*` in the project
- Read the compose file to identify services (app, db, redis, etc.)

**2. Ask the user about environment mode:**

Use `AskUserQuestion`:
```
Some journeys mutate state (signup, CRUD, uploads). How should these run?
```

Options:
- "Ephemeral stack — spin up a fresh docker-compose per test run" (Recommended)
- "Hybrid — gate tests use local, journey tests use ephemeral"
- "Local — I'll manage the test DB myself"

**3. If ephemeral or hybrid, generate `e2e/docker-compose.e2e.yml`:**

Derive from the project's existing compose file with these modifications:
- Strip volume mounts that point to source code (tests don't need hot-reload)
- Add `APP_ENV=test` to the app service environment
- Apply port offset (default +100) to avoid clashing with dev stack
- Use a tmpfs or anonymous volume for the DB (ephemeral — no persistent data)
- Add healthcheck endpoints if not already present

Example for a Go + Postgres stack:
```yaml
services:
  app:
    build: ..
    environment:
      - APP_ENV=test
      - DATABASE_URL=postgres://test:test@db:5432/testdb?sslmode=disable
    ports:
      - "${E2E_PORT:-3100}:3000"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 2s
      timeout: 5s
      retries: 10
```

**4. Update `e2e.config.json` with the environment section:**

```json
{
  "environment": {
    "mode": "ephemeral",
    "compose": {
      "file": "docker-compose.e2e.yml",
      "projectPrefix": "e2e",
      "portOffset": 100,
      "upTimeoutSec": 60
    },
    "services": {
      "app": {
        "healthcheck": "http://localhost:{port}/health",
        "readyTimeoutMs": 30000
      }
    },
    "seed": {
      "command": "",
      "runBefore": "suite"
    },
    "teardown": "always"
  }
}
```

Ask the user:
- What's the app's health endpoint? (e.g., `/health`, `/api/health`, `/ping`)
- Do they have a seed script/command? If so, what is it?
- Teardown policy: always (default), on-pass (keep on failure for debugging), or never?

**5. Tag generated test files with environment metadata:**

Mutating journey test files should use `E2E_BASE_URL` env var (set by `run-gates.sh` during ephemeral runs):

```typescript
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
test.use({ baseURL: baseUrl });
```

Idempotent journey test files use the standard `baseURL` from `playwright.config.ts`.

## Step 7: Update Selectors

Add new selectors to `e2e/selectors.ts` for all pages/elements discovered in the approved journeys.

Follow the existing pattern — group by page/section:

```typescript
// --- Signup ---
signupPage: tid('signup-page'),
signupEmailInput: tid('signup-email-input'),
signupPasswordInput: tid('signup-password-input'),
signupSubmitButton: tid('signup-submit'),

// --- Settings ---
settingsPage: tid('settings-page'),
...
```

Insert new selector groups **before** the `} as const;` closing line. Do NOT duplicate selectors that already exist.

## Step 8: Generate Journey Test Files

For each approved journey, generate `e2e/tests/journey-{name}.spec.ts`.

**Test file structure:**

```typescript
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../selectors';
import { loginAsTestUser } from '../helpers/auth';
// Import only the helpers this journey needs:
// import { waitForEmail, extractActivationUrl } from '../helpers/email';
// import { pollForText, pollForVisible } from '../helpers/polling';
// import { uploadFiles } from '../helpers/upload';

test.describe('Journey: {Human-Readable Name}', () => {
  // Auth setup if needed:
  // test.beforeAll(async ({ browser }) => { ... });

  test('{step description}', async ({ page, request }) => {
    // Step implementation using selectors and helpers
  });
});
```

**Rules:**
- Use `SELECTORS` from the selector registry — NEVER hardcode selectors
- Use helpers from `../helpers/` — NEVER inline IMAP/polling/upload logic
- Each test should be independent or use `test.describe.serial` for ordered steps within a journey
- Use `test.describe.serial` when steps depend on prior state (e.g., signup then verify)
- Include meaningful assertion messages
- Use `page.waitForURL` after navigation actions
- Use `DISPLAY=:0` handling is already in `run-gates.sh` — no need to handle in tests

## Step 9: Update ui-contracts.md

Add new sections to `e2e/ui-contracts.md` for each new page/component that needs `data-testid` attributes.

Follow the existing table format:

```markdown
## Signup Screen

| Attribute | Element | Used By |
|-----------|---------|---------|
| `signup-page` | Signup page container | journey-signup-verify |
| `signup-email-input` | Email input field | journey-signup-verify |
```

Append new sections **before** the "## Adding New Contracts" section.

## Step 10: Install Dependencies

If the email helper was copied, install the imapflow dependency:

```bash
cd e2e && npm install
```

If `imapflow` is not in `package.json`, add it first:
```bash
cd e2e && npm install imapflow
```

## Step 11: Identify Missing data-testid Attributes

Scan the target project's frontend source files and identify which `data-testid` attributes from the new selectors are missing.

Output as a checklist:

```
## Missing data-testid Attributes

- [ ] `src/pages/Signup.tsx` — add `data-testid="signup-page"` to container div
- [ ] `src/pages/Signup.tsx` — add `data-testid="signup-email-input"` to email input
- [ ] `src/pages/Signup.tsx` — add `data-testid="signup-submit"` to submit button
- [ ] `src/pages/Settings.tsx` — add `data-testid="settings-page"` to container div
```

Ask: "Should I add these data-testid attributes now?"
- If yes: add only the `data-testid` attributes to the identified elements
- If no: print the checklist for manual addition

## Step 12: Optional Smoke Test

Ask the user: "Want to run a smoke test of the new journey tests?"

If yes:
```bash
./e2e/run-gates.sh --grep "Journey:"
```

Parse results and report. If failures occur, analyze and suggest fixes (missing selectors, app not running, etc.).

## Step 13: Print Summary

```
## E2E Update Complete

### Routes Discovered: N total (M new, K already covered)

### Journeys Generated:
  - journey-signup-verify.spec.ts (email, polling helpers)
  - journey-settings-profile.spec.ts (upload, polling helpers)
  - journey-crud-items.spec.ts (polling helper)

### Helpers Copied:
  - e2e/helpers/email.ts ✓
  - e2e/helpers/polling.ts ✓
  - e2e/helpers/upload.ts ✓

### New Selectors: N added to e2e/selectors.ts

### Config Updated:
  - email section added to e2e.config.json
  - polling section added to e2e.config.json
  - environment section added (mode: ephemeral/hybrid/local)

### Environment:
  - Mode: ephemeral
  - Compose file: e2e/docker-compose.e2e.yml
  - Port offset: +100 (app on :3100)
  - Teardown: always
  - Mutating journeys: N / Idempotent: M

### Missing data-testid: N attributes need adding (see checklist above)

### Next Steps:
  1. Add missing data-testid attributes to frontend components
  2. Set email.auth.user in e2e.config.json (if email helper used)
  3. Ensure app password exists at ~/.config/himalaya/.gmail-app-pw
  4. Verify docker-compose.e2e.yml works: docker compose -f e2e/docker-compose.e2e.yml up -d
  5. Run: ./e2e/run-gates.sh
```

## Error Handling

- **e2e/ not initialized**: Print "E2E framework not initialized. Run `/speckit.e2e.init` first." and stop.
- **No routes discovered**: Print "No routes found. Check that your app's routing is in a standard location." and suggest manual route input.
- **Helper already exists**: Skip copy, print note. Do NOT overwrite user modifications.
- **Config section already exists**: Merge new values without overwriting existing ones.

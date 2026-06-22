---
description: Initialize E2E gating framework with tech stack discovery and Playwright scaffolding.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Scaffold a deterministic E2E gating harness (Playwright + CTRF) by:
1. Discovering the project's tech stack
2. Prompting the user to confirm/fill gaps
3. Generating stack-specific auth helpers, selectors, and gate tests
4. Copying the appropriate backend test login template
5. Writing `e2e.config.json` with discovered values

## Prerequisites

This command requires the e2e-gates extension to be installed. It reads templates from:
- `.specify/extensions/e2e-gates/e2e/backend-templates/` — Stack-specific test login handlers
- `.specify/extensions/e2e-gates/e2e/helpers/` — Auth and readability helpers
- `.specify/extensions/e2e-gates/e2e/tests/` — Gate test templates
- `.specify/extensions/e2e-gates/e2e/selectors.ts` — Selector registry
- `.specify/extensions/e2e-gates/e2e/e2e.config.schema.json` — Config schema

## Step 1: Discover Tech Stack

Run these detection checks in parallel:

**Frontend:**
- Check `package.json` for: `react`, `vue`, `svelte`, `@angular/core`, `next`, `nuxt`, `solid-js`, `astro`
- Check for `vite.config.*`, `webpack.config.*`, `next.config.*`, `nuxt.config.*`
- Check for `tailwind.config.*`, `postcss.config.*`, styled-components/emotion in deps

**Backend:**
- Check for `go.mod` → scan for `fiber`, `gin`, `echo`, `chi`
- Check `package.json` for: `express`, `fastify`, `@nestjs/core`, `koa`, `hapi`
- Check for `requirements.txt` or `pyproject.toml` → scan for `fastapi`, `flask`, `django`
- Check for `Gemfile` → scan for `rails`, `sinatra`
- Check for `pom.xml` or `build.gradle` → scan for `spring`

**Auth:**
- Grep for `localStorage.setItem` or `localStorage.getItem` with token-like keys
- Grep for `Authorization: Bearer` or `Bearer ${` patterns
- Grep for `jwt`, `jsonwebtoken`, `golang-jwt`, `pyjwt` in dependency files
- Check for cookie-based auth patterns (`Set-Cookie`, `httpOnly`, `document.cookie`)

**URLs:**
- Check `vite.config.*` for `server.port` or `proxy` settings
- Check for `.env`, `.env.local`, `.env.development` with `PORT`, `API_URL`, `VITE_API_URL`
- Check `package.json` scripts for port numbers

**Selectors:**
- Grep for `data-testid=`, `data-test=`, `data-cy=`, `data-qa=` to detect existing convention

## Step 2: Present Discoveries and Prompt for Confirmation

Present what was discovered in a structured table:

```
## Detected Stack

| Component    | Detected         | Confidence |
|-------------|-----------------|------------|
| Frontend    | React            | HIGH       |
| Bundler     | Vite             | HIGH       |
| Backend     | Go (Fiber)       | HIGH       |
| Styling     | TailwindCSS      | HIGH       |
| Auth        | JWT localStorage | MEDIUM     |
| Token Key   | token            | LOW        |
| Base URL    | localhost:5173   | MEDIUM     |
| API URL     | localhost:3000   | LOW        |
| Selectors   | data-testid      | HIGH       |
```

Then ask the user to confirm or correct each value. Use `AskUserQuestion` for:
1. Auth type (jwt-localstorage / jwt-cookie / session-cookie / oauth-mock / none)
2. Protected route path (e.g., /dashboard, /app, /home)
3. Any values detected with LOW confidence

## Step 3: Write e2e.config.json

Write the confirmed values to `e2e.config.json` in the **target project's** `e2e/` directory. The config schema is defined in `.specify/extensions/e2e-gates/e2e/e2e.config.schema.json`.

## Step 4: Copy E2E Framework Files

Copy from `.specify/extensions/e2e-gates/e2e/` into the target project's `e2e/` directory:

1. **Always copy:**
   - `package.json`
   - `tsconfig.json`
   - `playwright.config.ts`
   - `.gitignore`
   - `selectors.ts`
   - `helpers/readability.ts`
   - `helpers/auth.ts`
   - `tests/gate-auth.spec.ts`
   - `tests/gate-ui-readability.spec.ts`
   - `generate-verdict.mjs`
   - `run-gates.sh`
   - `ui-contracts.md`

2. **Copy the matching backend template:**
   - Go (Fiber/Gin/Echo/Chi): `backend-templates/go-fiber-test-login.go`
   - Express/Fastify/NestJS: `backend-templates/express-test-login.ts`
   - FastAPI/Flask/Django: `backend-templates/fastapi-test-login.py`

3. **Customize copied files** based on `e2e.config.json`:
   - Update `selectors.ts` if selector convention is not `data-testid`
   - Update selector names if the app uses different page/component names
   - Update `ui-contracts.md` with the actual screens detected

## Step 5: Identify Required data-testid Hooks

Scan the target project's frontend components and list which `data-testid` attributes need to be added. Output as a checklist:

```
## Required data-testid Additions

- [ ] `src/pages/Login.tsx` — add `data-testid="login-page"` to container
- [ ] `src/pages/Login.tsx` — add `data-testid="login-email-input"` to email input
- [ ] `src/pages/Login.tsx` — add `data-testid="login-submit"` to submit button
- [ ] `src/pages/Dashboard.tsx` — add `data-testid="dashboard-heading"` to h1
- [ ] `src/pages/Dashboard.tsx` — add `data-testid="dashboard-anchor"` to main link
- [ ] `src/components/NavBar.tsx` — add `data-testid="nav-bar"` to nav element
- [ ] `src/App.tsx` — add `data-testid="main-content"` to main content wrapper
```

Ask the user: "Should I add these data-testid attributes now?"
- If yes: add only the minimum `data-testid` attributes to the specified files
- If no: print the checklist and continue

## Step 6: Install Dependencies

Run:
```bash
cd e2e && npm install && npx playwright install --with-deps chromium
```

## Step 7: Print Next Steps

```
## E2E Framework Initialized

Files created:
  e2e/
  ├── package.json
  ├── playwright.config.ts
  ├── e2e.config.json
  ├── selectors.ts
  ├── helpers/auth.ts
  ├── helpers/readability.ts
  ├── tests/gate-auth.spec.ts
  ├── tests/gate-ui-readability.spec.ts
  ├── generate-verdict.mjs
  ├── run-gates.sh
  └── ui-contracts.md

Backend template copied:
  e2e/backend-templates/<template> → <target location>

Next steps:
  1. Add the test login endpoint to your backend (see copied template)
  2. Add missing data-testid attributes (see checklist above)
  3. Start your app: <detected start command>
  4. Start your backend with: APP_ENV=test <detected backend command>
  5. Run gates: ./e2e/run-gates.sh
  6. Or headed: ./e2e/run-gates.sh --headed

Commands:
  Run locally:  ./e2e/run-gates.sh --headed
  Run in CI:    ./e2e/run-gates.sh --ci
  Verdict file: e2e/verdict.json
```

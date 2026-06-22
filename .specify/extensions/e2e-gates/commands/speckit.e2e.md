---
description: Run E2E gate tests and generate a PASS/FAIL verdict with artifact paths.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Arguments

- If empty: run all gate tests
- `--headed`: run in headed browser mode (for debugging)
- `--ci`: run in CI mode (stricter)
- `--seed`: run backend seed command first
- `auth`: run only the auth gate test
- `readability`: run only the UI readability gate test

## Behavior

### Step 1: Check Prerequisites

Verify:
1. `e2e/` directory exists in the project
2. `e2e/e2e.config.json` exists and is valid
3. `e2e/node_modules/` exists (if not, run `npm install`)

If `e2e/` does not exist:
```
E2E framework not initialized. Run /speckit.e2e.init first.
```

### Step 2: Run Gate Tests

Execute the canonical command:

```bash
./e2e/run-gates.sh [args from $ARGUMENTS]
```

If `$ARGUMENTS` contains `auth`:
```bash
./e2e/run-gates.sh --grep "Gate: Auth"
```

If `$ARGUMENTS` contains `readability`:
```bash
./e2e/run-gates.sh --grep "Gate: UI Readability"
```

### Step 3: Parse Verdict

Read `e2e/verdict.json` and present results:

**If PASS:**
```
## E2E Gate: PASS

All gate tests passed.

| Test | Status | Duration |
|------|--------|----------|
| Gate: Auth | PASS | 1.2s |
| Gate: UI Readability | PASS | 0.8s |

Total: 2 tests, 0 failures
```

**If FAIL:**
```
## E2E Gate: FAIL

| Test | Status | Assertion | Artifacts |
|------|--------|-----------|-----------|
| Gate: Auth | FAIL | Dashboard anchor element must be visible | trace, screenshot |
| Gate: UI Readability | PASS | — | — |

### Failure Details

**Gate: Auth**
- Assertion: Dashboard anchor element must be visible on protected route
- Hint: Check that the protected route renders correctly when authenticated.
  Verify that `data-testid="dashboard-anchor"` exists on the target element.

### Artifacts
- Trace: e2e/artifacts/gate-auth/trace.zip
- Screenshot: e2e/artifacts/gate-auth/screenshot.png
- Video: e2e/artifacts/gate-auth/video.webm

### Verdict File
e2e/verdict.json
```

### Step 4: Suggest Fixes (if FAIL)

Analyze the failure and suggest concrete fixes:

1. **Missing data-testid**: If assertion mentions a selector, check if the attribute exists in the frontend code
2. **Auth failure**: If token injection failed, check backend test endpoint is running with APP_ENV=test
3. **Readability failure**: If computed style check failed, identify the CSS causing the issue
4. **Redirect to login**: If URL check failed, check auth guard logic
5. **Overlay blocking**: If element is blocked, check for modals/toasts/overlays that may be on top

Do NOT weaken assertions to make tests pass. Fix the underlying issue instead.

### Error Handling

If `run-gates.sh` fails to execute:
- Check `e2e/node_modules` exists
- Check Chromium is installed: `npx playwright install --with-deps chromium`
- Check the app is running at the configured base URL
- Check the backend is running with APP_ENV=test

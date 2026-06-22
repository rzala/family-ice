---
description: Review design artifacts (specs, plans, tasks) before implementation to catch issues early.
---

## Philosophy

**"Review decisions, not implementations. Test implementations, don't review them."**

This command reviews **design artifacts only** (specs, plans, tasks) — not code. Why?

- ✅ **Specs/plans**: Cheap to fix, high leverage. Catch ambiguity before wasting time implementing.
- ❌ **Code**: Expensive to fix, low leverage. If tests pass, code is correct. Review is redundant.

**Review early. Test late.**

---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Review Modes

Determine the review mode and optional external tool from `$ARGUMENTS` (or auto-detect if blank):

| Argument | What to review | When to use |
|----------|---------------|-------------|
| `spec` | Review spec.md for completeness and ambiguity | After `/speckit.specify`, before `/speckit.plan` |
| `plan` | Review plan.md against spec.md and constitution | After `/speckit.plan`, before `/speckit.tasks` |
| `tasks` | Review tasks.md against plan.md for coverage and ordering | After `/speckit.tasks`, before `/speckit.implement` |
| (blank) | Auto-detect from git diff which artifacts changed | Anytime - detects what changed |

### External Reviewer (optional)

Append `codex` or `gemini` after the mode to also run an external AI review:

| Example | Behavior |
|---------|----------|
| `spec codex` | Internal review + Codex external review |
| `plan gemini` | Internal review + Gemini external review |
| `tasks` | Internal review only (no external tool) |

**Note**: Code review is explicitly **not supported**. Use tests to validate code correctness.

## Argument Parsing

Parse `$ARGUMENTS` to extract mode and optional external tool:

1. Split `$ARGUMENTS` by whitespace into tokens
2. Identify the **mode** token: `spec`, `plan`, or `tasks` (if present)
3. Identify the **external tool** token: `codex` or `gemini` (if present)
4. Order doesn't matter: `spec codex` and `codex spec` are equivalent
5. If neither mode token is found, fall through to auto-detection below

Store the external tool (if any) for use in Step 2.5.

## Auto-Detection (when no argument provided)

1. Run `git diff --name-only HEAD` and `git diff --name-only --cached` to find changed files
2. Classify changes:
   - Files in `specs/*/` matching `spec.md` → mode = `spec`
   - Files matching `plan.md` → mode = `plan`
   - Files matching `tasks.md` → mode = `tasks`
   - Files in `src/` or other code paths → **SKIP** (inform user: "Code changes detected. Run tests instead of review.")
   - Multiple spec/plan/task categories → run reviews for each detected mode
3. If no design artifacts changed, inform user and suggest running tests instead

## Execution

### Step 1: Gather Context

Run the prerequisite script from repo root with flags matching the review mode:
- **For `spec` review**: `.specify/scripts/bash/check-prerequisites.sh --paths-only --json` (only needs FEATURE_DIR — plan.md is not required)
- **For `plan` review**: `.specify/scripts/bash/check-prerequisites.sh --json` (requires plan.md)
- **For `tasks` review**: `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` (requires plan.md + tasks.md)

Extract FEATURE_DIR from the JSON output. All paths must be absolute.

Read the relevant artifacts based on review mode:
- **For `spec` review**: `{FEATURE_DIR}/spec.md` only
- **For `plan` review**: `{FEATURE_DIR}/spec.md`, `{FEATURE_DIR}/plan.md`, `.specify/memory/constitution.md`
- **For `tasks` review**: `{FEATURE_DIR}/spec.md`, `{FEATURE_DIR}/plan.md`, `{FEATURE_DIR}/tasks.md`

### Step 2: Perform Review

Use the **Task tool with subagent_type="general-purpose"** to run review checks in parallel where possible. Each review agent should focus on a specific concern:

**For `spec` mode:**
1. **Completeness** — Are all user stories fully specified? Missing acceptance criteria?
2. **Ambiguity** — Vague requirements, undefined terms, conflicting statements.
3. **Testability** — Can each requirement be verified? Are success criteria measurable?
4. **Edge Cases** — Missing error scenarios, boundary conditions, concurrent usage.

**For `plan` mode:**
1. **Spec Coverage** — Does the plan address every requirement in spec.md?
2. **Feasibility** — Are technology choices appropriate? Any unrealistic assumptions?
3. **Constitution Adherence** — Does it follow project constitution principles?
4. **Risks & Gaps** — Missing edge cases, unaddressed error scenarios, scalability concerns.

**For `tasks` mode:**
1. **Plan Coverage** — Does every section of plan.md have corresponding tasks?
2. **Dependency Ordering** — Are dependencies correct? No circular deps? No missing deps?
3. **Task Quality** — Are tasks atomic, testable, and specific enough to execute?
4. **Completeness** — Any work items from the plan missing from the task list?

### Step 2.5: External AI Review (if requested)

If an external tool (`codex` or `gemini`) was specified in the arguments:

1. Run `.specify/extensions/review-toolkit/scripts/peer-review-external.sh <tool> <mode> <files...>` using the Bash tool, where `<files...>` are the same artifact files gathered in Step 1
2. Capture the output
3. If the script exits with code 2 (tool not installed), display the install instructions from stderr and skip external review — do NOT fail the entire review
4. If successful, include the external output in the report under `### External AI Review ({tool})` (see Step 3 report format below)

If no external tool was specified, skip this step entirely.

### Step 3: Produce Report

Compile findings into a structured report. Group by severity:

```
## Peer Review Report — {mode} review

### CRITICAL (must fix before proceeding)
- [Finding description with file:line reference if applicable]

### HIGH (should fix)
- [Finding description]

### MEDIUM (consider fixing)
- [Finding description]

### LOW (nice to have)
- [Finding description]

### External AI Review ({tool})
_(Only include this section if an external tool was requested and produced output)_
- [Findings from external tool, preserved as-is]

### Summary
- Total findings: N
- Critical: N | High: N | Medium: N | Low: N
- Recommendation: PASS / PASS WITH NOTES / REVISE
```

**Recommendation logic:**
- **PASS**: Zero CRITICAL and zero HIGH findings - safe to proceed to next phase
- **PASS WITH NOTES**: Zero CRITICAL, some HIGH findings - proceed with caution, consider addressing HIGH items
- **REVISE**: Any CRITICAL findings - must fix before proceeding

---

## Example Workflow

```bash
# 1. Write spec
/speckit.specify "Add user authentication"

# 2. Review spec immediately ← HIGH LEVERAGE
/peer-review spec
# Or with external reviewer:
/peer-review spec codex

# 3. Generate plan
/speckit.plan

# 4. Review plan immediately ← HIGH LEVERAGE
/peer-review plan
# Or with external reviewer:
/peer-review plan gemini

# 5. Generate tasks
/speckit.tasks

# 6. Review tasks ← MEDIUM LEVERAGE
/peer-review tasks
# Ensure complete coverage

# 7. Implement (with tests)
/speckit.implement

# 8. Validate with tests (NOT review)
pytest

# 9. If tests pass → commit
# NO code review needed - tests already validated correctness
```

---

## When NOT to Use This Command

- ❌ **After implementation** - Too late, tests are your quality gate
- ❌ **To review code** - Use tests, not reviews
- ❌ **Before committing code** - Use `/eval` for quick linting only

**Use this command BEFORE implementation to catch design flaws early.**

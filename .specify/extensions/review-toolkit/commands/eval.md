---
description: Run code quality evaluation using CLI linters and optionally external AI reviewers (Codex, Gemini).
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Behavior

Run linters on changed files and optionally delegate to an external AI CLI tool for deeper review.

### Arguments

- If `$ARGUMENTS` is empty or contains only a tool name: evaluate all changed files
- If `$ARGUMENTS` contains file paths: evaluate those specific files
- Tool selection (extracted from `$ARGUMENTS`):
  - `codex` — delegate to Codex CLI after linting (default if no tool specified and external review requested)
  - `gemini` — delegate to Gemini CLI after linting
  - If `$ARGUMENTS` is just file paths with no tool name, run linters only

### Step 1: Gather Changed Files

If specific files provided in `$ARGUMENTS` (paths that exist on disk), use those.
Otherwise, run:

```bash
git diff --name-only HEAD
git diff --name-only --cached
```

Combine and deduplicate the file lists. Filter to files that actually exist on disk.

### Step 2: Load Linter Config

Read `.router-tools.yaml` from the project root. If not found, read from `.specify/extensions/review-toolkit/config/router-tools.yaml`. Extract the `tier_1.tools` list. Each tool has:
- `name`: tool identifier
- `command`: command template with `{files}` placeholder
- `file_extensions`: which file types this tool handles
- `enabled`: whether to run it

### Step 3: Match Files to Linters

For each changed file, match its extension against enabled tier_1 tools.
Group files by matching tool.

### Step 4: Run Linters

For each tool with matching files, run the command via Bash. Replace `{files}` with the space-separated list of matched file paths.

Run independent linters in **parallel** using multiple Bash tool calls.

Collect stdout and stderr from each tool.

### Step 5: Format Results

Produce a structured report:

```
## Eval Report

### {tool_name}
- Files checked: {count}
- Status: PASS / FAIL
- Output:
{tool output, truncated if very long}

### Summary
- Tools run: {list}
- Files evaluated: {total count}
- Issues found: {count by tool}
```

### Step 6: External AI Review (optional)

If `$ARGUMENTS` includes `codex` or `gemini` (or no tool name is specified and user wants external review):

Run the external evaluation script, defaulting to `codex` if no tool is specified:

```bash
.specify/extensions/review-toolkit/scripts/eval-external.sh <tool> <files...>
```

Where `<tool>` is `codex` (default) or `gemini`, and `<files>` are the changed files.

Append the external tool's output to the report under a `### External AI Review ({tool})` section.

If the script reports the tool is not installed, display the error message clearly.

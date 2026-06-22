---
description: Analyze new LogBugger error groups and write root cause suggestions into the report.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

---

## Report Format Reference

Each LogBugger report contains group blocks with this exact structure:

```markdown
### [ ] <Error Title>

<!-- logbugger:fingerprint=<sha1hex> -->

* severity: `ERROR`
* service: `web`
* count: `12`
* first_seen: `2026-02-20T15:01:02Z`
* last_seen: `2026-02-20T15:09:58Z`

#### Example snippet

` ` `text
<log lines and/or stack trace>
` ` `

#### Notes (manual)

* (your notes here)

#### Suspected cause (future / optional)

* (blank)

#### Suggested next step (future / optional)

* (blank)

---
```

**Key markers:**
- Group heading: `### [ ] <title>` (unchecked) or `### [x] <title>` (checked)
- Fingerprint: `<!-- logbugger:fingerprint=<hex> -->` — unique per group, stable across updates
- Severity: extracted from `* severity: \`<LEVEL>\`` — one of CRITICAL, ERROR, WARN, INFO
- Sections end at the next `####` heading or `---` separator

---

## Behavioral Invariants

These rules are **absolute** — never violate them:

1. **Never modify checkbox state** — `[x]` and `[ ]` are user-controlled
2. **Never modify the "Notes (manual)" section** — user-written content is sacred
3. **Never overwrite non-placeholder content** in "Suspected cause" or "Suggested next step" — if content exists and is not `* (blank)` and does not start with `* [auto]`, leave it untouched
4. **Always prefix auto-generated content** with `* [auto]` — this distinguishes machine analysis from human notes
5. **Overwrite previous `* [auto]` content** — re-running the monitor updates stale analysis
6. **Report must remain valid LogBugger markdown** after all modifications — logbugger must be able to parse and update the report normally

---

## Step 1: Resolve Report Path

If `$ARGUMENTS` contains a file path (a string ending in `.md` or containing `.logbugger/`), use that path directly. Verify the file exists using the Read tool.

If `$ARGUMENTS` is empty, auto-detect:

1. Check if `.logbugger/reports/` directory exists by running via Bash: `ls .logbugger/reports/ 2>/dev/null`
   - If the directory does not exist, stop and output: **"No LogBugger workspace found. Run `logbugger init` first."**

2. Get the current branch name via Bash: `git rev-parse --abbrev-ref HEAD 2>/dev/null || echo nogit`

3. Sanitize the branch name for filename matching:
   - Replace `/` with `__`
   - Replace spaces with `_`
   - Replace other non-alphanumeric/non-dash/non-underscore characters with `_`

4. Determine the report path:
   - If branch is `main`, `master`, or `develop`: use `.logbugger/reports/main.md`
   - Otherwise: use `.logbugger/reports/branch/<sanitized-branch>.md`

5. Try to read the resolved path. If the file does not exist:
   - Use Glob to find all `.md` files under `.logbugger/reports/`
   - Stop and output: **"Report not found at `<path>`. Available reports: `<list>`"**

---

## Step 2: Read and Parse Report

Read the full report file using the Read tool.

Scan the content and identify all group blocks. A group block:
- **Starts** with a line matching `### [ ] <title>` or `### [x] <title>` (or `[X]`)
- Is **immediately followed** by `<!-- logbugger:fingerprint=<hex> -->`
- **Ends** at the next `### [` heading, or at end of file

For each group, extract:
- **fingerprint**: from the `<!-- logbugger:fingerprint=... -->` marker
- **title**: from the `### [ ] <title>` heading
- **checked**: `true` if `[x]` or `[X]`, `false` if `[ ]`
- **severity**: from `* severity: \`...\``
- **service**: from `* service: \`...\``
- **count**: from `* count: \`...\``
- **snippet**: the content of the fenced code block under `#### Example snippet`
- **notes**: content under `#### Notes (manual)` (read but never modify)
- **suspectedCause**: content under `#### Suspected cause (future / optional)`
- **suggestedNextStep**: content under `#### Suggested next step (future / optional)`

If no groups with `<!-- logbugger:fingerprint=` markers are found, stop and output: **"No LogBugger group markers found in `<path>`. Is this a valid LogBugger report?"**

---

## Step 3: Classify Groups

For each parsed group, classify in this priority order:

1. **RESOLVED**: `checked == true` → **skip** (user marked as resolved)
2. **USER_OVERRIDE**: `suspectedCause` has content that is NOT `* (blank)` and does NOT start with `* [auto]` → **skip** (user wrote custom analysis)
3. **ANALYZED**: `suspectedCause` starts with `* [auto]` → **skip** (already analyzed by monitor)
4. **PENDING**: `checked == false` AND `suspectedCause` is `* (blank)` or is empty/whitespace-only → **select for analysis**

Collect all PENDING groups into a list.

**If zero PENDING groups**: stop and output: **"All groups are either resolved or already analyzed. Nothing to do."**

**Sort** PENDING groups by severity priority: CRITICAL first, then ERROR, then WARN, then INFO. Within same severity, keep the order they appear in the report.

**If more than 10 PENDING groups**: select the top 10. Note the total count for the summary.

---

## Step 4: Extract Source References

For each PENDING group selected for analysis, scan the **example snippet** for file path and line number references.

Look for these patterns:

- **JavaScript/TypeScript**: `at FunctionName (path/to/file.ts:line:col)` or `at path/to/file.js:line:col`
- **Python**: `File "path/to/file.py", line N, in function_name`
- **Go**: `path/to/file.go:line` (often tab-indented in panic output)
- **Java/Kotlin**: `at com.pkg.Class.method(FileName.java:line)`
- **Generic**: any pattern matching `<filepath>:<linenumber>` where filepath contains `/` or `\` and linenumber is a number

For each group, collect a list of `{filePath, lineNumber}` references. If no parseable stack trace is found, that's fine — the group will be analyzed from its error title and message only.

---

## Step 5: Read Source Files

For each group that has source references from Step 4:

1. For each `{filePath, lineNumber}` reference (up to **5 per group** to avoid context bloat):
   - Use the Read tool to read the file at the given path
   - Read from `lineNumber - 25` to `lineNumber + 25` (50 lines of context, clamped to file boundaries)
   - If the file does not exist, note: "Referenced file `<path>` not found in repo" and continue with remaining references

2. Store the source context alongside the group data for use in Step 6.

Run Read calls for multiple files in **parallel** where possible.

---

## Step 6: Analyze Groups

Analyze all selected PENDING groups in a **single reasoning pass**. For each group, you have:
- Error title and severity
- Service name
- Example snippet (log lines / stack trace)
- Source code context at referenced file:line locations (if available)
- User notes from "Notes (manual)" section (read-only context — may provide hints)

For each group, determine:

1. **Suspected cause** (1-2 sentences): What is the probable root cause of this error? Reference specific code locations (file:line) when the source context reveals the issue. Be concrete, not generic.

2. **Suggested next step** (1-2 sentences): What specific action should the developer take? Name exact files, functions, or lines to check/fix. Examples: "Add null guard at `src/services/user.ts:47`", "Add retry logic in `src/db/connect.ts:12`", "Check environment variable `DATABASE_URL` is set".

If analysis is inconclusive (no stack trace, no source files found, error message is too generic), write:
- Cause: `* [auto] Analysis inconclusive — the error message lacks sufficient context for root cause identification.`
- Next step: `* [auto] Review the example snippet manually and add notes to guide future analysis.`

---

## Step 7: Write Back to Report

For each analyzed group, update the report using the **Edit tool**.

For each group, construct the edit:

**`old_string`**: The exact current content spanning from `#### Suspected cause (future / optional)` through the suspected cause content, then `#### Suggested next step (future / optional)` through the suggested next step content. To ensure uniqueness, include enough surrounding context — the `<!-- logbugger:fingerprint=<EXACT_FINGERPRINT> -->` line and the lines between it and `#### Suspected cause` are guaranteed unique per group.

Concretely, for a group with fingerprint `abc123` that currently has placeholder content, the edit should look like:

**old_string:**
```
#### Suspected cause (future / optional)

* (blank)

#### Suggested next step (future / optional)

* (blank)
```

**new_string:**
```
#### Suspected cause (future / optional)

* [auto] <your analysis of the root cause>

#### Suggested next step (future / optional)

* [auto] <your suggested action>
```

**IMPORTANT**: If the `old_string` is not unique (because multiple groups have identical placeholder content), expand the `old_string` upward to include the fingerprint marker line and intervening content to make it unique. For example:

**old_string (expanded for uniqueness):**
```
<!-- logbugger:fingerprint=abc123 -->

* severity: `ERROR`
* service: `web`
* count: `12`
* first_seen: `2026-02-20T15:01:02Z`
* last_seen: `2026-02-20T15:09:58Z`

#### Example snippet

...entire snippet...

#### Notes (manual)

* (your notes here)

#### Suspected cause (future / optional)

* (blank)

#### Suggested next step (future / optional)

* (blank)
```

And the **new_string** must be identical except the two target sections are filled in.

Process groups **one at a time** — each Edit call modifies one group. If an Edit fails (string not found), skip that group and note it in the output. This can happen if the report was modified between Steps 2 and 7.

---

## Step 8: Output Summary

After all edits are complete, output a structured summary:

```
## LogBugger Monitor Report

**Report**: `<report-path>`
**Groups scanned**: <total group count>
**Already resolved**: <RESOLVED count> (checked off)
**Already analyzed**: <ANALYZED + USER_OVERRIDE count>
**Analyzed this run**: <number of successful edits>

### Analyzed Groups

1. **`<title>`** (<severity>, service: `<service>`)
   - Cause: [auto] <1-line cause summary>
   - Next step: [auto] <1-line action>

2. **`<title>`** (<severity>, service: `<service>`)
   - Cause: [auto] <1-line cause summary>
   - Next step: [auto] <1-line action>

[... for each analyzed group ...]

### Skipped
- `<title>` — already analyzed
- `<title>` — checked off by user
- `<title>` — user wrote custom analysis
```

If there were deferred groups (more than 10 PENDING), add:

```
**Note**: Analyzed 10/<total> groups (by severity priority). Run `/logbugger-monitor` again to process the remaining <N> groups.
```

If any edits failed, note them:

```
### Warnings
- `<title>` — edit failed (report may have been modified during analysis)
```

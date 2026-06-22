#!/usr/bin/env bash
# Usage: peer-review-external.sh <tool> <mode> <files...>
# tool: "codex" or "gemini"
# mode: "spec", "plan", or "tasks"
# files: one or more file paths to review
#
# Pipes design artifact content to an external AI CLI for peer review.
# Exits with clear error if the requested tool is not installed.

set -euo pipefail

if [[ $# -lt 3 ]]; then
    echo "Usage: peer-review-external.sh <codex|gemini> <spec|plan|tasks> <files...>" >&2
    exit 1
fi

TOOL="$1"
MODE="$2"
shift 2
FILES=("$@")

# Validate tool selection
case "$TOOL" in
    codex|gemini) ;;
    *)
        echo "Error: Unknown tool '$TOOL'. Supported: codex, gemini" >&2
        exit 1
        ;;
esac

# Validate mode
case "$MODE" in
    spec|plan|tasks) ;;
    *)
        echo "Error: Unknown mode '$MODE'. Supported: spec, plan, tasks" >&2
        exit 1
        ;;
esac

# Check if tool CLI is installed
if ! command -v "$TOOL" &>/dev/null; then
    echo "Error: '$TOOL' CLI is not installed." >&2
    echo "Install it first:" >&2
    case "$TOOL" in
        codex)  echo "  npm install -g @openai/codex" >&2 ;;
        gemini) echo "  npm install -g @google/gemini-cli" >&2 ;;
    esac
    exit 2
fi

# Build review prompt based on mode
case "$MODE" in
    spec)
        REVIEW_PROMPT="You are reviewing a feature specification (spec.md) for a software project.
Review the following specification for:
1. **Completeness** - Are all user stories fully specified? Missing acceptance criteria?
2. **Ambiguity** - Vague requirements, undefined terms, conflicting statements?
3. **Testability** - Can each requirement be verified? Are success criteria measurable?
4. **Edge Cases** - Missing error scenarios, boundary conditions, concurrent usage?

Provide a structured report with findings grouped by severity (CRITICAL, HIGH, MEDIUM, LOW).
End with a recommendation: PASS / PASS WITH NOTES / REVISE."
        ;;
    plan)
        REVIEW_PROMPT="You are reviewing an implementation plan (plan.md) against its specification.
Review the following plan for:
1. **Spec Coverage** - Does the plan address every requirement in the spec?
2. **Feasibility** - Are technology choices appropriate? Any unrealistic assumptions?
3. **Constitution Adherence** - Does it follow project principles (ethical AI, education-first, no dark patterns)?
4. **Risks & Gaps** - Missing edge cases, unaddressed error scenarios, scalability concerns?

Provide a structured report with findings grouped by severity (CRITICAL, HIGH, MEDIUM, LOW).
End with a recommendation: PASS / PASS WITH NOTES / REVISE."
        ;;
    tasks)
        REVIEW_PROMPT="You are reviewing a task breakdown (tasks.md) against its implementation plan.
Review the following tasks for:
1. **Plan Coverage** - Does every section of the plan have corresponding tasks?
2. **Dependency Ordering** - Are dependencies correct? No circular deps? No missing deps?
3. **Task Quality** - Are tasks atomic, testable, and specific enough to execute?
4. **Completeness** - Any work items from the plan missing from the task list?

Provide a structured report with findings grouped by severity (CRITICAL, HIGH, MEDIUM, LOW).
End with a recommendation: PASS / PASS WITH NOTES / REVISE."
        ;;
esac

# Gather file contents
CONTENT=""
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        CONTENT+="=== $(basename "$f") ($f) ==="$'\n'
        CONTENT+=$(cat "$f" 2>/dev/null || true)
        CONTENT+=$'\n\n'
    else
        echo "Warning: File not found: $f" >&2
    fi
done

if [[ -z "$CONTENT" ]]; then
    echo "Error: No file content found to review." >&2
    exit 1
fi

# Pipe prompt + content to external tool
INPUT="$REVIEW_PROMPT"$'\n\n'"---"$'\n\n'"$CONTENT"

case "$TOOL" in
    codex)
        echo "$INPUT" | codex exec - 2>&1
        ;;
    gemini)
        echo "$INPUT" | gemini 2>&1
        ;;
esac

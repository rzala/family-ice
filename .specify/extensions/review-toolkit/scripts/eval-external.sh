#!/usr/bin/env bash
# Usage: eval-external.sh <tool> [files...]
# tool: "codex" or "gemini" (defaults to "codex" if not recognized)
#
# Uses the external AI CLI tool's native git integration to review changes.
# If files are specified, reviews only those files. Otherwise reviews all
# uncommitted changes. Exits with clear error if the requested tool is not installed.

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: eval-external.sh <codex|gemini> [files...]" >&2
    exit 1
fi

TOOL="$1"
shift
FILES=("$@")

# Validate tool selection
case "$TOOL" in
    codex|gemini) ;;
    *)
        echo "Error: Unknown tool '$TOOL'. Supported: codex, gemini" >&2
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

REVIEW_PROMPT="Review the code changes for:
1. Correctness and logic errors
2. Security vulnerabilities (OWASP top 10)
3. Performance issues
4. Code style and best practices
5. Missing error handling

Provide a structured report with findings grouped by severity (CRITICAL, HIGH, MEDIUM, LOW)."

# Run the external tool
case "$TOOL" in
    codex)
        if [[ ${#FILES[@]} -eq 0 ]]; then
            # No files specified - use native git integration to review all uncommitted changes
            codex review --uncommitted 2>&1
        else
            # Files specified - gather diffs and use exec for targeted review
            DIFF=""
            for f in "${FILES[@]}"; do
                if [[ -f "$f" ]]; then
                    FILE_DIFF=$(git diff HEAD -- "$f" 2>/dev/null || true)
                    if [[ -n "$FILE_DIFF" ]]; then
                        DIFF+="$FILE_DIFF"$'\n'
                    else
                        # No diff - might be untracked, show content
                        if git ls-files --error-unmatch "$f" &>/dev/null; then
                            : # File is tracked and unchanged, skip
                        else
                            # File is untracked, include first 200 lines
                            DIFF+="=== $f (new file) ==="$'\n'
                            DIFF+=$(head -200 "$f" 2>/dev/null || true)
                            DIFF+=$'\n'
                        fi
                    fi
                fi
            done

            if [[ -z "$DIFF" ]]; then
                echo "No diff content found for the specified files." >&2
                exit 0
            fi

            echo "$REVIEW_PROMPT"$'\n\n'"---"$'\n'"$DIFF" | codex exec - 2>&1
        fi
        ;;
    gemini)
        # Gemini CLI doesn't have native git integration, so fall back to diff gathering
        DIFF=""
        if [[ ${#FILES[@]} -eq 0 ]]; then
            # Get all changed and untracked files if none specified
            mapfile -t TRACKED < <(git diff --name-only HEAD 2>/dev/null || true)
            mapfile -t UNTRACKED < <(git ls-files --others --exclude-standard 2>/dev/null || true)
            FILES=("${TRACKED[@]}" "${UNTRACKED[@]}")
        fi

        for f in "${FILES[@]}"; do
            if [[ -f "$f" ]]; then
                FILE_DIFF=$(git diff HEAD -- "$f" 2>/dev/null || true)
                if [[ -n "$FILE_DIFF" ]]; then
                    DIFF+="$FILE_DIFF"$'\n'
                else
                    # No diff - might be untracked, show content
                    if git ls-files --error-unmatch "$f" &>/dev/null; then
                        : # File is tracked and unchanged, skip
                    else
                        # File is untracked, include first 200 lines
                        DIFF+="=== $f (new file) ==="$'\n'
                        DIFF+=$(head -200 "$f" 2>/dev/null || true)
                        DIFF+=$'\n'
                    fi
                fi
            fi
        done

        if [[ -z "$DIFF" ]]; then
            echo "No diff content found for the specified files." >&2
            exit 0
        fi

        echo "$REVIEW_PROMPT"$'\n\n'"---"$'\n'"$DIFF" | gemini 2>&1
        ;;
esac

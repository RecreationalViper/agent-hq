#!/usr/bin/env bash
# Save a workflow run's output back to the repo — the one shared version of the
# "git config / add / commit / pull / push" block that used to be copy-pasted into
# every workflow.
#
# Why this exists: several agents finish at the same minute. The old block either had
# no rebase at all (one run died with "non-fast-forward") or had its own one-off retry
# loop. This pulls with rebase and retries, so a race delays a save instead of losing it.
#
# Usage:
#   bash tools/save.sh "Commit message"                 # save everything
#   bash tools/save.sh "Commit message" reports scout   # save only these paths
#
# Environment (all optional):
#   SAVE_STRATEGY="-X theirs"   extra flag for git pull --rebase (generated files only)
#   SAVE_BRANCH=main            branch to push (default: the checked-out one)
#   SAVE_RETRIES=3              push attempts before giving up
#   SAVE_OUTPUT_VAR=published   also write "$VAR=true|false" to $GITHUB_OUTPUT,
#                               so a later job can tell whether anything was saved
#
# Exit codes: 0 = saved or nothing to save, 1 = gave up (visible as a failed step).
set -uo pipefail

msg="${1:-Agent HQ update}"
if [ "$#" -gt 0 ]; then shift; fi

say() { echo "save.sh: $*"; }

finish() { # $1 = true|false, $2 = exit code
  if [ -n "${SAVE_OUTPUT_VAR:-}" ] && [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "${SAVE_OUTPUT_VAR}=$1" >> "$GITHUB_OUTPUT"
  fi
  exit "$2"
}

git config user.name "${GIT_AUTHOR_NAME:-agent-hq-bot}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"

# Stage: named paths only if they exist (a path that didn't get produced isn't an error).
if [ "$#" -gt 0 ]; then
  existing=()
  for p in "$@"; do [ -e "$p" ] && existing+=("$p"); done
  if [ "${#existing[@]}" -eq 0 ]; then
    say "none of the given paths exist — nothing to save"
    finish false 0
  fi
  git add -A -- "${existing[@]}"
else
  git add -A
fi

if git diff --cached --quiet; then
  say "no changes"
  finish false 0
fi

git commit -q -m "$msg" || { say "commit failed"; finish false 1; }

branch="${SAVE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
retries="${SAVE_RETRIES:-3}"
strategy="${SAVE_STRATEGY:-}"

for attempt in $(seq 1 "$retries"); do
  if git push origin "HEAD:$branch"; then
    say "pushed to $branch ($msg)"
    finish true 0
  fi
  say "push rejected (attempt $attempt/$retries) — another run got there first, rebasing"
  # shellcheck disable=SC2086
  if ! git pull --rebase --autostash $strategy origin "$branch"; then
    git rebase --abort 2>/dev/null || true
    say "rebase conflict — stopping so a human can look. The commit is still in this workspace."
    finish false 1
  fi
  sleep $((attempt * 5))
done

say "could not push after $retries attempts"
finish false 1

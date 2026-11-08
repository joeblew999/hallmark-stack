#!/usr/bin/env bash
# A Claude cloud session starts on a bare Linux machine with only the repo cloned. This installs mise, then runs
# mise run setup (the pinned tools and the app's packages, logged in mise tasks history), so the session starts where a
# developer's machine is after mise run setup, and puts mise's tools on PATH. On your own machine it does nothing.
# If an install fails, this fails too, so the session shows it.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
export PATH="$HOME/.local/bin:$PATH"
command -v mise > /dev/null || curl -fsSL https://mise.run | sh
cd "$CLAUDE_PROJECT_DIR"
mise trust -q
mise run setup
[ -z "${CLAUDE_ENV_FILE:-}" ] || {
  echo "export PATH=\"$HOME/.local/bin:\$PATH\""
  echo 'eval "$(mise activate bash --shims)"'
} >> "$CLAUDE_ENV_FILE"

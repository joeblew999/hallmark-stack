#!/usr/bin/env bash
# A Claude cloud session starts on a bare Linux machine with only the repo cloned. This installs mise, then runs
# mise run setup (the pinned tools and the app's packages, logged in mise tasks history), so the session starts where a
# developer's machine is after mise run setup, and puts mise's tools on PATH. On your own machine it does nothing.
# If an install fails, this fails too, so the session shows it.
#
# mise is always the newest release. mise.run's installer otherwise skips releases under a day old, and for an older
# release it fetches the checksums from GitHub with curl --compressed, which the cloud session's proxy answers with 504,
# so the install stops (seen 2026-11-08). The newest release's checksums are inside the installer, so nothing is fetched.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
export PATH="$HOME/.local/bin:$PATH"
command -v mise > /dev/null || curl -fsSL https://mise.run | MISE_SELF_UPDATE_MINIMUM_RELEASE_AGE=0s sh
cd "$CLAUDE_PROJECT_DIR"
mise trust -q
mise run setup
[ -z "${CLAUDE_ENV_FILE:-}" ] || {
  echo "export PATH=\"$HOME/.local/bin:\$PATH\""
  echo 'eval "$(mise activate bash --shims)"'
} >> "$CLAUDE_ENV_FILE"

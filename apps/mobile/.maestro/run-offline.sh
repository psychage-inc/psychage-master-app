#!/usr/bin/env bash
# Run one flow with the app's backends unreachable: net-cut on → flow → net-cut off.
# The restore runs even if the flow fails (trap), so the host is never left proxied.
#   .maestro/run-offline.sh e2e-02-crisis-offline
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$HERE/net-cut.sh" on
trap '"$HERE/net-cut.sh" off' EXIT
"$HERE/run-e2e.sh" "$@"

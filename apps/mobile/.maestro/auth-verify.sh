#!/usr/bin/env bash
# Complete the email-confirmation round trip for a disposable account:
#   1. poll the mail.tm inbox for the Supabase "Confirm" email (mail-poll.sh)
#   2. follow the verify link WITHOUT following redirects, capture the Location header
#      (this shows whether psychage://verify-success is allow-listed, or Supabase fell
#      back to the Site URL), and
#   3. open the resulting URL in the simulator so the app's deep-link handler runs.
#
#   auth-verify.sh <mailtm-env-file> [udid]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$1"; UDID="${2:-booted}"
OUT=$("$HERE/mail-poll.sh" "$ENV_FILE" "welcome" 240) || { echo "$OUT"; exit 1; }
echo "$OUT" | grep -E "^(SUBJECT|FROM):"
LINK=$(echo "$OUT" | grep -E "^LINK: https://[^ ]*auth/v1/verify" | head -1 | cut -d' ' -f2 | sed -E 's/[]>)]+$//')
[ -n "$LINK" ] || { echo "no verify link in mail"; echo "$OUT" | grep LINK; exit 1; }
echo "VERIFY_LINK_HOST: $(echo "$LINK" | sed -E 's#https://([^/]+)/.*#\1#')  path=$(echo "$LINK" | sed -E 's#https://[^/]+(/[^?]*).*#\1#')"
LOC=$(curl -s -o /dev/null -D - "$LINK" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}' | head -1)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$LINK")
echo "VERIFY_HTTP: $CODE"
echo "REDIRECT_TO: $(echo "$LOC" | sed -E 's/(access_token|refresh_token|code)=[^&#]+/\1=<redacted>/g')"
if [ "$UDID" = "none" ]; then
  echo "UDID=none: link followed (account confirmed server-side); not opened in a simulator"
elif [ -n "$LOC" ]; then
  xcrun simctl openurl "$UDID" "$LOC" && echo "opened redirect target in simulator"
else
  echo "no Location header — nothing to open"
fi

#!/usr/bin/env bash
# Poll a mail.tm inbox for the Supabase confirmation / reset email and print the first
# https link found in it. Used by the auth flows (e2e-03/04) because confirm-email is ON
# for the live project and no in-app path exists past /verify without the emailed link.
#
#   mail-poll.sh <mailtm-env-file> [subject-substring] [timeout-seconds]
#
# The env file holds ADDR / PW / TOKEN for the disposable inbox (created with
# `POST https://api.mail.tm/accounts`). Never prints the token.
set -uo pipefail
ENV_FILE="$1"; SUBJ="${2:-}"; TIMEOUT="${3:-180}"
# shellcheck disable=SC1090
source "$ENV_FILE"
deadline=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  list=$(curl -s https://api.mail.tm/messages -H "Authorization: Bearer $TOKEN")
  id=$(echo "$list" | python3 -c '
import json,sys
subj=sys.argv[1].lower()
d=json.load(sys.stdin)
for m in d.get("hydra:member",[]):
    if subj in (m.get("subject") or "").lower():
        print(m["id"]); break
' "$SUBJ")
  if [ -n "$id" ]; then
    curl -s "https://api.mail.tm/messages/$id" -H "Authorization: Bearer $TOKEN" | python3 -c '
import json,sys,re,html
m=json.load(sys.stdin)
print("SUBJECT:", m.get("subject"))
print("FROM:", (m.get("from") or {}).get("address"))
body=(m.get("text") or "") + " " + " ".join(m.get("html") or [])
links=re.findall(r"https?://[^\s\"<>)]+", html.unescape(body))
for l in links:
    print("LINK:", l)
'
    exit 0
  fi
  sleep 5
done
echo "TIMEOUT: no message matching '$SUBJ' after ${TIMEOUT}s" >&2
exit 1

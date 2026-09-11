#!/usr/bin/env bash
# Supabase-side evidence for the auth / sync / deletion flows. Reads the anon key from
# apps/mobile/.env (never printed). Prints HTTP status + trimmed bodies only.
#
#   sb-probe.sh token   <email> <password>   → password grant; saves the access token
#                                             to $SB_TOKEN_FILE and prints the DECODED
#                                             JWT claims (this is the platform-claim test)
#   sb-probe.sh rpc-audit                    → record_auth_event RPC with the saved token
#   sb-probe.sh moments                      → SELECT the user's public.moments rows
#   sb-probe.sh moments-insert               → INSERT a probe moment (RLS write test;
#                                             tagged 'e2e-probe' so it can be cleaned)
#   sb-probe.sh chats                        → SELECT ai_conversations / ai_messages
#   sb-probe.sh user                         → GET /auth/v1/user with the saved token
#   sb-probe.sh signup <email> <password>    → REST sign-up (mirrors the app's payload)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a; source "$HERE/../.env"; set +a
U="$EXPO_PUBLIC_SUPABASE_URL"; K="$EXPO_PUBLIC_SUPABASE_ANON_KEY"
SB_TOKEN_FILE="${SB_TOKEN_FILE:-$HOME/dev/psychage-e2e-evidence/.sb-token}"
tok() { cat "$SB_TOKEN_FILE" 2>/dev/null; }
decode() { python3 -c '
import sys,base64,json
t=sys.stdin.read().strip().split(".")[1]; t+="="*(-len(t)%4)
c=json.loads(base64.urlsafe_b64decode(t))
keep={k:c.get(k) for k in ("aud","role","platform","email","is_anonymous","aal","amr","exp","iss","app_metadata","user_metadata")}
keep["sub"]=c.get("sub"); print(json.dumps(keep,indent=1))'; }
case "${1:-}" in
  signup)
    curl -s -w "\nHTTP %{http_code}\n" -X POST "$U/auth/v1/signup" -H "apikey: $K" -H "Content-Type: application/json" \
      -d "{\"email\":\"$2\",\"password\":\"$3\",\"data\":{\"platform\":\"mobile\"}}" | sed -E 's/"(access_token|refresh_token)":"[^"]+"/"\1":"<redacted>"/g' | head -c 1200;;
  token)
    R=$(curl -s -X POST "$U/auth/v1/token?grant_type=password" -H "apikey: $K" -H "Content-Type: application/json" -d "{\"email\":\"$2\",\"password\":\"$3\"}")
    echo "$R" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("keys:",sorted(d.keys())); print("error:",d.get("error_code") or d.get("error") or d.get("msg"))'
    echo "$R" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))' > "$SB_TOKEN_FILE"
    [ -s "$SB_TOKEN_FILE" ] && { echo "--- decoded access_token claims:"; tok | decode; } || echo "(no access token)";;
  user)
    curl -s -w "\nHTTP %{http_code}\n" "$U/auth/v1/user" -H "apikey: $K" -H "Authorization: Bearer $(tok)" | sed -E 's/"(id)":"([0-9a-f-]{8})[^"]*"/"\1":"\2…"/' | head -c 900;;
  rpc-audit)
    curl -s -w "\nHTTP %{http_code}\n" -X POST "$U/rest/v1/rpc/record_auth_event" -H "apikey: $K" -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" \
      -d '{"p_event_type":"sign_in","p_device_id":"e2e-probe","p_success":true}' | head -c 600;;
  moments)
    curl -s -w "\nHTTP %{http_code}\n" "$U/rest/v1/moments?select=id,valence,labels,context,note,source,client_version,created_at&order=created_at.desc" -H "apikey: $K" -H "Authorization: Bearer $(tok)" | head -c 2500;;
  moments-insert)
    UID_=$(curl -s "$U/auth/v1/user" -H "apikey: $K" -H "Authorization: Bearer $(tok)" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
    curl -s -w "\nHTTP %{http_code}\n" -X POST "$U/rest/v1/moments" -H "apikey: $K" -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d "{\"id\":\"e2e-probe-$(date +%s)\",\"user_id\":\"$UID_\",\"valence\":3,\"labels\":[\"e2e-probe\"],\"context\":[],\"source\":\"today\",\"client_version\":\"mobile@e2e\",\"device_id\":\"e2e-probe\",\"created_at\":\"$(date -u +%FT%TZ)\"}" | head -c 800;;
  chats)
    curl -s -w "\nHTTP %{http_code}\n" "$U/rest/v1/ai_conversations?select=id,session_id,language,created_at" -H "apikey: $K" -H "Authorization: Bearer $(tok)" | head -c 800
    curl -s -w "\nHTTP %{http_code}\n" "$U/rest/v1/ai_messages?select=id,role,created_at&order=created_at.desc&limit=10" -H "apikey: $K" -H "Authorization: Bearer $(tok)" | head -c 800;;
  *) echo "usage: see header" >&2; exit 2;;
esac

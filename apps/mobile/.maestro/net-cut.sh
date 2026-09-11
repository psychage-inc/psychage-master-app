#!/usr/bin/env bash
# Cut / restore the iOS simulator's path to the app's backends for the offline flows.
# The simulator has no airplane mode and shares the host network, so this points the
# macOS system HTTP/HTTPS proxy (which CFNetwork inside the simulator honours) at a
# dead local port. Node/curl on the host ignore the system proxy, so Maestro and
# this runner keep working. Host browsers ARE affected for the duration — keep it short.
#
#   net-cut.sh on     # cut
#   net-cut.sh off    # restore (also safe to run twice)
#
# NOTE: @react-native-community/netinfo still reports "online" (the interface is up),
# so this exercises "requests fail" rather than "reachability says offline". Recorded
# as such in the verification report.
set -euo pipefail
SERVICE="${NET_SERVICE:-Wi-Fi}"
case "${1:-}" in
  on)
    networksetup -setwebproxy "$SERVICE" 127.0.0.1 9
    networksetup -setsecurewebproxy "$SERVICE" 127.0.0.1 9
    # Keep Metro (localhost:8081) reachable for the Debug dev client; only remote hosts die.
    networksetup -setproxybypassdomains "$SERVICE" "localhost" "127.0.0.1" "*.local"
    networksetup -setwebproxystate "$SERVICE" on
    networksetup -setsecurewebproxystate "$SERVICE" on
    echo "net-cut: ON (proxy → 127.0.0.1:9 on $SERVICE)";;
  off)
    networksetup -setwebproxystate "$SERVICE" off
    networksetup -setsecurewebproxystate "$SERVICE" off
    echo "net-cut: OFF";;
  *) echo "usage: $0 on|off" >&2; exit 2;;
esac
networksetup -getsecurewebproxy "$SERVICE" | head -3

#!/usr/bin/env bash
# Runner for the live-backend E2E suite (2026-08-29). Runs one Maestro flow with the
# evidence directory as CWD so every `takeScreenshot: e2e-NN/step` lands under
#   $EVIDENCE_DIR/e2e-NN/step.png
# and tees Maestro's own output next to it. Extra args are passed to `maestro test`
# (e.g. -e EMAIL=... -e PASSWORD=...).
#
#   .maestro/run-e2e.sh e2e-01-first-run-onboarding [maestro args...]
#
# Env: EVIDENCE_DIR (default ~/dev/psychage-e2e-evidence/<today>), MAESTRO_BIN.
set -uo pipefail
FLOW_NAME="$1"; shift || true
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW="$HERE/$FLOW_NAME.yaml"
[ -f "$FLOW" ] || { echo "no such flow: $FLOW" >&2; exit 2; }
EVIDENCE_DIR="${EVIDENCE_DIR:-$HOME/dev/psychage-e2e-evidence/$(date +%F)}"
mkdir -p "$EVIDENCE_DIR"
export PATH="$PATH:${MAESTRO_BIN:-$HOME/.maestro/bin}"
cd "$EVIDENCE_DIR"
# Pre-create the screenshot folder the flow writes into (e2e-NN prefix of the name).
mkdir -p "$(echo "$FLOW_NAME" | cut -d- -f1-2)"
echo "== $FLOW_NAME  ($(date -u +%FT%TZ))  cwd=$EVIDENCE_DIR" | tee -a "$EVIDENCE_DIR/run.log"
RUN_DIR="$EVIDENCE_DIR/maestro-runs/$FLOW_NAME-$(date +%H%M%S)"
mkdir -p "$RUN_DIR"
# Maestro 2.x writes `takeScreenshot: <name>` under <test-output-dir>/<flow>/takeScreenshot/<name>.png
maestro test --test-output-dir "$RUN_DIR" "$@" "$FLOW" 2>&1 | grep -v "^WARNING" | tee "$EVIDENCE_DIR/$FLOW_NAME.maestro.log"
RC=${PIPESTATUS[0]}
# Collect screenshots next to the report-friendly path $EVIDENCE_DIR/e2e-NN/<step>.png
find "$RUN_DIR" -path "*takeScreenshot*" -name "*.png" | while read -r png; do
  rel="${png#*takeScreenshot/}"; mkdir -p "$EVIDENCE_DIR/$(dirname "$rel")"; cp "$png" "$EVIDENCE_DIR/$rel"
done
echo "== $FLOW_NAME exit=$RC" | tee -a "$EVIDENCE_DIR/run.log"
exit $RC

# D-01 — MindMate crisis handoff: before / after evidence (2026-08-30)

Downscaled captures from the fix branch verification (iPhone 17 Pro sim, iOS 26.2). Full-resolution set + Metro log: `~/dev/psychage-e2e-evidence/2026-08-30-d01/` on the verification machine. Source report: `E2E_VERIFICATION_2026-08-29.md` (D-01).

| File | What it shows |
|---|---|
| `before-02-crisis-message-redbox.png` | Debug, pre-fix: "I want to kill myself" → red box "Couldn't find a navigation context" |
| `before-03-under-redbox-something-went-wrong.png` | Debug, pre-fix: under the red box — root ErrorBoundary, no Help-now pill |
| `after-02-crisis-surface-opened.png` | Debug, fixed: same sequence → crisis surface opens |
| `after-03-chat-with-crisis-card.png` | Debug, fixed: Back → live chat with the inline crisis card |
| `step8-nav-throw-card-still-shown.png` | Debug, fixed, navigation forced to throw (temporary local edit): card + Call 988 + Help-now still shown |
| `release-after-chat-with-crisis-card.png` | Release build, fixed: same flow passes |
| `step10-navigator-halt.png` | Navigator crisis halt unaffected |
| `step10-moment-acute-crisis-surface.png` | Moment-capture acute branch unaffected |

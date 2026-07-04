# FINAL_REPORT — Psychage Mobile Production-Readiness Audit & Remediation

Run: 2026-07-03 · Branch: `audit/production-readiness` (25 commits over `feat/browse-learn-screen` @ 7e980f9) · 166 files, +4048/−991
Companion document: `AUDIT_LOG.md` (full finding register, category coverage ledgers, decisions).

Verified = traced or tested in this run. Anything else is labeled ASSUMED.

---

## 1. What was done

Five autonomous phases per the approved plan: full repo map → exhaustive defect audit (7 parallel per-area sweeps + cross-cutting security/data/resilience/perf sweeps; every CRITICAL/HIGH re-verified by the lead before acceptance) → remediation (one logical fix per commit, CRITICAL→LOW) → self-verification (tests per C/H fix, full gates, EAS release build, a 3-reviewer adversarial second pass over the entire audit diff, 8 end-to-end flow re-traces) → this report.

Findings: **~96 registered** (PR-001…PR-096 plus second-pass items). **2 CRITICAL, 13 HIGH-class, ~30 MEDIUM fixed; ~15 LOG-ONLY by rule** (blocked scope, web-parity, latent-on-orphan-surface, or scope-invention); the rest LOW fixes folded into batch commits.

## 2. Fixed, by theme (finding IDs → commits in AUDIT_LOG's fix ledger)

**Safety-critical**
- Crisis screen and region picker could strand users (raw `router.back()` on empty stack — deep-link cold start). PR-053/054.
- Navigator + MindMate crisis surfaces could show US 911/988 to non-US users (Intl-only region hint). PR-055.
- MindMate: an SSE stream dropping before `done` bypassed BOTH crisis-persistence defenses — crisis chat content could reach Supabase. Now fail-closed at hook and store. PR-073.
- Shared engine: a CRISIS-tagged symptom flipped `is_active:false` in KB data bypassed the halt; red-flag screening now sees all submitted symptoms (halt strictly stricter; scoring unchanged; cap 0.75 verified intact). PR-046.
- Crisis hotline buttons no longer silently no-op on handler-less devices (tel:/sms: catch + show-number fallback). PR-026.

**Privacy / "Delete my record" (S48)**
- The wipe registry carried two names no store ever wrote (relationship-health, sleep entries) and was missing ~13 real keys; the quarantine matcher missed the fixed-name mood-journal quarantine blob (raw journal entries); only 1 of 6 live store singletons and 0 of 8 reactive caches were reset (deleted data kept serving and re-persisted on next write); exported record files survived in the cache dir. All closed; a registry-coverage test now imports every module's real key. PR-007/013/014.
- Sign-up with confirm-email ON no longer fabricates an app-wide phantom "signed in" state; front-door sheet routes to /verify like the standalone screens. PR-074/075/076.
- The S39 therapist form's collected provider PII is now actually used (PDF "Prepared for" row) instead of collected for nothing. PR-090.

**Fabricated data**
- Relationship Health: skipped questions were scored as real "Neutral" answers — skip-all produced a savable composite 50 + fabricated "Mild Conflict Pattern"; therapist PDFs showed "Partner 50/100" for users who declared no partner; second pass also caught the DV-alert triggers still fabricating from skips. All scoring/alerts now use answered items only; empty runs produce no result. PR-020/021 + second pass.
- Clarity: duplicate snapshots per sitting fixed, and (second pass) a same-sitting re-run now REPLACES the saved snapshot so the persisted record always matches the display. PR-024.
- Sleep: "Log last night" no longer silently overwrites today's entry (prefilled edit); equal bed/out-of-bed times rejected (was a phantom 24-hour night); "All nights" export reads the full store (was capped at 120). PR-022/027/028.

**Broken/dead user paths**
- 7 of 32 Learn Browse cards dead-ended over live published content (peaf closed-set resolution) — manifest fall-through added + regression test. PR-084.
- 32 references routed to the removed `/tools/mood-journal` (+not-found) — repointed to Moments/Today. PR-023.
- Home dormant-tool card and Insights "Your Tools" rail landed on a "This is a placeholder" screen — routes point at the real flows; `/tool/[id]` is now a redirect shim. PR-008.
- All three WebView surfaces (Library, Library search, Med Tracker) bounced every user to sign-in then a forever-skeleton — honest "not available here yet" state. PR-057.
- `psychage://preview?days=999999999` froze the JS thread (~1e9-iteration render loop) — param clamped to the legit 7/14/30 set. PR-056.
- Navigator "Start over": second run was never saved while the UI claimed it was, and "Remove this exploration" deleted the previous run's record. PR-019.

**Resilience / error states**
- Compare (both surfaces), DirectoryView, SavedRow: outages no longer render as "no results"/"no longer available"/infinite spinners — real error + retry states; Promise.allSettled keeps partial successes. PR-009/012/060/089.
- Every PDF/export surface surfaces failure (was `void`-discarded unhandled rejections) with double-tap guards. PR-025/067.
- Find wizard survives connectivity blips (overlay instead of unmount), handles Android hardware back, city picker on FlashList, 15s network timeout on the search path. PR-061/062/010/003.
- Font-load failure no longer hangs the splash; verification deep-link expiry no longer fails silently; expired sessions during hydration no longer bounce to /welcome. PR-069/078/083.

**Data integrity (shared package)**
- Three write/read validation asymmetries closed (sleep substances, clarity-journal NaN/screening, remote moment ingestion) — user data no longer silently quarantined a launch later. PR-040/041/042.
- clarity-journal migrator applied transforms for the first time (was check-but-never-apply — first version bump would have mass-quarantined every journal); all three migrators gained progress/throw guards (launch-hang class). PR-043 + second pass.
- Moment store growth cap (2000, just-appended exempt); engagement/sleep/clarity-journal now inside the package's own typecheck gate. PR-030/044.

**Perf / hygiene**
- Mascot assets 21MB → 2.7MB (same visual at render size). PR-011.
- Haptics toggle persists (SR-13 module); real app version in sync provenance (was `mobile@0.0.0`); legacy `psychage:*` stores validate on read (Today-render crash class). PR-001/005/006.
- Unused zustand + async-storage removed; stray `TrendLine.tsx.new` deleted. PR-002/016.

## 3. Autonomous decisions of note (full list in AUDIT_LOG DECISIONS + fix ledger)

- **D-001** In-flight FindCareScreen crisis-sheet→route diff committed as baseline (verified coherent) before audit commits.
- **Skip semantics** (PR-020): scored over answered items only; fully-unanswered domain keeps the 50 the old all-defaults math produced; empty runs blocked pre-scoring. Chosen over schema changes (nullable domains) to preserve persisted shapes — DECISION_MADE_UNVERIFIED against original product intent (web had no Skip).
- **Mood-journal link targets** (PR-023): repointed to Today `/` (where Moment capture lives) — closest living surface to the retired tool.
- **Webview** (PR-057): gated state rendered honestly rather than implementing the token issuer (blocked scope B1/S34).
- **Export file lifetime** (PR-014, revised in second pass): NOT deleted immediately post-share (receiving apps read the URI after resolve — deletion truncated the handoff); removed by both wipe flows and replaced on next export.
- **device-id survives deletion** (PR-039): documented module intent (audit-trail correlation); now stated in known-keys.ts.
- **7-day window** (PR-037): aligned to exactly 7 calendar days across dashboard/digest/export — deliberate, user-visible divergence from web until web adopts the fix.
- **Shared semver**: 0.13.0→0.14.0 despite behavior changes in existing symbols (pre-1.0 package, sole consumer updated atomically in the same commit) — logged, not escalated.
- **LOG-ONLY items** (no code change, per decision rules): sleep-entry delete path (new scope), crisis freshness layer wiring (deferred-scope lifecycle policy; bundled floor serves crisis fully offline), orphan-route cluster incl. `/learn/search` entry point (product wiring decision), dual saved-provider stores (schema migration; mitigated — conflicting surfaces are orphaned), directory fallback caps (latent, orphan surface), haptics live-state divergence after privacy-clear (unobservable until a toggle consumer exists — noted in reset-live-state).

## 4. Test coverage added

~40 new/extended test cases across 15 new files + 12 extended suites, including regression guards designed to fail against the pre-fix code: wipe-registry coverage (imports every module's real key), quarantine-matcher, chat-store fail-closed, Browse-slug resolution (all 32 cards), relationship skip-scoring + DV-trigger gating, sleep re-log/equal-times/130-night export, clarity replaceLatest, haptics migrator, legacy-store hardening, deep-link verification expiry, auth needs-verification union, webview unavailable state, directory timeout, peaf heading-forms + sensitivity drift guard, navigator inactive-CRISIS halt, migrator progress guards. Shared behavioral fixes were red-checked (fix reverted → test fails → restored).

## 5. Build & gate status (final HEAD 8e48087)

| Gate | Result |
|---|---|
| `pnpm typecheck` (shared + mobile) | PASS |
| `pnpm lint` (biome) | PASS (16 pre-existing warnings, 0 errors) |
| Mobile vitest | 896/896 PASS |
| Mobile jest (`--maxWorkers=2`) | 386/386 PASS (94 suites) |
| Shared vitest | 385/385 PASS |
| `npx expo-doctor` | 18/18 PASS |
| `npx expo export --platform android` (production Metro/Hermes bundle) | PASS (9.9MB hbc) |
| EAS production Android build | **finished** — .aab artifact (build d740d5f0) |

EAS note: the first .aab (d740d5f0) was built from commit 05e0afd. **Resolved 2026-07-04**: both artifacts were re-cut at the final code HEAD —
- production .aab (store submission): build `0d60945f` — finished
- preview .apk (installable on-device for smoke-testing): build `d8a45548` — finished

Artifact URLs are on the expo.dev build pages (account ryan2441139, project mobile).

## 6. RESIDUAL_RISK — not verifiable in this environment

1. **Physical-device behavior**: haptics, share sheets (the Android double-tap rejection and content:// read-after-resolve timing were reasoned + guarded, not device-tested), DateTimePicker iOS spinner feel, FlashList perf on low-end hardware, secure-store chunked sessions across OS upgrades, BackHandler interplay with predictive back disabled.
2. **EAS .aab on-device install/run**: the build finished; it was not installed or smoke-run on a device/emulator here. Prior preview-profile builds installed fine; production is a store artifact (not sideloadable unbundled).
3. **Real backend under load**: 15s timeout tuning, search_providers_v3 latency on 423k rows, RLS behavior for ai_conversations/moments under real sessions, Supabase confirm-email + SMTP delivery (known ops blocker, tracked separately), `moments` table schema conformance (migration lives in the web repo — ASSUMED, field-match verified for navigator_history/check_ins only).
4. **Push credentials / notifications**: entire platform layer remains deferred (Wave B2) — reminders UI persists settings but schedules nothing (documented in-code).
5. **App Store / Play review**: Apple 1.4.1/5.1.1 exposure unchanged in substance but crisis-flow navigation changed (sheet→route, goBackOr) — per SR-12 the crisis-flow diffs should be re-reviewed before submission.
6. **Clinical review required (Dobson gate) before ship** — new/changed user-facing copy: Clarity Score Guide dimension names, relationship isolation-alert variant + empty-run notice, Moments-relabeled CTAs, webview unavailable copy, sleep equal-times error, migrate-screen intro, MindMate Offline strip. All flagged NEEDS_CLINICAL_REVIEW in AUDIT_LOG.
7. **Sacred-rule invariants under future KB edits**: the inactive-CRISIS halt backstop is tested, but KB content itself is clinically owned; the sensitivity-list drift guard only ties the two in-repo copies.
8. **Web/mobile divergences introduced deliberately**: 7-day sleep window (PR-037), relationship skip renormalization (web has no Skip), readability/heading gates in peaf 0.14 (will change web authoring-pipeline verdicts when adopted — flagged for the web workstream).
9. **Maestro/E2E**: still 1 flow (bookmarks). The audit's flow verification is code-trace + unit/component tests, not on-device E2E.

## 7. Where everything lives

- `AUDIT_LOG.md` — Phase 1 map, full finding register with verification statuses, category coverage ledgers ("checked, clean" scopes), decisions log, fix ledger (finding → commit).
- Branch `audit/production-readiness` — 25 commits, one logical fix (or one reviewed cluster) each, every message carrying its finding IDs.

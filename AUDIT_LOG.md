# AUDIT_LOG — Psychage Mobile Production-Readiness Audit

Run: 2026-07-03 · Branch: `audit/production-readiness` (from `feat/browse-learn-screen` @ 7e980f9) · Auditor: Claude Code (autonomous, user-approved plan)

Verified = traced or tested by the auditor. Anything else labeled ASSUMED.

---

## PHASE 1 — FULL MAP

### 1.1 Screen/route inventory (77 route files under `apps/mobile/app/`)

**Root**: `_layout.tsx` (Root Stack: AuthProvider → QueryClientProvider → HapticProvider, font gate, theme sync, session hydration, ErrorBoundary at :39-68 — deliberately no error logging per SR-11), `+not-found.tsx`.

**Tabs (4-tab IA)** `(tabs)/_layout.tsx` + custom `AppTabBar`:
- `(today)/`: index (home), history, reflection, reflection-earlier
- `(learn)/`: learn (landing), learn/[category], learn/browse, learn/search, conditions/index, conditions/[slug]/{index,articles}, library/{index,search}, saved
- `(compass)/`: compass (landing), tools/{med-tracker, mindmate, relationship-health, sleep}
- `(find)/`: find (landing), find/directory, find/compare, find/provider/[id]

**Groups**: `(auth)/` 12 screens (sign-in, sign-up, verify, verify-success, forgot-password, reset-password, session-expired, sign-out, migrate, welcome, why); `(therapist)/` (add-provider, range, preview); `settings/` 16 screens (hub, about, appearance, delete, delete-confirm, disclaimer, acknowledgments, privacy, privacy-policy, terms, session-prep, make-it-yours, supporter, reminders).

**Root-level overlays**: crisis.tsx, crisis-region.tsx, onboarding/{welcome,moment,interests}, article/[slug] (root so back returns to origin tab), tool/[id] (placeholder — see PR-004), tools/{clarity, clarity-history, navigator-history, relationship-history}, toolkit.tsx, navigator.tsx, insights.tsx.

**Dev-only (throw if !__DEV__)**: dev-navigator.tsx, dev-icons.tsx.

### 1.2 Navigation graph & deep links

- Helpers `lib/nav.ts`: `goBackOr(fallback)` (guards cold-start deep-link stranding), `openArticle(slug)`, `openConditionGuide(slug)`.
- Schemes: `psychage://` + Google OAuth reversed-client-id scheme. Expo Updates URL configured; runtimeVersion policy `appVersion`.
- Auth deep links `lib/auth/deep-link.ts`: cold start via `Linking.getInitialURL()`, warm via `addEventListener('url')`; handles PKCE `?code=` → `exchangeCodeForSession` and implicit `#access_token` → `setSession`; recovery → `/settings/reset-password?status=ready|expired`; confirm → `/settings/verify-success`. Parse failure → expired state, no logging (SR-11).

### 1.3 State management map

- **No Zustand stores in use** (zustand in deps — see PR-002 unused-dep check). Server state: TanStack Query singleton `lib/query.ts` (staleTime 5m, gcTime 30m, retry 1, no refetchOnWindowFocus). Local state: useSyncExternalStore reactive singletons over MMKV-backed persistence modules.
- **MMKV** instance `psychage-anonymous` via DI seam `lib/adapters/storage.native.ts` (in-memory fallback `storage.ts`). Not encrypted (documented: non-PII tier; auth tokens NOT in MMKV).
- **expo-secure-store**: Supabase session only, key `psychage-auth`, chunked ≤1800B (`lib/supabase/secure-store-storage.native.ts`).

**Persisted keys — SR-13 verification (all VERIFIED by direct read 2026-07-03):**

| Key | Module | Ver | Migrator |
|---|---|---|---|
| mobile:reminder-settings | lib/persistence/reminder-settings.ts | 1 | ✅ reseed-on-anomaly |
| mobile:personalization | lib/persistence/personalization.ts | 2 | ✅ v1→v2 preserves name/homeLead |
| mobile:reading-text-size | lib/persistence/reading-text-size.ts | 1 | ✅ |
| mobile:onboarding-seen | lib/persistence/onboarding.ts | 1 | ✅ |
| mobile:my-providers | lib/persistence/my-providers.ts | 1 | ✅ dedupe+cap |
| mobile:recently-viewed-providers | lib/persistence/recently-viewed.ts | 1 | ✅ |
| mobile:tour-seen | lib/persistence/tour.ts | 1 | ✅ |
| mobile:milestones | lib/persistence/milestones.ts | 1 | ✅ |
| mobile:reflection-row-opened | lib/persistence/reflection-row.ts | 1 | ✅ |
| mobile:directory-location | lib/persistence/directory-location.ts | 1 | ✅ |
| mobile:appearance | lib/persistence/appearance.ts | 1 | ✅ |
| mobile:tier-flags | lib/persistence/tier-flags.ts | 1 | ✅ v0→v1 |
| mobile:sync-consent | lib/persistence/sync-consent.ts | 2 | ✅ v1→v2 preserves consent |
| mobile:bookmarks | features/bookmarks/store.ts | 1 | ✅ |
| mobile:clarity-results | features/clarity/result-store.ts | 2 | ✅ v1→v2 + quarantine |
| mobile:navigator-results | features/navigator/result-store.ts | 1 | ✅ + quarantine |
| mobile:relationship-health-results | features/relationship-health/result-store.ts (migrate.ts) | 1 | ✅ + quarantine |
| sleep entries | packages/shared/sleep/migrate.ts | 1 | ✅ stepwise runner |
| mobile:mindmate-consent | features/mindmate/persistence/chat-consent.ts | 1 | ✅ |
| mobile:moments | packages/shared/engagement MomentStore | internal | ✅ + quarantine keys |
| haptics enabled | lib/haptic-context.tsx | — | ❌ IN-MEMORY ONLY → finding PR-001 |

### 1.4 API call sites (all traced; table from data-layer sweep)

Two Supabase clients: anon read-only `lib/supabase.ts` (persistSession false; returns null unconfigured) and session client `lib/supabase/client.ts` (secure-store, autoRefresh; throws unconfigured).

- Directory: `features/directory/queries.ts` — rpc search_providers_v3 (:128), provider_locations (:174), providers select/detail/featured (:188/:305/:323), facet RPCs directory_state_counts/city/type (:366/:380/:391), count (:406), 5 lookup tables (:418-:450). Cascade RPC→direct; `.error` checked everywhere; lookups degrade to empty; detail throws transient vs null not-found.
- Auth: `features/auth/supabase-auth-service.ts` — signUp (:106), signInWithIdToken (:137), resetPasswordForEmail (:159, anti-enumeration), updateUser password (:172), signInWithPassword (:195, 'email-not-confirmed' | 'invalid-credentials'), resend (:233), getSession (:244), record_auth_event RPC (:93, best-effort swallowed).
- Moments sync: `lib/moment-store.ts` — getUser (:66), writeMoment upsert (:93), readMoments hydrate (:114); consent-gated (default OFF), best-effort, idempotent on client-minted id.
- MindMate persistence: `features/mindmate/persistence/chat-store.ts` — ai_conversations/ai_messages inserts; consent-gated; crisis exchanges never persisted; best-effort.
- Migration: `features/auth/migration/remote.ts` — writeMoment (anon→account), best-effort.
- **No explicit timeout/AbortController anywhere** → finding PR-003.

### 1.5 Data models

`packages/shared/data/types.ts`: ProfileRecord, CheckInRecord (write-gated legacy), MomentRecord, NavigatorHistoryRecord (no raw-symptom field, confidence ≤0.75), TherapistLinkRecord, ShareHistoryRecord, JournalEntryRecord. Provenance: device_id, client_version, schema_version + forward-migration runner (`runForwardMigrations`). No zod at boundaries; structural casts at directory query sites (`as Array<Record<string, unknown>>`).

### 1.6 Permissions

Location only (fine+coarse, while-in-use, background OFF both platforms) — used by directory search + crisis precise-region. No camera. No notifications (push deferred Wave B2). expo-web-browser for OAuth.

### 1.7 Build config

app.json: v1.0.0, runtimeVersion appVersion, newArchEnabled, portrait, light default, iOS `com.psychage.app` (tablet), Android `com.psychage.app` (edge-to-edge, predictive back off). eas.json: simulator/development/preview/production profiles, autoIncrement prod, Node 22.22.3. Metro: NativeWind + monorepo watchFolders. `__DEV__` sites (4): root layout error text, dev-navigator, dev-icons, dev-warn. Env: EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY (EAS env vars for cloud builds; local `.env` present). `lib/adapters/config.ts` stub appVersion '0.0.0' → finding PR-005.

### 1.8 Dependencies (apps/mobile v1.0.0)

expo ~54.0.35, expo-router ~6.0.24, react 19.1.0, RN 0.81.5, @supabase/supabase-js ^2.108.1, @tanstack/react-query ^5.101.0, zustand ^5.0.14 (UNUSED — PR-002), react-native-mmkv ^4.3.1, expo-secure-store ~15.0.8, nativewind ^4.2.4, reanimated ^4.1.7, @shopify/flash-list 2.0.2, skia 2.2.12, svg 15.12.1, webview 13.15.0, expo-print/sharing/speech/file-system, netinfo 11.4.1, async-storage 2.2.0 (usage check pending — PR-002), lottie ~7.3.8, lucide ^1.16.0, fonts (fraunces, ibm-plex-sans), @psychage/shared workspace:*. Dev: jest 29.7.0 + jest-expo, vitest ^4.0.15, RNTL 13.3.3, tsc ~5.9.2, biome (root).

### 1.9 TODO/FIXME/stub inventory

| # | Site | Marker |
|---|---|---|
| 1 | features/webview/auth-handshake.ts:37 | TODO(B1/S34) webview token issuer — gated, stub throws WvtUnavailableError |
| 2 | lib/haptic-context.tsx:13 | TODO(slice-6) persist haptic toggle (SR-13) — PR-001 |
| 3 | components/SearchableList.tsx:122 | @ts-expect-error FlashList JSX under React 19 (documented, keep) |
| 4 | lib/iap/contribute.ts:33 | TODO(platform) StoreKit/Play Billing — stub returns {purchased:false, available:false} |

Deferred-by-design (verify graceful degradation only, do NOT build): push/reminders platform layer (settings/reminders.tsx UI-only), IAP/supporter tiers, WebView token issuer, analytics vendor (no-op adapter). Dead-code sweep: `data/` dir empty placeholder. 187 test files (102 vitest / 85 jest) + 1 Maestro flow.

---

## PHASE 2 — FINDINGS REGISTER

Severity: CRITICAL (data loss / crash / safety) · HIGH (broken flow / security) · MEDIUM (degraded UX / resilience gap) · LOW (polish / hygiene).
Status: OPEN → VERIFIED (auditor traced) → FIXED (commit) → WONTFIX-DEFERRED (blocked scope, logged) / FALSE-POSITIVE.

Seed findings from Phase 1 (verification pending where noted):

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-001 | MEDIUM | lib/haptic-context.tsx:13 | Haptic toggle in-memory only; resets to `true` every launch. User choice silently lost — SR-13 pattern exists, unapplied. | VERIFIED (TODO in code) |
| PR-002 | LOW | apps/mobile/package.json | zustand declared, zero `create(` usage; async-storage direct usage unconfirmed. Unused deps inflate bundle. | OPEN (verify) |
| PR-003 | MEDIUM | all network call sites | No explicit timeout/AbortController; hung TCP stalls UI beyond retry windows (directory search, auth). | VERIFIED (grep) |
| PR-004 | MEDIUM | app/tool/[id].tsx | Placeholder route renders "This is a placeholder for {tool?.name}". Reachability + completion check pending. | OPEN |
| PR-005 | LOW | lib/adapters/config.ts:13 | client_version stamped 'mobile@0.0.0' into synced MomentRecord provenance (lib/moment-store.ts:72) instead of real app version. | VERIFIED |
| PR-006 | LOW | lib/tool-usage-store.ts:22, lib/reading-progress-store.ts:16 | Two legacy `psychage:*` stores lack SR-13 version envelope (tolerant-parse only, documented additive). Hygiene; garbage input already handled. | VERIFIED |
| PR-007 | HIGH | lib/persistence/known-keys.ts + wipe-local-data.ts | "Delete my record" (S48 hard-immediate wipe) misses user data: (a) registry names DON'T MATCH real keys — registry wipes `mobile:relationship-health-results` but store writes `mobile:relationship-health` (features/relationship-health/migrate.ts:15); registry wipes `mobile:sleep-architect-entries` but shared sleep store writes `mobile:sleep-entries` (packages/shared/sleep/migrate.ts:22) → relationship assessment answers + sleep diary entries survive deletion. (b) Keys absent from registry entirely: `mobile:my-providers` (saved care providers), `mobile:milestones`, `mobile:crisis-region`, `mobile:crisis-cache`, `mobile:mindmate-consent` (stale consent survives into next account), `mobile:onboarding-seen`, `mobile:welcome-seen`, `psychage:reads` (which mental-health articles user read), `psychage:tool_usage`, `mobile:moments-migration:mood-journal:done`. (c) `mobile:moments-migration:mood-journal:quarantine` holds RAW mood entries but sweep matcher `includes(':quarantine:')` requires trailing colon — key ends in ':quarantine' → never wiped. | VERIFIED (all keys enumerated + diffed 2026-07-03) |
| PR-008 | HIGH | components/home/PrimaryAction.tsx:30 + lib/tool-usage-store.ts:15-19 | Dormant-tool re-engage card on Today navigates to `tool.route` = `/tool/navigator` / `/tool/clarity` — the PLACEHOLDER route ("This is a placeholder for…") — while real native flows exist at `/navigator` and `/tools/clarity`. ToolsBento already bypasses via COMPASS_ROUTES; TOOLS table routes were never updated. Repro: use app 21 days w/o Navigator after a check-in → tap "It's been a while → Open" → placeholder screen. | VERIFIED (traced both consumers) |

PR-004 folded into PR-008 (same root cause; `app/tool/[id].tsx` itself should redirect to real flows for deep-link safety).

**Batch 7 (cross-cutting sweeps) — returned; findings verified by sweep agent, re-verify pending for MEDIUM+:**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-009 | MEDIUM | features/directory/CompareView.tsx:150-185 | Compare fetch = `Promise.all(ids.map(getProviderById))`; getProviderById throws on transient error; render has loading branch only, NO error branch → infinite spinner offline/5xx; one failure discards successes. | CANDIDATE |
| PR-010 | MEDIUM | features/find/FindCareScreen.tsx:400-445 | City picker renders unbounded `cities.map()` in plain ScrollView (directory_city_counts RPC has no LIMIT; CA = hundreds–1000+ rows), re-renders whole array per keystroke; sibling state step uses FlashList. | CANDIDATE |
| PR-011 | MEDIUM | assets/mascot/ (21 files, 21MB; features/mascot/manifest.ts) | 15 mascot PNGs 1.0–1.9MB each, all statically required → 21MB in every binary/OTA; multi-MB bitmap decode per pose. | CANDIDATE |
| PR-012 | MEDIUM | features/find/FindCareScreen.tsx:838-845 | Compare step inside FindCareScreen swallows Promise.all failure → blank compare body, no message/retry. | CANDIDATE |

PR-006 amplified: corrupt `psychage:reads` blob `"null"` passes JSON.parse → `Object.entries(null)` TypeError during Today render; corrupt `psychage:tool_usage` throws in `recordUse` event path. Both get shape-validation + reseed in fix.

**Batches 3 (tools features) + 5 (lib/components) — returned. Register additions (auditor-verified where marked):**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-007 | HIGH→also | +known-keys misses `mobile:clarity-journal` (packages/shared/clarity-journal/migrate.ts:31) and registry comment for device-id intent absent. Delete-flow cluster now: 2 wrong names, ~11 missing keys, quarantine-matcher miss. | — | VERIFIED |
| PR-013 | HIGH | app/settings/delete-confirm.tsx:31-33, privacy.tsx:52-53 | Wipe flows call only wipeLocalData()+resetMomentStore(); resetSleep/Clarity/Navigator/Relationship/ClarityJournal store fns have ZERO callers → live singletons serve deleted data all session and next save() re-persists the wiped arrays (data resurrection). | VERIFIED (grep: only moment reset called) |
| PR-014 | MEDIUM | lib/export/share-record.ts:25-28 | Exported psychage-record.json/.csv written to Paths.cache, never deleted → plaintext mood-record remnant survives "delete my record". | CANDIDATE |
| PR-015 | MEDIUM | lib/crisis/index.ts:94-96 | Entire crisis freshness layer (CrisisStore + refreshCrisisCache, spec'd once-per-day-on-foreground) has zero consumers; crisis screens serve frozen bundle only. Documented in lib/crisis/HANDOFF.md. | CANDIDATE |
| PR-016 | LOW | components/ui/charts/TrendLine.tsx.new | Stray `.tsx.new` file committed (unresolvable by Metro; divergent variant of live TrendLine). | CANDIDATE |
| PR-017 | LOW | components/ui/BreathingBlob.tsx | Dead component (zero callers); ignores useReducedMotion; hardcoded non-token color. Not user-facing — log only. | CANDIDATE |
| PR-018 | LOW | lib/home-model.ts:84-100 | Hardcoded fixture article copy in live view-model field `model.read`; currently never rendered by HomeView. | CANDIDATE |
| PR-019 | CRITICAL→HIGH | features/navigator/NavigatorFlow.tsx:154-166 + :223 | savedRef once-per-MOUNT not per-run: after "Start over" (RESET) second completed run never saved, ResultsScreen still claims "Saved on this device", and "Remove this exploration" (getRecent(1)[0]) deletes the PREVIOUS run's record. | VERIFIED (read savedRef + RESET path) |
| PR-020 | HIGH | features/relationship-health/scoring.ts:33,93,138-140 + RelationshipFlow.tsx:83 | Skip records nothing; scoring defaults every missing answer to neutral 3 → skip-all yields fabricated composite 50/"mixed"/"Mild Conflict Pattern"; skipped DV item p_ts_02 scored as 3 suppresses safety-alert trigger. | VERIFIED (read scoring + skip handler) |
| PR-021 | HIGH | app/(therapist)/preview.tsx:69-77 | Therapist PDF tool summary renders all 4 relationship domains unconditionally; skipPartner run hands clinician fabricated "Partner 50/100". | VERIFIED (read preview.tsx) |
| PR-022 | HIGH | features/sleep-architect/SleepArchitectView.tsx:64-70,110-111 | "Log last night" always opens mode:'new' with defaults; saveToday silently OVERWRITES today's entry — notes/ratings destroyed, no warning, no prefill. | VERIFIED (SleepLogForm initial only in edit mode; saveToday overwrite traced) |
| PR-023 | HIGH | features/clarity/results-content.ts (5 sites), features/content/related-tools.ts:56,62, features/navigator/knowledge-base.ts (~25 coping_path) | 32 references route to `/tools/mood-journal` — route does not exist (retired into Moments) → +not-found from Clarity results, article related-tools, Navigator wayfinding. | VERIFIED (grep 32 hits; app/tools has no mood-journal) |
| PR-024 | MEDIUM | features/clarity/ClarityFlow.tsx:95-102 + flow.ts:69-71 | BACK from calculating/results resets savedForResults guard → re-answer q20 persists duplicate snapshot same sitting. | CANDIDATE |
| PR-025 | MEDIUM | features/therapist/pdf/printer.ts:13-16 + 3 callers | generateAndShare has no try/catch; all callers `void` the promise → PDF failure (disk full / sharing unavailable) = unhandled rejection, button silently dead. | CANDIDATE |
| PR-026 | MEDIUM | features/relationship-health/components/SafetyAlert.tsx:73,79 + features/clarity/components/open-action.ts:8-11 | Crisis hotline buttons `Linking.openURL('tel:/sms:')` without catch/fallback → silent no-op on devices without handlers (Wi-Fi iPads). Safety surface. | CANDIDATE |
| PR-027 | MEDIUM | packages/shared/sleep/calculations.ts:48-53 + SleepLogForm.tsx:87-89 | Equal bed/out-of-bed time = 1440-min night (midnight-wrap assumption); poisons averages/score/debt/PDF. | CANDIDATE |
| PR-028 | MEDIUM | features/sleep-architect/export/SleepExportView.tsx:38-42 | "All nights" export bounded by getRecent(120) window → >120 nights silently excluded. | CANDIDATE |
| PR-029 | MEDIUM | features/relationship-health/components/ResultsView.tsx:94-104 | Isolation alert reuses DV-specific modal copy (DV hotline as primary resource for lonely-user case). Copy fix ⇒ NEEDS_CLINICAL_REVIEW. | CANDIDATE |
| PR-030 | MEDIUM | packages/shared/engagement/moment-store.ts:171-191 + relationship result-store + insights read-stores | MomentStore uncapped (Navigator caps 50, Clarity 100): full-blob rewrite per append, full re-sort per read; relationship store deep-clones full array per loadHistory. Unbounded growth. | CANDIDATE |
| PR-031 | LOW | features/relationship-health/alerts.ts:41-48 | DV Trigger 2 unreachable (T1 already returns critical for safetyRaw≤2); behavior safe via T1 — doc/code mismatch only. | LOG-ONLY |
| PR-032 | LOW | app/(therapist)/preview.tsx:69 | `createdAt.slice(0,10)` = UTC date vs local dates in-app → PDF date off-by-one west of UTC evenings. | CANDIDATE |
| PR-033 | LOW | features/relationship-health/result-store.ts:90-92 | lastAnomaly never consumed — quarantine silently truncates history with no user surface. | LOG-ONLY |
| PR-034 | LOW | app/tools/clarity.tsx:52 | hasHistory computed once per route render → "past snapshots" link missing after first assessment until re-entry. | CANDIDATE |
| PR-035 | LOW | features/clarity/components/tabs/HistoryTab.tsx:221-223 + clarity.tsx:28 | "Since your first assessment" compares vs oldest of 30-entry window not true first (store keeps 100). | CANDIDATE |
| PR-036 | LOW | features/clarity/components/tabs/ScoreGuideTab.tsx:27 | Score Guide names wrong dimension set ("physical" doesn't exist; actual: Emotional, Overall Wellbeing, Social, Stress Load, Daily Functioning). Factual copy error ⇒ flag Dobson on fix. | CANDIDATE |
| PR-037 | LOW | packages/shared/sleep/calculations.ts:199-200 vs export/digest | "7 days" = 8 calendar days on dashboard vs 7 in export/digest — same-named ranges disagree. | CANDIDATE |
| PR-038 | LOW | packages/shared/sleep/record-store.ts | No delete path for a sleep entry anywhere (store exposes none, no screen). Adding one = new scope → LOG-ONLY per rule 3; residual recommendation. | LOG-ONLY |
| PR-039 | LOW | lib/device-id.ts + known-keys.ts | device-id survives account deletion by design (audit correlation) but intent undocumented in registry → document, keep behavior. | VERIFIED |

**Clean ledger (batches 3+5):** Moments capture→rollup→recap flow correct (worst-of-day, DST-safe windows, milestone idempotency); Navigator reducer/halt un-bypassable, ConfidenceBar clamps ≤75 even on corrupt input; all migrators sound (engagement v1→v2, mood-journal fold idempotent 3 ways, clarity v1→v2, sleep stepwise); SR compliance verified (no >0.75, no diagnostic copy, local-only stores never touch network/Sentry, charts never "trend"/"score"); reactive persistence modules all have stable snapshots + working unsubscribes; charts handle empty/single/NaN datasets; secure-store chunking correct.

**Batch 6 (packages/shared) — returned. 356 shared tests green; all 4 safety invariants HOLD (cap≤0.75 unbypassable incl. hostile config; crisis halt hardcoded, no disable path; keyword lists intact+drift-guarded; 30-term filter correct). Additions:**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-040 | MEDIUM | shared/sleep/record-store.ts:220-233 vs migrate.ts:88-100 | Write validation skips alcohol_units/screens_before_bed_minutes; load validation rejects → entry quarantined next launch (latent; form doesn't expose fields today). | VERIFIED (agent ran repro) |
| PR-041 | MEDIUM | shared/clarity-journal/record-store.ts:89-91,119 | sleepHours NaN passes write, dropped on reload; saveScreening zero runtime validation. | VERIFIED (agent repro) |
| PR-042 | MEDIUM | shared/engagement/moment-store.ts:198-206 | ingestRemote persists remote moments without isValidMoment → bad server row poisons blob → whole-blob quarantine next launch. | VERIFIED (agent repro) |
| PR-043 | MEDIUM | shared/clarity-journal/migrate.ts:230-232 | Migrator checks transform EXISTS but never APPLIES it (no while-loop) — first v2 bump will mass-quarantine every journal. Latent structural SR-13 violation. | VERIFIED (code inspect) |
| PR-044 | MEDIUM | packages/shared/tsconfig.json:38 | include omits engagement, sleep, clarity-journal → three user-data modules never typechecked by package's own gate. | VERIFIED (tsc --listFiles) |
| PR-045 | MEDIUM | shared/peaf/constants.ts:217-257 + quality-gate.ts:268-298 | Independent duplicate of 30-term sensitivity list + reimplemented scan; no drift-guard test between copies. | VERIFIED |
| PR-046 | LOW | shared/navigator/utils.ts:107 | Crisis halt depends on KB is_active flags: inactive/unknown CRISIS symptom bypasses screenRedFlags. No code backstop, no test. Safety-adjacent; fix = screen before active-filter or backstop test. | VERIFIED (trace) |
| PR-047 | LOW | shared/sleep/correlations.ts:26-27 | pearson wrong for unequal-length arrays (means over full arrays, n=min). Internal caller always equal-length. | VERIFIED |
| PR-048 | LOW | shared/sensitivity/filter.ts:28-39 | Substring scan FPs ("his OCD", "non-alcoholic"). Warning-only by design. | LOG-ONLY |
| PR-049 | LOW | shared/peaf/quality-gate.ts:146-159 | Blocking required-section check passes via unanchored `\b<title>\b` match in prose. | VERIFIED |
| PR-050 | LOW | shared/peaf/quality-gate.ts:176-201 | Readability "hard fail" returns blocking:false → never blocks; contradicts standards data + constant name. CHECK_WEIGHTS comment/code mismatch (5 vs 1). | VERIFIED |
| PR-051 | LOW | shared/sleep/calculations.ts:49-84 | Night model: TIB from bedtime but sleep window from lights_out → TST inflated, midpoint can pass out-of-bed. Web-parity port. Equal-times=1440 folded in PR-027. | LOG-ONLY (parity) |
| PR-052 | LOW | shared/peaf/content-architecture.ts:581 | Category 31 relatedCategories includes merged-away 22 → getCategoryByNumber(22) undefined → dead related link. | VERIFIED |

**Batch 1 (app/ routes) — returned. Additions:**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-053 | CRITICAL | app/crisis.tsx:78 | Crisis screen's ONLY exit is raw router.back() — no-op on empty stack (deep-link cold start `psychage://crisis`; also onboarding acute path uses router.replace('/crisis')). User STUCK on crisis surface, no tab bar. | VERIFIED (auditor traced 2026-07-03) |
| PR-054 | CRITICAL | app/crisis-region.tsx:29,41 | Region picker raw router.back() both paths; on cold start selection saves but nav no-ops and UI doesn't reflect change → stranded. | VERIFIED (auditor traced 2026-07-03) |
| PR-055 | HIGH | app/navigator.tsx:52-55 + features/mindmate/components/MindMateView.tsx:34-39 | Navigator crisis interstitial + MindMate CrisisCard resolve region via Intl-only hint (unreliable secondary) skipping expo-localization hint /crisis uses → non-US user can get US 911/988. | VERIFIED (auditor traced 2026-07-03) |
| PR-056 | HIGH | app/(therapist)/preview.tsx:104 + features/therapist/pdf/build-html.ts:116-128 | `days` param `Number(...)||7` unbounded → deep link `?days=999999999` → ~1e9-iteration loop in first-render useMemo → frozen JS thread/OOM. Deep-link cold-start crash. | VERIFIED (auditor traced 2026-07-03) |
| PR-057 | HIGH | features/webview/WebViewSurface.tsx:64-73,152 + auth-handshake.ts:35-40 | 3 live WebView routes (library, library/search, med-tracker) dead-end for EVERYONE: stub issuer always throws → bounce to /sign-in even signed-in; back → skeleton "Still loading…" forever (machine has no timeout→error). Reachable from home rail + condition detail. | VERIFIED (auditor traced 2026-07-03) |
| PR-058 | MEDIUM | app/(auth)/migrate.tsx:26-43 | Orphan route auto-RUNS real moment migration push on mount via bare deep link, no confirmation; no exit affordance after done/offline. | CANDIDATE |
| PR-060 | MEDIUM | features/directory/DirectoryView.tsx:112-113 | search.isError never read → backend outage renders "No matching providers" + filter suggestions (exact silent-empty the throw in queries.ts:247 exists to prevent; FindCareScreen fixed it, DirectoryView didn't). | CANDIDATE |
| PR-061 | MEDIUM | app/(tabs)/(find)/find.tsx:14-20 | Any NetInfo blip unmounts FindCareScreen (swap to OfflineFallback) → entire wizard state lost; reconnect restarts at step 1. | CANDIDATE |
| PR-062 | MEDIUM | features/find/FindCareScreen.tsx | 9-step wizard has no Android BackHandler; hardware back exits tab/app instead of stepping back. | CANDIDATE |
| PR-063 | MEDIUM | app/settings/reminders.tsx:45-50 | iOS spinner picker dismissed on first wheel detent (setShowPicker(false) on every change — Android-dialog pattern applied to iOS). | CANDIDATE |
| PR-064 | MEDIUM | app/settings/_layout.tsx:34-44 | Settings headerLeft raw router.back() → dead on deep-link cold start; no exit from settings stack (no tab bar). | CANDIDATE |
| PR-065 | MEDIUM | app/(auth)/sign-out.tsx:16,26 | Confirm/Cancel raw router.back() → stranded on sheet on cold start. | CANDIDATE |
| PR-066 | LOW | app/(tabs)/(today)/_layout.tsx | Missing initialRouteName (other 3 tabs have it) → deep links to /history,/reflection mount stackless; Back dead (tab bar still escapes). | CANDIDATE |
| PR-067 | LOW | app/settings/privacy.tsx:35-45 | onExport try/finally no catch → export failure silent (busy recovers). Fold into PR-025 export-error family. | CANDIDATE |
| PR-068 | LOW | features/conditions/ConditionArticlesView.tsx:22-23,50-67 | Flash of empty-state + blank title while guide resolves; garbage slug → blank-title empty, no not-found/error. | CANDIDATE |
| PR-069 | LOW | app/_layout.tsx:112-121 | useFonts error ignored → font-load failure = permanent native splash hang (no error path). | CANDIDATE |
| PR-070 | LOW | features/mindmate/components/MindMateView.tsx:82-87 | Status strip hardcodes teal dot + "Online" even offline — dishonest status on MH chat surface. | CANDIDATE |
| PR-071 | LOW | components/home/HomeContainer.tsx:124 | Today model not rebuilt on tab focus (compass.tsx uses useFocusEffect deliberately) → moment captured on Compass not reflected on Today; date rollover stale. | CANDIDATE |
| PR-072 | LOW | app/(auth)/verify.tsx:8-19 | Deep link without email param → blank "we sent it to" copy; resend silent {ok:false}. | CANDIDATE |

PR-025 amplified: call sites also include preview.tsx:127, session-prep.tsx:77, sleep.tsx:22; Android double-tap share = reproducible rejection. PR-059 (tool/[id] raw back) folded into PR-008 fix.

**Batch 2 (auth/crisis/mindmate/settings/webview/onboarding) — returned. Additions (dupes folded: #1-4,13,14→PR-007; #6→PR-057; #11→PR-055; #15→PR-070; #19→PR-067):**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-073 | HIGH | features/mindmate/useMindMateChat.ts:145 + mindmate-service.ts:166-194 + persistence/chat-store.ts:85 | SSE stream ending without `done` event → turnMeta undefined → `!turnMeta?.isCrisis` true AND safetyLevel undefined → chat-store's `=== 'CRISIS'` defense can't fire → crisis exchange CAN persist to ai_messages (serverless timeout mid-crisis-reply). Truncated reply also marked complete. | VERIFIED (auditor traced 2026-07-03) |
| PR-074 | MEDIUM | components/auth/AuthBottomSheet.tsx:57-68 + app/(auth)/welcome.tsx:46-49 | Front-door sign-up never routes to /verify (replace('/')): confirm-email-ON user dropped on home tokenless, relaunch = signed out, no resend surface. Standalone /sign-up does it right. | CANDIDATE |
| PR-075 | MEDIUM | components/auth/AuthBottomSheet.tsx:44-55 | Front-door sign-in maps email-not-confirmed → generic "details did not match" (no /verify recovery unlike sign-in.tsx:31-34). | CANDIDATE |
| PR-076 | MEDIUM | features/auth/supabase-auth-service.ts:121-126 | signUp synthesizes AuthSession when data.session===null (confirm ON) → app-wide phantom signed-in state (settings, ConsentBanner) until relaunch. | VERIFIED (auditor traced 2026-07-03) |
| PR-013 | HIGH→also | Reactive singleton caches (bookmarks store `cache`, my-providers, chat-consent) not dropped post-wipe → stale render + next write re-persists deleted data. Reset-scope now: 5 record stores + reactive persistence caches. | — | VERIFIED (pattern) |
| PR-078 | MEDIUM | lib/auth/deep-link.ts:63-69,92-96 | Expired/invalid VERIFICATION deep link fails silently (error path only wired for recovery links) — no feedback, no resend route. | CANDIDATE |
| PR-079 | LOW | features/webview/WebViewSurface.tsx:160 + wv-load-machine.ts:91-105 | Silent WVT re-handshake renders blank canvas (opacity 0, skeleton suppressed). Gated behind stub issuer today. | LOG-ONLY (blocked scope B1/S34) |
| PR-080 | LOW | components/auth/SignInForm.tsx:69-75 | Sign-in enforces sign-up min-8 rule → legacy/admin-created shorter password can never submit. | CANDIDATE |
| PR-081 | LOW | app/settings/index.tsx:162-168 | "FIXTURE — not final copy" internal marker rendered to users at bottom of Settings hub. | CANDIDATE |
| PR-083 | LOW | app/(tabs)/(today)/index.tsx:33-35 | Welcome-gate reads session without hydrated check → iOS reinstall w/ keychain session flashes/routes to /welcome during hydration. | CANDIDATE |

**Batch 4 (learn/content/conditions/bookmarks/directory/find/toolkit/therapist) — returned. Additions (dupes folded: #2→PR-008 (+YourTools.tsx:53), #3→PR-023, #5→PR-009, #6→PR-060, #17→PR-025):**

| ID | Sev | Site | Summary | Status |
|---|---|---|---|---|
| PR-084 | HIGH | features/learn/CategoryArticlesView.tsx:27-29 + browse-manifest.ts:36-74 | 7 of 32 Browse cards dead-end at "No articles here yet": raw-slug branch resolves via peaf closed 30-slug set; manifest slugs neurodivergence-adhd-autism, eating-body, ocd-related, substance-addiction, sports-exercise-psychology, life-transitions, financial-wellness not in it → slugs=[] → query disabled. Live DB HAS these categories with 70/10/85+ published articles. | VERIFIED (agent checked live DB) |
| PR-085 | MEDIUM | features/find/FindCareScreen.tsx:204-284 vs features/directory/* + bookmarks | Two disjoint saved-provider stores: Find tab saves via my-providers; /saved + ProviderDetailView + CompareView use bookmarks store → provider saved in Find never in /saved, and vice versa. Mitigation: directory/compare routes are ORPHANED (PR-087). | VERIFIED |
| PR-086 | MEDIUM | features/directory/DirectoryView.tsx:121-137 | "Near me" geo search always 0 results — provider_locations has zero coordinate rows (verified live; documented in location.ts:34-38). FindCareScreen dropped geo for this reason; DirectoryView (orphaned route) still offers it. | VERIFIED (agent) |
| PR-087 | MEDIUM | app/(tabs)/(find)/find/directory.tsx, find/compare.tsx, (learn)/learn/browse.tsx, learn/search.tsx | Orphaned routes — zero navigation callers. /learn/search is the ONLY article-search UI → users cannot search articles at all (LearnView inline box filters topic titles only). Also dead: LocationSetup, CategoryStillLife, DirectoryView embed props. | VERIFIED (grep) |
| PR-088 | MEDIUM | lib/articles/repo.ts + learn/content screens | Repo swallows all errors → error branches in 4 screens are dead code; offline indistinguishable from empty ("No articles here yet" during outage). Documented offline posture — fix = retry affordance where cheap, posture kept. | VERIFIED |
| PR-089 | MEDIUM | features/bookmarks/SavedRow.tsx:72-84 | Transient network error labels a valid provider bookmark "No longer available" + disabled with only Remove active — invites deletion during outage. | CANDIDATE |
| PR-090 | MEDIUM | app/(therapist)/add-provider.tsx + features/therapist/use-provider.tsx | S39 form collects provider name+contact PII that NOTHING reads (preview/PDF/share ignore it) — PII collected for zero function. Fix = wire into export (completes S39) not delete. | VERIFIED (grep: setProvider sole consumer) |
| PR-091 | LOW | features/directory/queries.ts:171-224 | Direct-query fallback: 5000-id pre-scope cap silently drops matches; multi-thousand-UUID .in() → ~185KB URL likely 414; fallback ignores language/competency/insurance filters (latent — UI doesn't expose). | LOG-ONLY (orphan surface, latent) |
| PR-092 | LOW | lib/articles/types.ts:64 + ArticleReader:206 | contentFormat 'markdown' modeled but body always parsed as HTML (0 markdown rows live today — latent). | LOG-ONLY |
| PR-093 | LOW | features/learn/hooks.ts:28-41 | useCategoryArticles pagination infra has zero consumers; categories fetched in one ≤1000-row request (85 rows worst case today). | LOG-ONLY |
| PR-094 | LOW | lib/discovery/signal-map.ts:187-190 + SearchView:87-96 | Resolver fetches 1000 rows to keep 8; double search fetch per query (40-row resolver result discarded by design). | LOG-ONLY |
| PR-095 | LOW | features/find/FindCareScreen.tsx:299-335 | Header/Chip/Primary components defined inside render body → new identity per render → header subtree remounts every keystroke. | CANDIDATE |
| PR-096 | LOW | features/bookmarks/SavedList.tsx:26 + SavedRow:22-44 | "Tools" filter can never have content (no tool SaveButton mounts); legacy mood-journal tool bookmark would route to dead /tools/mood-journal. | CANDIDATE (fold route fix into PR-023) |

**Clean ledger (batch 4):** seo_description discipline clean (zero `description` reads); HTML body pipeline defensive w/ prose fall-through; read-aloud lifecycle clean; bookmark store core sound (SR-13); therapist PDF escapes all user input, no confidence/severity leaks (SR-1), CSV RFC4180; conditions null-guarded w/ total ICD-11 partition; toolkit animations cancelled on unmount; content copy person-first/educational everywhere wired; share_history writes: none exist (nothing to audit); topic posters 2.4MB total, fine.

**PHASE 2 COMPLETE — all 7 batches returned. Final counts: 2 CRITICAL, 13 HIGH-class sites (several clustered), ~30 MEDIUM, ~30 LOW; every CRITICAL/HIGH auditor-verified. Category coverage: A/B/C/D/E/F all swept per-directory + cross-cutting; clean ledgers above document examined scope.**

**Clean ledger (batch 2):** crisis integrity SR-3 fully held (no disable path; precheck byte-pinned; tel/sms sanitized; GPS one-shot); tokens secure-store only, chunking correct; anti-enumeration correct; no secrets; SSE decoder malformed-JSON-safe (except PR-073 done-gap); auth validators applied; onboarding flow + acute crisis handoff correct; offline module clean; supporter stub clean; deletion ORDERING correct (remote-first, surfaced failures) — defects are registry/caches not flow.

**Clean ledger (batches 6+1):** dynamic-route param guards OK except preview days; auth service methods total-try/catch, anti-enumeration correct; crisis plumbing (region migrator, GPS one-shot never persisted, dialer swallows) OK; deep-link auth handler both token shapes + errors handled; __DEV__ divergence benign; check-in legacy path unwritten; milestones/date-math/mergeMoments/migrators (engagement, sleep, data) all verified sound; LocalCalendarDate DST-safe (4 copies noted).

**Sweep clean ledger (batch 7):** C security — no hardcoded secrets in source/app.json/eas.json/git history; .env gitignored never tracked; 1 dev-gated console site; no http:// fetches; `.or()/.ilike()` interpolation escaped at all 4 sites; 14 TextInput files traced clean. B — all 30 JSON.parse in try/catch (2 unversioned stores = PR-006); multi-key writes crash-safe; navigator_history/check_ins schema field-match vs migrations VERIFIED; moments table schema ASSUMED (migration lives in web repo). D — all .then/.catch + async-effect sites guarded except PR-009/PR-012. F — listeners/timers all cleaned except sub-second haptic timers (harmless by design).

(Register grows below as Phase-2 batches return; every CRITICAL/HIGH is auditor-verified before acceptance.)

---

## PHASE 2 — CATEGORY COVERAGE LEDGER

To be filled per batch: A logic/correctness · B data integrity · C auth/security · D error handling/resilience · E lifecycle · F performance/completeness. Empty categories will be logged "checked, clean" with examined scope.

---

## DECISIONS LOG

| # | Decision | Reasoning |
|---|---|---|
| D-001 | Committed in-flight FindCareScreen crisis-sheet→route diff as baseline (7e980f9) before audit commits. | Preserves user work; verified all removed-symbol imports still used; /crisis route exists and is the richer surface. |
| D-002 | Release gate = local `expo export --platform android` + expo-doctor, then EAS cloud production build. | No local Android SDK/JDK17; CNG project (no android/ dir); prior EAS builds green. Approved in plan. |
| D-003 | Deferred scopes (push, IAP, webview-token, analytics) audited for graceful degradation only, not implemented. | User rule 3 (no scope invention) + project blocked-scope table; stubs are documented decisions, not defects. |


## PHASE 3 — FIX LEDGER (finding → commit)

- PR-001 → FIXED in 7a1707a
- PR-005 → FIXED in 7a1707a
- PR-006 → FIXED in 7a1707a
- PR-007 → FIXED in 56bcba4
- PR-008 → FIXED in 49e6148
- PR-011 → FIXED in 86ee3bf
- PR-013 → FIXED in 56bcba4
- PR-014 → FIXED in 56bcba4
- PR-016 → FIXED in 4d7a880
- PR-019 → FIXED in 7aea640
- PR-020 → FIXED in e4df43e
- PR-021 → FIXED in e4df43e
- PR-022 → FIXED in 8e33985
- PR-023 → FIXED in c3eb76c
- PR-024 → FIXED in c3caaed
- PR-025 → FIXED in 574a321
- PR-026 → FIXED in 574a321
- PR-027 → FIXED in 8e33985 (form) + shared pending
- PR-028 → FIXED in 8e33985
- PR-029 → FIXED in 0daf8fc
- PR-034 → FIXED in c3caaed
- PR-035 → FIXED in c3caaed
- PR-036 → FIXED in c3caaed NEEDS_CLINICAL_REVIEW
- PR-053 → FIXED in bae3730
- PR-054 → FIXED in bae3730
- PR-055 → FIXED in c134a81
- PR-056 → FIXED in fa0a635
- PR-057 → FIXED in 869fcf3
- PR-058 → FIXED in b63c74c
- PR-063 → FIXED in b63c74c
- PR-064 → FIXED in b63c74c
- PR-065 → FIXED in b63c74c
- PR-066 → FIXED in b63c74c
- PR-067 → FIXED in 574a321
- PR-068 → FIXED in c3caaed
- PR-069 → FIXED in c3caaed
- PR-070 → FIXED in c3caaed
- PR-071 → FIXED in c3caaed
- PR-072 → FIXED in b63c74c
- PR-073 → FIXED in f4382c5
- PR-074 → FIXED in 406fe14
- PR-075 → FIXED in 406fe14
- PR-076 → FIXED in 406fe14
- PR-078 → FIXED in b63c74c
- PR-080 → FIXED in b63c74c
- PR-081 → FIXED in b63c74c
- PR-083 → FIXED in c3caaed
- PR-084 → FIXED in f5ca297
- PR-090 → FIXED in 574a321
- PR-096 → FIXED in c3eb76c
- PR-096 route override folded into PR-023.
- Copy flagged NEEDS_CLINICAL_REVIEW (Dobson pass before ship): PR-023 relabeled CTAs (c3eb76c), PR-020 empty-run alert (e4df43e), PR-029 isolation variant (0daf8fc), PR-036 dimension names (c3caaed), webview unavailable copy (869fcf3), sleep equal-times error (8e33985), migrate-screen intro copy (b63c74c).
- LOG-ONLY (no code change, reasons in register): PR-031 (dead trigger, behavior safe), PR-033 (anomaly surface unconsumed), PR-038 (sleep-entry delete = new scope), PR-039 (device-id survives deletion by documented design — now documented in known-keys.ts), PR-048 (warning-only design), PR-051 (web-parity night model), PR-079 (blocked scope B1/S34), PR-091 (latent, orphan surface), PR-092 (latent, zero markdown rows), PR-093/PR-094 (perf waste, no user impact), PR-015 (crisis freshness layer unwired — REMAINS OPEN as deferred-scope: wiring refresh-on-foreground touches app lifecycle policy; bundle floor serves crisis fully offline today), PR-017/PR-018 (dead components/fields, left in place), PR-058 auto param, PR-085 (dual saved-provider stores — orphan-route mitigation; unification = schema migration, logged residual), PR-086/PR-087 (orphan routes cluster — directory/compare/browse/search unreachable; /learn/search entry-point wiring deferred as scope decision, logged residual).


## PHASE 4 — SELF-VERIFICATION RESULTS (2026-07-03)

**Gates (final HEAD 8e48087):** typecheck PASS (shared+mobile) · biome PASS (0 errors) · mobile vitest 896/896 · mobile jest 386/386 (94 suites, --maxWorkers=2) · shared vitest 385/385 · expo-doctor 18/18 · expo export android PASS (9.9MB hbc) · **EAS production Android build d740d5f0: finished (.aab)** — built at 05e0afd; the 2 later commits are JS-only (clean export re-verified at HEAD).

**Flow re-traces (all PASS, chains in reviewer report):** (a) cold-start psychage://crisis exit; (b) skip-all relationship run blocked; (c) SSE pre-done drop persists nothing; (d) delete-my-record wipes all five previously-surviving key families + resets live stores; (e) confirm-ON welcome-sheet sign-up → /verify, no phantom session; (f) Neurodivergence Browse card queries; (g) dormant card → real /navigator; (h) inactive CRISIS symptom halts. Caveats logged: Android hardware-back on cold-start crisis deep link = OS default (exits app, not stranded); partial-skip relationship domains still show a synthetic 50 (documented fallback).

**Second defect pass:** 3 adversarial reviewers over the full audit diff. 14 candidate issues → 11 confirmed and fixed in 8e48087 (a11y role loss, overlay a11y tree, share double-tap ×2, share-file deletion timing, DV-trigger fabrication interaction, clarity display≠persisted divergence, tool-usage baseline reset, webview sticky flag, migrator progress/throw guards ×3 stores, moment-cap append protection, peaf heading-forms regression, stale parity comment) + 3 accepted-as-documented (haptics live-state post-clear divergence — no toggle consumer exists; shared semver 0.14 vs behavior change — pre-1.0 single-consumer; hydrate re-trim write churn >2000 remote rows — idempotent bytes).

**PHASE 5:** FINAL_REPORT.md written (fix themes, decisions, coverage, build status, RESIDUAL_RISK). Audit complete.

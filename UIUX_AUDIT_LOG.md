# UIUX Audit Log — Psychage Mobile

Autonomous UI/UX defect hunt & repair. Branch: `audit/uiux-repair`. Scope: `apps/mobile` (75 screens). Rules: fix BROKEN only; INTENTIONAL design → OBSERVATION; calm/predictable UI is a functional requirement.

Severity rubric: **CRITICAL** task/safety blocker · **HIGH** visibly broken but passable · **MEDIUM** trust/comfort degraded · **LOW** polish.
Finding IDs: shared tier `S-<COMP>-<nn>` (root cause in a ≥2-site component, carries `sites:`); screen tier `<BATCH>-<nn>`.

## STATE

phase: 2 | batches_done: [P,A,B] | batches_pending: [C,D,E,F,G,H,I,J,SW1,SW2] | findings: 17 (C:0 H:1 M:12 L:4) +1 rejected | repairs_done: 0 | next: batches C+D running. Inventory Status column updated in bulk before Phase 3.

## 1. Hunt Map

### 1.1 Screen Inventory

Chrome legend: SHELL=ScreenShell, TOOL=ToolScreen, NATIVE=native stack header, WEB=WebView chrome, CUSTOM=feature-managed. Status: — not audited · 🔍 in audit · ✅ audited.

| # | Route | Entry paths | Chrome | RNTL | Status |
|---|-------|-------------|--------|------|--------|
| 1 | `(tabs)/(today)/index` (S3 Today home) | tab landing; first-launch redirect target | SHELL | today-route.test.tsx | — |
| 2 | `(tabs)/(today)/history` (S7) | GlobalHeader History link; reflection.tsx:24; settings/index.tsx:116 | CUSTOM | none | — |
| 3 | `(tabs)/(today)/reflection` (S9) | HomeContainer reflection button | CUSTOM | ReflectionView.test.tsx | — |
| 4 | `(tabs)/(today)/reflection-earlier` (S10) | reflection.tsx:23 | CUSTOM | none | — |
| 5 | `(tabs)/(learn)/learn` (S6) | tab landing | SHELL | learn-screen.test.tsx | — |
| 6 | `(tabs)/(learn)/learn/browse` | LearnView internal nav | SHELL | none | — |
| 7 | `(tabs)/(learn)/learn/search` | LearnView search button | SHELL | search-view.test.tsx | — |
| 8 | `(tabs)/(learn)/learn/[category]` | LearnView + BrowseView category taps | SHELL | none | — |
| 9 | `(tabs)/(learn)/library/index` (S23) | LearnView Library link | WEB | none | — |
| 10 | `(tabs)/(learn)/library/search` (S24) | library browse search | WEB | none | — |
| 11 | `(tabs)/(learn)/conditions/index` | LearnView Conditions link | SHELL | ConditionsLibraryView.test.tsx | — |
| 12 | `(tabs)/(learn)/conditions/[slug]/index` | conditions accordion; LearnView; compass tile; nav.ts:39 | SHELL | ConditionDetailView.test.tsx | — |
| 13 | `(tabs)/(learn)/conditions/[slug]/articles` | ConditionGuideView "See all" | SHELL | ConditionArticlesView.test.tsx | — |
| 14 | `(tabs)/(learn)/saved` (T-006) | settings/index.tsx:116 | SHELL | bookmarks-saved-list.test.tsx | — |
| 15 | `(tabs)/(compass)/compass` (S25) | tab landing | SHELL | compass-screen.test.tsx | — |
| 16 | `(tabs)/(compass)/tools/sleep` (S29) | compass.tsx:180 | CUSTOM | SleepArchitectView.test.tsx | — |
| 17 | `(tabs)/(compass)/tools/mindmate` (S-MM) | compass.tsx:110; AiFab default route | CUSTOM | MindMateView.test.tsx | — |
| 18 | `(tabs)/(compass)/tools/relationship-health` | compass.tsx:157 | CUSTOM | none | — |
| 19 | `(tabs)/(compass)/tools/med-tracker` (S31) | compass card | WEB | none | — |
| 20 | `(tabs)/(find)/find` (S28) | tab landing | SHELL | find-screen.test.tsx | — |
| 21 | `(tabs)/(find)/find/directory` | find wizard step | SHELL | none | — |
| 22 | `(tabs)/(find)/find/compare` | find wizard step | SHELL | compare-view.test.tsx | — |
| 23 | `(tabs)/(find)/find/provider/[id]` (S27) | find results card; navigator S18 rec | SHELL | provider-detail-link.test.tsx | — |
| 24 | `app/navigator` (6 internal screens) | compass.tsx:103 | CUSTOM | NavigatorFlow.test.tsx | — |
| 25 | `app/crisis` (S11) | CrisisPill (all chrome); compass.tsx:58; settings:156; clarity:69; relationship exits; onboarding/moment:39 | CUSTOM | CrisisView.test.tsx | — |
| 26 | `app/crisis-region` (S12) | crisis.tsx:80 | CUSTOM | RegionPicker.test.tsx | — |
| 27 | `app/toolkit` (S19–S21) | compass.tsx:79,95; navigator rec | CUSTOM | ExerciseFlow.test.tsx | — |
| 28 | `app/insights` | compass.tsx:173 | CUSTOM | insights-view.test.tsx | — |
| 29 | `app/article/[slug]` (S22) | openArticle() (nav.ts:30) from Learn/conditions/saved/search | SHELL | ArticleReader.test.tsx | — |
| 30 | `app/tool/[id]` (legacy shim) | old deep links → redirect | TOOL | none | — |
| 31 | `tools/clarity` (S32, multi-step flow) | compass.tsx:126 | CUSTOM | ClarityFlow.test.tsx | — |
| 32 | `tools/clarity-history` | clarity.tsx:71 | TOOL | none | — |
| 33 | `tools/navigator-history` | navigator.tsx:106 | TOOL | none | — |
| 34 | `tools/relationship-history` | relationship-health exits | CUSTOM | none | — |
| 35 | `(auth)/welcome` (S0) | first-launch redirect (today/index:51) | SHELL | auth-screens.test.tsx | — |
| 36 | `(auth)/why` | welcome secondary CTA | SHELL | auth-screens.test.tsx | — |
| 37 | `(auth)/sign-in` | welcome; onboarding/welcome:19; session-expired:20; settings:56; sign-up link | SHELL | sign-in-screen.test.tsx | — |
| 38 | `(auth)/sign-up` | welcome; why:10; sign-in:45 | SHELL | auth-screens.test.tsx | — |
| 39 | `(auth)/verify` | sign-in:32 (unconfirmed); welcome:54; sign-up:26; deep-link fallback | SHELL | verify-screen.test.tsx | — |
| 40 | `(auth)/verify-success` | deep link (auth/deep-link.ts:97) | SHELL | none | — |
| 41 | `(auth)/forgot-password` | sign-in:44 | SHELL | auth-screens.test.tsx | — |
| 42 | `(auth)/reset-password` | deep link (recovery token) | SHELL | none | — |
| 43 | `(auth)/session-expired` | root auth listener (>24h) | SHELL | none | — |
| 44 | `(auth)/sign-out` | settings/index.tsx:50 | SHELL | auth-screens.test.tsx | — |
| 45 | `(auth)/migrate` | auto-detect legacy web session | SHELL | migrate-screen.test.tsx | — |
| 46 | `(therapist)/add-provider` (S38) | settings:132; find detail share | SHELL | therapist-screens.test.tsx | — |
| 47 | `(therapist)/range` (S39) | add-provider:21 | SHELL | therapist-screens.test.tsx | — |
| 48 | `(therapist)/preview` (S40) | range:38 | SHELL | none | — |
| 49 | `onboarding/welcome` (S1) | first-launch redirect; (auth)/welcome:32 | CUSTOM | WelcomeView.test.tsx | — |
| 50 | `onboarding/interests` (S2) | onboarding/welcome:18 | CUSTOM | InterestPickView.test.tsx | — |
| 51 | `onboarding/moment` (S4) | auto-open from S3 (checkin=1); interests completion | CUSTOM | OnboardingMomentCapture.test.tsx | — |
| 52 | `settings/index` (S44) | GlobalHeader avatar | SHELL | settings-hub.test.tsx | — |
| 53 | `settings/reminders` | settings:92 | SHELL | reminders-screen.test.tsx | — |
| 54 | `settings/make-it-yours` (modal) | settings:38,80 | SHELL | make-it-yours.test.tsx | — |
| 55 | `settings/appearance` | settings:75 | SHELL | none | — |
| 56 | `settings/about` | settings:144 | SHELL | none | — |
| 57 | `settings/terms` | about:48 | SHELL | none | — |
| 58 | `settings/privacy-policy` | about:53 | SHELL | none | — |
| 59 | `settings/disclaimer` | about:43 | SHELL | none | — |
| 60 | `settings/acknowledgments` | about:58 | SHELL | none | — |
| 61 | `settings/privacy` (PR B) | settings:104 | SHELL | privacy-screen.test.tsx | — |
| 62 | `settings/delete` (PR B) | settings:63 | SHELL | delete-confirm.test.tsx | — |
| 63 | `settings/delete-confirm` (modal) | delete:29 | SHELL | delete-confirm.test.tsx | — |
| 64 | `settings/supporter` (PR C) | settings:149 | SHELL | supporter-screen.test.tsx | — |
| 65 | `settings/session-prep` | settings:123 | SHELL | session-prep-screen.test.tsx | — |
| 66 | `+not-found` | any unmatched route | NATIVE | none | — |
| 67 | `dev-icons` (`__DEV__`) | manual only — INVENTORY ONLY, no fixes | — | — | n/a |
| 68 | `dev-navigator` (`__DEV__`) | manual only — INVENTORY ONLY, no fixes | — | — | n/a |

Internal flow screens (audited in host route's batch):
- Navigator (batch H): `features/navigator/screens/` — WelcomeScreen, SymptomSelectionScreen, DomainSelectionScreen, DetailScreen, ProcessingScreen, ResultsScreen
- Clarity (F): `features/clarity/ClarityFlow.tsx` — welcome / questions / results / retake / history states
- Sleep (F): `features/sleep-architect/` — SleepArchitectView, SleepHome, SleepDashboard, SleepDiary, SleepTools, SleepInsights
- Toolkit (E): `features/toolkit/ExerciseFlow.tsx` — breathing / grounding / body_scan variants
- Relationship (G): `features/relationship-health/` — RelationshipFlow, LandingView, WizardView, ResultsView, HistoryView
- MindMate (G): `features/mindmate/components/MindMateView.tsx` — intro / chat states
- Moment capture (B): `components/moments/MomentCaptureSheet.tsx` — hosted on Today + Compass

### 1.2 Shared Component Inventory (top primitives)

| Component | Path | Uses | Notes |
|---|---|---|---|
| Text | components/ui/Text.tsx | 193 | variant-driven; body scales w/ reading size; maxFontSizeMultiplier=2. FREEZE except CRITICAL |
| Button | components/ui/Button.tsx | 52 | 4 variants; isLoading; haptic affirm; spring scale |
| ScreenShell | components/ui/ScreenShell.tsx | 26 | SafeArea top+bottom, px-4 |
| Card (+sub) | components/ui/Card.tsx | 21 | 5 variants; p-5; radius xl; FadeInUp entrance |
| GlobalHeader | components/GlobalHeader.tsx | 20 | logo + CrisisPill + avatar; tab landings only |
| AnimatedPressable | components/ui/AnimatedPressable.tsx | 20 | 8 spring presets; tilt; haptics; reduced-motion gated |
| ToolScreen | components/ui/ToolScreen.tsx | 10 | tool chrome (logo+crisis+avatar), back row, scroll/none, optional KeyboardAvoidingView |
| AppLoader | components/ui/AppLoader.tsx | 9 | Lottie brand loader; a11y progressbar |
| ScreenEntrance | components/ui/ScreenEntrance.tsx | 9 | staggered FadeInDown |
| AuthTextField | components/auth/AuthTextField.tsx | 8 | labeled input, error slot |
| Skeleton | components/ui/Skeleton.tsx | — | opacity pulse; charcoal-200/800 |
| AnimatedEmptyState | components/ui/AnimatedEmptyState.tsx | — | mascot + float |
| AuthStatePanel/Error/Offline | components/auth/ | 5 | error/offline state pattern |
| AppTabBar | components/AppTabBar.tsx | 1 | custom 4-tab bar, active pill |
| CrisisPill | components/CrisisPill.tsx | 4 | outline-only crisis affordance; NO haptic (by design) |
| SettingsRow family | components/settings/ | ~12 | Row/Toggle/Radio/Section/DestructivePair |
| Charts | components/ui/charts/ | — | TrendLine/ScoreGauge/DomainRadar/MetricBars (react-native-svg) |
| SearchableList | components/SearchableList.tsx | — | search + list |
| Tiles | components/ui/tiles/Tiles.tsx | — | HeroTile/SmallTile/ClarityTile |
| MomentCaptureSheet | components/moments/ | 3 | bottom sheet capture flow |
| Mascot | components/home/Mascot.tsx | 11 | decorative, hidden from SR; forbidden on crisis/navigator/delete |

### 1.3 Design Baseline Digest (untouchable)

- Canonical: `tokens/mobile.tokens.json` + `DESIGN.mobile.md`. Never edit hex values (`dark-contrast.test.ts` locks WCAG).
- Color (light/dark): background #F9F7F3/#000000; surface #F9F7F3/#121212, hover /#1F1F1F, active /#262626; primary #1A9B8C/#20B8A6; text.primary #111827/#FFFFFF, secondary #4B5563/#A1A1AA, tertiary #6B7280/#8A8A8A; border #e7e5e4/#3f3f46; error #dc2626/#f87171; success #16a34a/#4ade80; warning #ca8a04/#facc15; crisis #DC2626 fill both modes, #EF4444 dark outline/text; mood 1–5 #8B7FA8/#D4A060/#8FAE8B/#1A9B8C/#15B8A6; valence 1–5 #22304A/#42505E/#A8A29E/#2DBFAE/#1A9B8C.
- Type: Text.tsx variants only — display/h1 Fraunces 600 (36/30), h2/h3 Plex Medium (24/20), bodyLarge/body Plex 400 (18/16, reading-scale-aware), caption 14 tertiary, label 14 Medium.
- Spacing: 8pt grid. Cards p-5; screens px-4; rows gap-4; list buffer pb-12.
- Radius: lg(8) inputs/small buttons; xl(16) cards; full pills/avatars.
- Motion: DURATION swift 150 / base 250 / calm 400 / breath 4000; springs by name (swift/calm/bouncy/gentle/magnetic/playful/deep/subtle); every animation gates on useReducedMotion.
- Haptics: tap/affirm/confirm/celebrate/alert + sequenced (complete, breath_in/out). No haptic on errors or crisis surfaces (by design).
- Lists: FlashList for long lists; ScrollView `contentContainerClassName="gap-4 px-4 pb-12 pt-2"`; scroll indicators hidden by convention.
- Chrome: GlobalHeader on tab landings; ToolScreen for pushed tools (always carries CrisisPill; never mascot); settings = native header.
- A11y: role+label on interactives; liveRegion polite on loaders; charts get accessibilityLabel; decorative hidden.

## 2. Findings — Shared Tier

### S-BTN-01 — MEDIUM — Button loading swap not reduced-motion gated

- component: Button · file: apps/mobile/components/ui/Button.tsx:117,121,125 · check: motion/jank
- defect: FadeIn/FadeOut on isLoading content swap fires without useReducedMotion gate (3 sites: spinner, string label, children).
- impact: Reduced-motion users see flash transitions on every async CTA — violates calm principle.
- evidence: `<Animated.View entering={FadeIn.duration(DURATION.swift)...}` with no `reduced` ternary.
- fix: `reduced ? undefined : FadeIn...` on all three entering/exiting props.
- sites: all 52 Button usages (behavioral, applies wherever isLoading used)

### S-TOOL-01 — MEDIUM — ToolScreen backLabel/title lack overflow guards

- component: ToolScreen · file: apps/mobile/components/ui/ToolScreen.tsx:89,99 · check: text survival
- defect: backLabel and title Text in header flex-row have no numberOfLines; long strings wrap/push chrome.
- impact: Long contextual back labels distort the tool header at large font scales.
- fix: numberOfLines={1} + ellipsizeMode="tail" on both.
- sites: 10 ToolScreen usages

### S-BDG-01 — MEDIUM — Badge text no numberOfLines

- component: Badge · file: apps/mobile/components/ui/Badge.tsx:55 · check: text survival
- defect: caption Text in pill has no numberOfLines; long status text overflows pill geometry.
- fix: numberOfLines={1} on Badge label.
- sites: all Badge usages

### S-TILE-01 — LOW — ClarityTile feature text inconsistent overflow handling

- component: Tiles (ClarityTile) · file: apps/mobile/components/ui/tiles/Tiles.tsx:142 · check: text survival / consistency
- defect: feature text lacks numberOfLines while sibling title has numberOfLines={2}; HeroTile/SmallTile guard theirs.
- fix: numberOfLines={1} on line 142 for parity.
- sites: Tiles.tsx (compass/home bento)

**Components clean (batch P):** Text, Card, AnimatedPressable, ScreenShell, AppLoader, Skeleton, AnimatedEmptyState, AnimatedScrollView, AnimatedInput, AnimatedTextReveal, BreathingBlob, ScreenEntrance, SearchableList, AppTabBar, TrendLine, ScoreGauge, DomainRadar, MetricBars, CrisisPill, HeaderAvatar, PsychageLogo, SettingsRow family, DestructivePair, AuthTextField, AuthStatePanel, AuthErrorState, Terrain.

### S-MCS-01 — HIGH — MomentCaptureSheet save double-fire

- component: MomentCaptureSheet · file: apps/mobile/components/moments/MomentCaptureSheet.tsx:195 · check: touch/double-fire
- defect: Save Button has no in-flight guard; rapid double tap calls onSave twice → duplicate moments persisted.
- impact: Accidental duplicate capture corrupts the user's record.
- evidence: `disabled={valence === null}` only; no isSaving state.
- fix: `isSaving` state → `isLoading={isSaving}`, `disabled={valence === null || isSaving}`.
- sites: hosted from Today (S3), Compass, onboarding/moment

### S-MCS-02 — MEDIUM — MomentCaptureSheet note input hidden by keyboard

- component: MomentCaptureSheet · file: apps/mobile/components/moments/MomentCaptureSheet.tsx:111,125 · check: keyboard
- defect: Sheet is `max-h-[88%]` with plain ScrollView; no KeyboardAvoidingView, so note TextInput can sit under keyboard.
- impact: User can't see the note they're typing.
- fix: KeyboardAvoidingView (behavior=padding on iOS) around sheet content per ToolScreen pattern.
- sites: same 3 hosts as S-MCS-01

## 3. Findings — Screen Tier

### Batch A — Auth (11/11 screens audited)

#### A-01 — MEDIUM — sign-in password field no keyboard submit

- SignInForm · apps/mobile/components/auth/SignInForm.tsx:105-117 · keyboard
- Password AuthTextField lacks returnKeyType/onSubmitEditing; Return key can't submit.
- fix: `returnKeyType="send" onSubmitEditing={handleSubmit}` (AuthTextField passes ...props through).

#### A-02 — MEDIUM — sign-up confirm-password field no keyboard submit

- SignUpForm · apps/mobile/components/auth/SignUpForm.tsx:158-171 · keyboard
- Same as A-01 for confirm-password field.

#### A-03 — MEDIUM — sign-in "Forgot password?" touch target ~34pt

- SignInForm · apps/mobile/components/auth/SignInForm.tsx:118-127 · touch
- `hitSlop={6}` + py-1 px-1 ≈ 34pt < 44pt floor. fix: hitSlop 12 or py-2.

#### A-04 — MEDIUM — sign-in "Sign up" link touch target ~34pt

- SignInForm · apps/mobile/components/auth/SignInForm.tsx:143-154 · touch
- Same geometry as A-03. fix: hitSlop 12 or py-2.

#### A-05 — MEDIUM — sign-up terms checkbox touch target ~36pt

- SignUpForm · apps/mobile/components/auth/SignUpForm.tsx:175-213 · touch
- `hitSlop={6}` around 24pt checkbox row < 44pt. fix: hitSlop 10 or py-2.

#### A-06 — LOW — verify screen long email may wrap 3+ lines

- VerifyPanel · apps/mobile/components/auth/VerifyPanel.tsx:57 · text survival
- `<Text variant="bodyLarge">{email}</Text>` unclamped. fix: numberOfLines={2}.

**Clean:** welcome, why, verify-success, reset-password, session-expired, forgot-password, sign-out, migrate.

### Batch B — Today (4/4 screens + capture sheet audited)

Promoted to shared tier: S-MCS-01 (save double-fire), S-MCS-02 (keyboard over note input).
**REJECTED at merge:** agent's "Button isLoading opacity fade not reduced-motion gated" claim — `opacity: ternary` in a plain style prop is an instant swap, not an animation; no defect. Re-check during S-BTN-01 repair (same file).

#### B-02 — MEDIUM — reflection week line unclamped

- ReflectionView · apps/mobile/features/reflection/ReflectionView.tsx:70 · text survival
- `week.line` italic display text has no numberOfLines; long generated insight clips/illegible at fontScale 1.3 on 360pt.
- fix: numberOfLines={3}.

#### B-03 — MEDIUM — reflection-earlier week lines unclamped

- EarlierReflectionsView · apps/mobile/features/reflection/EarlierReflectionsView.tsx:67 · text survival
- Same class as B-02 per card. fix: numberOfLines={2}.

#### B-04 — MEDIUM — home rails layout shift on async load

- InterestRails/PickUpRail/MostRead · apps/mobile/components/home/rails/{InterestRails.tsx:33-79, PickUpRail.tsx:20-50, MostRead.tsx:16-50} · motion/jank
- Rails render null while self-fetching, then pop in → page jumps below the fold on first load.
- fix: reserve rail-height Skeleton while loading (existing Skeleton primitive), keep render-null only for confirmed-empty.

#### B-07 — LOW — history FlashList missing estimatedItemSize

- MomentsHistoryView · apps/mobile/components/moments/MomentsHistoryView.tsx:107 · scroll
- fix: estimatedItemSize≈65. (FlashList v2 note: verify prop still applies before fixing.)

#### B-08 — LOW — stale checkin=1 param re-opens capture sheet

- today/index + HomeContainer · apps/mobile/app/(tabs)/(today)/index.tsx:24,28,60 · navigation
- Param persists across tab re-entry; sheet auto-opens twice in one session.
- fix: consume-once (router.setParams({checkin: undefined}) after open, or one-shot ref).

**Clean:** history (S7) apart from B-07; reflection (S9) apart from B-02; reflection-earlier (S10) apart from B-03.

## 4. Observations (design left alone)

(pending)

## 5. Repair Ledger

| ID | Commit | Files | Verify (types/lint/tests) | Tags |
|---|---|---|---|---|

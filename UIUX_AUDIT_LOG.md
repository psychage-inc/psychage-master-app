# UIUX Audit Log — Psychage Mobile

Autonomous UI/UX defect hunt & repair. Branch: `audit/uiux-repair`. Scope: `apps/mobile` (75 screens). Rules: fix BROKEN only; INTENTIONAL design → OBSERVATION; calm/predictable UI is a functional requirement.

Severity rubric: **CRITICAL** task/safety blocker · **HIGH** visibly broken but passable · **MEDIUM** trust/comfort degraded · **LOW** polish.
Finding IDs: shared tier `S-<COMP>-<nn>` (root cause in a ≥2-site component, carries `sites:`); screen tier `<BATCH>-<nn>`.

## STATE

phase: 2 | batches_done: [P,A,B,C,D,E,F,G,H,I,J] | batches_pending: [SW1,SW2] | findings: 30 confirmed (C:0 H:5 M:18 L:7), 10 rejected after verification | repairs_done: 0 | next: sweeps SW1+SW2 running, then Phase 3 repair (order: S-MCS-01, J-01, C-01, E-01, I-01 → MEDIUMs shared-first → LOWs)

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

### S-CHIP-01 — MEDIUM (VERIFY-AT-REPAIR) — ChipXL double-tap double-answer

- component: ChipXL · file: apps/mobile/features/navigator/components/ChipXL.tsx:21 · check: touch/double-fire
- defect: `onPress={() => onAnswer(o.value)}` unguarded; rapid double-tap before re-render can dispatch ANSWER twice → advances two steps with one intended answer.
- impact: Assessment answers desync from questions (clarity + navigator flows).
- fix: one-shot guard per step (ref or disabled-after-press until step index changes). Verify reducer semantics first.
- sites: navigator symptom flows + clarity questions

### S-BTN-03 — MEDIUM — Button accessibilityState ignores isLoading

- component: Button · file: apps/mobile/components/ui/Button.tsx:100 · check: a11y
- defect: `accessibilityState={{ disabled: !!disabled }}` — SR announces enabled while isLoading blocks presses (line 87 guards `disabled || isLoading`).
- impact: VoiceOver/TalkBack users told button is active when it isn't.
- fix: `disabled: !!disabled || !!isLoading`, plus `busy: !!isLoading`.
- sites: all 52 Button usages (a11y-only change, zero visual/behavioral risk)

### S-BTN-02 — REJECTED — Button onPress during isLoading

- Batch E suspected onPress fires during isLoading. Batch H verified FALSE: Button.tsx:87 guards `disabled || isLoading` on the Pressable. No defect.

### Orchestrator verification pass 1 (direct reads, pre-repair)

- **S-BTN-01 CONFIRMED** by direct read — FadeIn/FadeOut ungated at Button.tsx:117/121/125 AND `LinearTransition.springify()` layout animation at :113 also ungated. Fix covers all four.
- **S-BTN-03 CONFIRMED** — Button.tsx:100.
- **S-CHIP-01 RESOLVED (keep, MEDIUM)** — ChipXL is one-tap-advances by design (comment at ChipXL.tsx:5-7); ultra-fast double-tap before step re-render can still double-dispatch (ClarityFlow.tsx:244 `onPress={() => onAnswer(o.value)}`). Fix: one-shot guard in ChipXL reset on label change (instance reuse safe). DECISION_MADE_UNVERIFIED (exact race timing not device-verified; guard is harmless).
- **G-01 REJECTED** — MessageList.tsx uses reversed-data + scaleY-flip: offset 0 IS the visual bottom → new messages auto-appear; scrolled-up users not yanked. Documented in file comment.
- **F-04 REJECTED** — openClarityAction (open-action.ts:13-30) already catches Linking failures with Alert fallback naming the number; never silent. Crisis-safe as-is.
- **F-05 / F-12 REJECTED** — prompt and chip labels sit in column ScrollView (ClarityFlow.tsx:232-247); RN Text wraps naturally, pill min-h grows, screen scrolls. No overflow path.
- **F-11 REJECTED → OBSERVATION** — ConsultationGuidance links have pressed opacity + accessibilityRole="button"; matches CrisisUrgentBanner idiom. Adequate feedback.
- **B-07 REJECTED** — FlashList v2 auto-sizes; `estimatedItemSize` deprecated (documented at MessageList.tsx:9-10).
- **D-01 / D-02 REJECTED → OBSERVATION** — Text.tsx sets no accessibilityRole/aria-level on heading variants and ConditionGuideView/ArticleBody headings carry none; RN SRs see plain text, so "hierarchy skip" is visual variant naming with zero SR impact. Swapping variants would change typography = forbidden restyle. OBS: app-wide absence of header roles is a candidate future a11y improvement (systemic, out of minimal-diff scope).

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

### Batch C — Learn core (5/5 screens audited)

#### C-01 — HIGH — [category] back chevron invisible in dark mode

- CategoryArticlesView · apps/mobile/features/learn/CategoryArticlesView.tsx:45 · consistency/dark
- `<ChevronLeft color={colors.charcoal[600]} />` hardcoded light-mode ink → near-invisible on #000000.
- fix: `useThemeColors()` themed ink (match other back buttons).

**Clean:** learn (S6), learn/browse, learn/search, saved.

### Batch D — Reading surfaces (6/6 screens audited)

#### D-01 — HIGH (VERIFY-AT-REPAIR) — condition guide heading hierarchy skips h1→h3

- ConditionGuideView · apps/mobile/features/conditions/ConditionGuideView.tsx:91-114 · a11y
- Definition labels use variant="h3" directly under h1 title.
- CAUTION: RN SRs don't read Text visual variants as heading levels; swapping variant changes visual typography (restyle risk). Verify actual a11y impact (accessibilityRole/aria-level) before touching; may downgrade to OBSERVATION.

#### D-02 — MEDIUM (VERIFY-AT-REPAIR) — article body maps HTML h2 → visual h1

- ArticleBody · apps/mobile/features/content/blocks/ArticleBody.tsx:129 · a11y/consistency
- `case 'heading2': return <Heading variant="h1">` while page title is already h1.
- Same caution as D-01; content-structure dependent.

**Clean:** conditions/index, conditions/[slug]/articles, conditions/[slug] (category branch), library, library/search; article/[slug] apart from D-02. Notable good: TTS stops on unmount; PEAF blocks degrade gracefully; hero images reserve aspect ratio.
**OBS (D):** ArticleListCard/RelatedArticleCard use inline router.push instead of openArticle() helper — functionally correct; consistency note only.

### Batch E — Compass hub + toolkit + insights (4/4 routes audited)

Promoted/merged to shared: E-02 → S-TOOL-01 sighting; E-03 → S-BTN-02 (new, verify).

#### E-01 — HIGH — DeepDiveCard title+feature unclamped at fontScale

- DeepDiveCard · apps/mobile/features/compass/CompassTile.tsx:173-176 · text survival
- No numberOfLines on title or feature; overflows tile bounds at fontScale 1.3.
- fix: numberOfLines (match HeroTile/SmallTile title pattern).

#### E-04 — LOW — compass HeroTile/SmallTile feature text unclamped

- CompassTile.tsx:81-83,113-115 · text survival
- feature subtitle text-xs without numberOfLines; wraps/overflows at fontScale 1.3 on 360pt.
- fix: numberOfLines={1}. (Fix together with E-01 — same file.)

**Clean:** insights (12/12 — no "trend"/"score" wording, empty states good), tool/[id] (unknown id → clean fallback), toolkit apart from shared sightings, compass apart from E-01/E-04.
**OBS (E):** reduced-motion breathing conveys pace via phase words + haptics (compliant); back mid-exercise routes to wind-down deliberately; insights has no energy section (stale priming — fine).

### Batch F — Clarity + Sleep (all flow states audited)

Merged: F-02 → duplicate of S-BTN-01 (dropped); F-13 merged into F-03; F-01 → S-CHIP-01 (shared, verify).
Downgraded to observations: F-07 (speculative low-end spring jank), F-08 (empty-copy differentiation = copy design), F-09 (history rows view-only = design choice).

#### F-04 — HIGH (VERIFY-AT-REPAIR) — clarity crisis actions lack failure feedback

- CrisisUrgentBanner · apps/mobile/features/clarity/components/CrisisUrgentBanner.tsx:50-102 · async feedback/navigation
- tel:/sms: Linking calls and /crisis push have no failure handling; on devices without telephony the tap silently does nothing.
- CAUTION: crisis surface — copy frozen; fix must be minimal (e.g. Linking.canOpenURL fallback → route to /crisis) and reuse existing copy. Verify actual Linking usage first.

#### F-03 — MEDIUM — sleep PDF export button no in-flight state

- SleepExportView · apps/mobile/features/sleep-architect/export/SleepExportView.tsx:97-105 · async feedback
- Generate button lacks isLoading; route-level `exporting` guard exists but no UI signal → users re-tap thinking press missed.
- fix: thread exporting state down → `isLoading` on Button.

#### F-05 — MEDIUM (VERIFY-AT-REPAIR) — clarity question prompt overflow at fontScale 1.3

- ClarityFlow.tsx:239-240 · small screen/large font
- Claim: h1 prompt overflows. SUSPECT: RN Text wraps by default in column layouts. Verify container direction before any fix; likely reject.

#### F-10 — MEDIUM — sleep chronotype quiz save is silent

- SleepArchitectView.tsx:98-106 · async feedback
- saveSettings + reload with no success signal; user misses that targets went active.
- fix: reuse existing confirmation pattern from sleep feature (no new clinical copy; sleep copy layer if string needed).

#### F-06 — LOW — sleep diary row crowding at fontScale 1.3

- SleepDiary.tsx:56 · small screen/large font
- flex-row date/quality vs duration without shrink bounds. fix: flex-shrink/minWidth guards.

#### F-11 — LOW (VERIFY-AT-REPAIR) — ConsultationGuidance Text-as-button feedback

- ConsultationGuidance.tsx:163-186 · touch/a11y
- Text with accessibilityRole="button" + opacity press state; verify pressed feedback adequacy vs AnimatedPressable pattern. Possibly OBSERVATION.

#### F-12 — LOW (VERIFY-AT-REPAIR) — ChipXL label overflow claim

- ChipXL.tsx:21-27 · small screen/large font
- Same suspicion as F-05 (Text wraps naturally). Verify; likely reject.

**Clean:** clarity intro/calculating/results-dimensions/results-guide/history route, sleep home/diary/tools/wind-down apart from listed items. SR-1 sleep no-gauge CONFIRMED; clarity gauge sanctioned (web-parity override); crisis interstitial reachable, returns to q4.
**OBS (F):** mid-assessment state loss on unmount is BY DESIGN (SR-4 client-only, no persistence); diary time validation solid; TierBadge custom sizing not a Badge instance.

### Batch H — Navigator + Crisis (ALL screens audited: navigator entry + 6 internal screens + HaltView, navigator-history, crisis, crisis-region — ZERO defects)

All 12 checks pass on every surface. Verified: SR-1 ConfidenceBar clamps display to [8,75]% (ConfidenceBar.tsx:31-32); SR-2 crisis ungated everywhere, CRISIS-tag halt path calm, no haptics on crisis surfaces (EmergencyButton haptic.affirm = sanctioned essential feedback); SR-4 navigator state in-memory only, crisis runs never persisted; tel:/sms: intents DEFENSIVE (`Linking.openURL().catch()`) in EmergencyButton + CrisisCallRow; processing screen ~2.25s (no flash); touch targets 56–72pt; region picker FlashList.
Cross-verification bonuses: **S-BTN-02 rejected** (Button.tsx:87 `disabled || isLoading`); **S-CHIP-01 disputed** (H: ChipXL = single-press navigation button, not multi-fire risk; F said double-answer possible — orchestrator resolves by direct read at repair).

### Batch G — MindMate + Relationship + MedTracker (4/4 routes audited)

Promoted to shared: G-02 → S-BTN-03 (a11y state, real).

#### G-01 — HIGH (VERIFY-AT-REPAIR, likely reject) — mindmate chat auto-scroll claim

- MessageList · apps/mobile/features/mindmate/components/MessageList.tsx:11 · scroll
- Agent claims no auto-scroll to new messages. SUSPECT: scaleY-flip + reversed data = standard inverted-chat pattern where offset 0 IS the visual bottom → new messages auto-appear and scrolled-up users aren't yanked. Direct read at repair; expected reject.

#### G-03 — LOW — relationship wizard options lack pressed feedback

- QuestionCard · apps/mobile/features/relationship-health/components/QuestionCard.tsx:30-44 · touch/consistency
- Raw Pressable, no opacity/scale pressed state (haptic fires, visual doesn't). Everything else in app gives visual press feedback.
- fix: AnimatedPressable wrapper or pressed-state style, matching existing wizard idiom.

**Clean:** relationship landing, relationship-history, med-tracker (WebView skeleton/error/offline verified), wizard (auto-advance double-fire GUARDED via pending check) apart from G-03; mindmate intro/consent/crisis-card states verified sound.
**OBS (G):** CrisisCard persists once shown (per spec); ConsentBanner dismiss vs consent state separation intentional.

### Batch I — Find + Therapist (7/7 screens audited)

#### I-01 — HIGH — compare card provider name unclamped in 180px column

- CompareStep · apps/mobile/features/find/FindCareScreen.tsx:964 · text survival
- Name Text in `w-[180px]` horizontal-scroll card has no numberOfLines; long real-directory names overflow card.
- fix: numberOfLines={2} ellipsizeMode="tail" (mirror directory/CompareView.tsx:89 which already guards).

#### I-02 — MEDIUM — compare card field values unclamped

- CompareStep C helper · apps/mobile/features/find/FindCareScreen.tsx:931-932 · text survival
- Type/License/NPI values unclamped in same 180px column. fix: numberOfLines={1} on value Text.

#### I-03 — LOW — add-provider form fields no returnKey/dismiss

- ProviderForm (via AuthTextField passthrough) · check: keyboard
- fix: returnKeyType + onSubmitEditing/blurOnSubmit at ProviderForm call sites (AuthTextField forwards ...props; no primitive change).

**Clean:** find (all wizard steps; searchProviders failure → error state + retry; offline overlay preserves step state), directory, provider/[id] (null-field handling honest), range, preview (PDF double-fire GUARDED via sharingRef; share failure surfaced).
**OBS (I):** FindCareScreen is a 1054-line monolith (maintainability note, not defect); 180px compare column tight by design.

### Batch J — Settings + Onboarding + misc (18/18 screens audited)

Merged: J-03 → S-MCS-01 sighting (onboarding/moment host confirmed).
Severity note: agent filed J-01 as CRITICAL ("data corruption") — orchestrator holds it at HIGH (deletion double-fire is a real destructive-flow defect; corruption claim unsubstantiated).

#### J-01 — HIGH — delete-confirm double-fire on account deletion

- DeleteConfirmScreen + DestructivePair · apps/mobile/app/settings/delete-confirm.tsx:28-72 · async/double-fire
- `onConfirm` async with no re-entrancy guard; DestructivePair exposes no disabled/loading; rapid taps invoke requestRemoteAccountDeletion() in parallel + double route replace.
- fix: `isDeleting` guard in screen (+ disabled support on DestructivePair if minimal).

#### J-02 — MEDIUM — privacy export buttons no in-flight spinner

- settings/privacy.tsx:108-113 · async feedback
- `disabled={busy}` present (button dims) but no `isLoading={busy}` → no spinner while export runs.
- fix: add isLoading={busy} to both export Buttons.

**Clean:** settings hub, reminders, appearance, about, terms, privacy-policy, disclaimer, acknowledgments, make-it-yours, session-prep (busy guard verified), delete (pre-confirm), supporter, onboarding welcome/interests/moment (apart from S-MCS sightings), +not-found (recovery CTA present).
**OBS (J):** onboarding swipe-back escape is intentional (anonymous-first, never walls).

## 4. Observations (design left alone)

(pending)

## 5. Repair Ledger

| ID | Commit | Files | Verify (types/lint/tests) | Tags |
|---|---|---|---|---|

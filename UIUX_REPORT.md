# UIUX Repair Report — Psychage Mobile

Autonomous UI/UX defect hunt & repair across all 75 screens of `apps/mobile`. Branch: `audit/uiux-repair` (off `main` @ 2371a73). Full hunt map, findings, and repair ledger: `UIUX_AUDIT_LOG.md`.

## Summary

- **Screens audited:** 66 production screens + all internal flow screens (navigator ×6, clarity flow states, sleep 4-tab, toolkit variants, relationship wizard, mindmate states, moment-capture sheet) + 2 `__DEV__` screens inventoried-only. No screen skipped — per-screen verdicts in `UIUX_AUDIT_LOG.md` §3.
- **Hunt:** 11 batch agents + 2 cross-screen sweeps + orchestrator verification passes produced **54 raw defect claims** → **29 confirmed and fixed**, **25 rejected with evidence** (false positives, duplicates, documented-intentional design).
- **Fixed:** 29 findings (0 CRITICAL existed · 5 HIGH · 15 MEDIUM · 9 LOW), one commit per finding, `fix(uiux): <ID> — …`.
- **Verification:** typecheck clean · Biome 0 errors · Vitest 108 files / 896 tests green · Jest 94 suites / 386 tests green · independent re-audit agent: 28/28 fixes PASS, zero regressions, zero unaccounted changes · `/mobile-design-audit`: zero token/anti-slop violations on any changed line (all reported hits are pre-existing FindCareScreen debt, catalogued below).
- The codebase was already in strong shape (recent production-readiness audit): navigator + crisis surfaces passed all 12 checks with **zero defects**; sacred rules (confidence cap, crisis ungated, no symptom telemetry) verified intact everywhere.

## Fixed findings (before → after)

### HIGH

- **S-MCS-01** — MomentCaptureSheet save double-fire. Before: rapid double-tap handed the draft up twice → duplicate moments + duplicate crisis navigation. After: one-shot `saving` guard, resets on failure for retry. `components/moments/MomentCaptureSheet.tsx`.
- **J-01** — Account-deletion confirm double-fire. Before: `onConfirm` awaited the remote cascade while the destructive button stayed pressable → parallel deletion RPC + double wipe + double route replace. After: ref re-entrancy guard, reset only on the surfaced-failure branch. `app/settings/delete-confirm.tsx`.
- **C-01** — Category back chevron invisible in dark mode. Before: hardcoded light charcoal on true-black. After: `useThemeColors().inkSecondary` (matches BrowseView). `features/learn/CategoryArticlesView.tsx`.
- **E-01** — DeepDiveCard text overflow at fontScale 1.3. After: title `numberOfLines={2}`, feature `numberOfLines={1}`. `features/compass/CompassTile.tsx`.
- **I-01** — Compare-card provider name overflowed its fixed 180px column with real directory names. After: `numberOfLines={2}` (mirrors directory/CompareView's existing guard). `features/find/FindCareScreen.tsx`.

### MEDIUM

- **S-BTN-01** — Button loading-swap FadeIn/FadeOut ×3 + springified LinearTransition all ran under reduce-motion. After: all four gated on `useReducedMotion`. `components/ui/Button.tsx` (52 usage sites, behavior verified unchanged for non-reduced users).
- **S-BTN-03** — Loading Buttons announced as enabled to screen readers while presses were blocked. After: `accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}`.
- **S-TOOL-01** — ToolScreen back label/title could wrap into the crisis-pill cluster. After: single-line clamps with tail ellipsis (all 10 usage sites re-verified; the 2 title users are short strings).
- **S-BDG-01** — Badge label unclamped → broke pill geometry. After: `numberOfLines={1}`.
- **S-MCS-02** — Capture-sheet note input could sit under the keyboard (fixed-height sheet, no accommodation). After: KeyboardAvoidingView (iOS padding) around the card; backdrop tap-close and slide animation verified intact.
- **A-01 / A-02** — Sign-in password and sign-up confirm-password fields had no keyboard submit. After: `returnKeyType` + submit-guarded `onSubmitEditing`; email advances with "next".
- **A-03 / A-04 / A-05** — Sign-in "Forgot password?"/"Sign up" links (~34pt) and sign-up terms checkbox (~36pt) under the 44pt floor. After: hitSlop raised (12/12/10); no adjacent-target collisions.
- **F-10** — Chronotype quiz saved bedtime/wake targets silently. After: inline polite-live-region confirmation on the tools menu, cleared on next tool open; string added via `CT4_SLEEP.tools.targetsSaved`.
- **I-02** — Compare-card field values (license/type) wrapped unpredictably in the 180px column. After: `numberOfLines={1}`.
- **J-02** — Privacy data-export buttons only dimmed while exporting. After: per-format `isLoading` spinner (`busy: ExportFormat | null`).
- **SW2-04** — Clarity history score ring used a light-only border (`#9ca3af55`), near-invisible on true-black. After: border token pair via NativeWind classes, geometry preserved.
- **SW2-05** — Clarity calculating spinner hardcoded to light teal in dark mode. After: `tc.primary`.
- **SW2-06** — ConsultationGuidance check icons hardcoded light teal. After: `tc.primary` (already in scope).

### LOW

- **S-TILE-01** — ui/Tiles ClarityTile feature line unclamped (sibling title already clamped). After: `numberOfLines={1}`.
- **E-04** — Compass HeroTile/SmallTile/ClarityTile feature subtitles unclamped at fontScale 1.3. After: `numberOfLines={1}` ×3.
- **F-06** — Sleep diary row left column had no flex bound; could collide with the duration label at large font scales. After: `flex-1 pr-3`.
- **G-03** — Relationship wizard Likert rows fired haptics with no visual press state. After: pressed-opacity style (house idiom).
- **I-03** — Add-provider form left the keyboard with no return-key path. After: name → "next", contact → "done" + submit (validation intact).
- **SW1-05** — ArticleListCard/RelatedArticleCard bypassed the sanctioned `openArticle()` entry point with inline pushes. After: both use `openArticle(slug)`.
- **SW2-01** — AnimatedInput (currently unused) had light-only rest border/label and off-token float background — latent dark-mode breakage. After: theme-branched against border/text/surface tokens.
- **F/DA-01** — FindCareScreen's local Skeleton ran an infinite opacity pulse with no reduce-motion path (surfaced by `/mobile-design-audit` Pattern 12). After: static opacity when reduced, mirroring the shared ui/Skeleton.

## OBSERVATIONS (deliberately left alone — design, not breakage)

- Auth + settings + therapist stacks use platform-`default` transitions while content stacks slide — consistent within their families; deliberate modal language.
- InterestRails renders nothing while resolving — documented in-code tradeoff ("a brief absence below the fold beats an empty-titled header"); MostRead reserves space; PickUpRail renders synchronously from props.
- Heading a11y levels: `Text` visual variants (h1/h2/h3) carry no `accessibilityRole="header"`/`aria-level` app-wide; RN screen readers see plain text. A systemic future a11y improvement, not a per-screen defect.
- CrisisPill is unconditional in ToolScreen — that IS the SR-2 design; flagged-then-rejected suggestion to hide it.
- AppTabBar inactive ink `#6B6660` is off-token but plausibly a deliberate warm-neutral calibration on the warm light canvas; chrome color left untouched.
- Clarity history snapshots are view-only (no drill-in) — product choice, logged not fixed. Sleep home/dashboard share one empty-state string — copy-design choice.
- Article cards' 16:9 hero reservation, TTS stop-on-unmount, PEAF block graceful degradation, wizard auto-advance guard, PDF share `sharingRef` guard — all verified healthy.
- FindCareScreen is a 1054-line monolith — maintainability note only.

## DECISION_MADE_UNVERIFIED

- **S-MCS-01 / J-01 / J-02 guard semantics** — "reset only on failure" chosen as the conventional pattern (success paths navigate away/unmount). Traced in code; not device-verified.
- **F-10 confirmation placement** — inline menu notice (vs toast — the app has no toast system) chosen as most conventional native-to-system pattern.
- **S-MCS-02 KeyboardAvoidingView** — iOS `padding` / Android undefined per the app's own ToolScreen convention; Android relies on default adjustResize.

## RENDER_UNVERIFIED

No screenshot/render automation exists in this environment (one manual Maestro flow only). The following are code-traced + RNTL-verified for behavior but not visually rendered:

- All `numberOfLines`/clamp fixes (S-TOOL-01, S-BDG-01, S-TILE-01, E-01, E-04, I-01, I-02, F-06) — truncation behavior at real font scales unrendered.
- Dark-token fixes (C-01, SW2-01, SW2-04, SW2-05, SW2-06) — verified against the token contract, not rendered on-device in dark mode.
- S-MCS-02 keyboard geometry, A-01/A-02/I-03 return-key flows — real keyboard/IME behavior unverified.
- Both WebView screens (library, med-tracker) — always render-unverified beyond surface-component tests.

## RESIDUAL_RISK (cannot be verified without a physical device)

- **Real gesture feel:** double-tap race timing (the S-CHIP-01 analysis — see `UIUX_AUDIT_LOG.md` §2 — concluded the same-commit race is unreachable under React's discrete-event flushing; a physical double-tap test would close this definitively), spring/haptic feel, press-state latency.
- **Real keyboards/IMEs:** per-device keyboard avoidance, return-key labels, and taller scripts — including Bengali keyboards and Bengali text metrics in all clamped rows.
- **Notch/inset variations, real animation frame rates, OS font-scaling** beyond `maxFontSizeMultiplier=2`.
- **Pre-existing design debt catalogued by `/mobile-design-audit`** (all predating this branch, all in FindCareScreen): avatar hash palette + info amber off-token, 3 hardcoded shadow blocks (no shadow token family until Phase 6 calibration), non-token micro-durations (100/50/800ms).
- **Deliberately unfixed:** Text primitive (193 sites) untouched per risk policy — no defects found requiring it; Dobson-frozen clinical copy untouched (the one new string, `targetsSaved`, is on the non-clinical sleep-tools surface and routed through the CT4 copy layer).

## Commit range

`main..audit/uiux-repair` — 43+ commits: 29 `fix(uiux): <ID>` fix commits + `docs(uiux)` hunt-map/checkpoint/ledger commits. Every fix commit passed pre-commit SR-1..4 hooks + lint-staged; branch verified with the full suite (vitest 896 + jest 386), typecheck, and lint before this report.

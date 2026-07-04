# Clinical-review packet — Dr. Lena Dobson

**Purpose:** every user-facing surface that needs clinical sign-off before ship, in one list, prioritized by blocking status. Sacred Rule #2 (no diagnostic language) is load-bearing throughout — "people experiencing X often describe…", never "you have X".

**How to use:** review top-to-bottom. **Blockers** gate App Store submission / first ship. **Polish** can land in a fast-follow. Sign-off = a dated note (e.g. "ratified 2026-06-XX") per surface; do not invent the date.

**Status at compile:** copy is `CT4 FIXTURE` / `DRAFT → CT4` across the surfaces below — placeholder text pending this pass. The crisis helpline *data* (numbers, availability) is CT3-verified; only the *descriptions* are a copy gate.

---

## A. Blockers — gate first ship

| # | Surface | File(s) | What needs sign-off |
|---|---------|---------|---------------------|
| A1 | **Educational disclaimer** (store-compliance, App Store 1.4.1) | `apps/mobile/features/settings/copy.ts` → `about.disclaimerBody` | "Psychage is an educational resource. It does not diagnose, treat, or replace professional care…" — legal + clinical sign-off; the load-bearing health-claim statement. |
| A2 | **Crisis interstitial** (post-CRISIS Navigator halt) | `apps/mobile/features/crisis/*` | Grounding tone (not panic-inducing), Help-now clarity, zero diagnosis language, respects reduced-motion. SR-2 surface. |
| A3 | **Crisis helpline descriptions** | `apps/mobile/features/crisis/helplines.seed.ts` | 5-word factual lines ("National suicide and crisis line"); tone/accuracy/no-sensationalism. Numbers are CT3-verified; descriptions are the gate. |
| A4 | **Symptom Navigator KB** | `apps/mobile/features/navigator/kb.fixtures.ts` | Every symptom/condition name + description + severity tier + red-flag mapping. The one CRISIS-flagged symptom's wording + display gating. Currently placeholder — needs clinical authoring, not just review. (effort: large) |
| A5 | **Condition outlines** (Learn → Conditions hub) | `apps/mobile/features/conditions/data/condition-summaries.ts` | ~30–50 condition names/descriptions: person-first "pattern" framing (not diagnosis), educational-only, accurate prevalence, "when to seek care" guidance. (effort: large) |
| A6 | **Clarity Score copy** | `apps/mobile/features/clarity/*` (bands, interstitial, notes) | Band/tier labels (thriving/balanced/mixed/strained/reach-out); the ≥8 / q4≥2 crisis interstitial; "what stood out" notes (reframed from clinical flags); instrument names (PHQ-4/WHO-5/UCLA-3/PSS-4) must not claim diagnosis. |
| A7 | **Relationship Health copy** | `apps/mobile/features/relationship-health/copy.ts` (~50 strings) | Landing disclaimer ("not a diagnostic tool", "self-reflection"); the DV-hotline **safety interstitial** (tone + accuracy); results labels; legal/clinical disclaimer footer. |
| A8 | **Therapist-share PDF footer** (verbatim every page) | `apps/mobile/features/therapist/copy.ts` | "A personal check-in summary, shared from Psychage with your consent." + consent body ("No scores, no labels — just your own words"). No clinical vocabulary. |
| A9 | **Navigator clarifier prompts** | `apps/mobile/features/navigator/clarifiers.ts` (~15–20) | Severity/frequency/duration prompts: no leading language; CRISIS-flag prompts honest-not-sensational. |

## B. Feature gate (ship-blocking for that feature)

| # | Surface | File(s) | What needs sign-off |
|---|---------|---------|---------------------|
| B1 | **Mood Journal co-occurrence UI** | `apps/mobile/features/mood-journal/*` | Logic shipped + unit-tested; UI is gated pending review. Present the mood-trigger pattern mockup — verify no over-interpretation / diagnostic framing / missing grounding disclaimers. Unblock ship once approved. |

## C. Polish — fast-follow

| # | Surface | File(s) |
|---|---------|---------|
| C1 | Settings copy (11 screens) | `apps/mobile/features/settings/copy.ts` |
| C2 | Auth flow copy (~31 strings) | `apps/mobile/features/auth/copy.ts` — error lines must not leak account existence (generic "invalid credentials") |
| C3 | Learn / Find / Compass tab copy | `features/{learn,find,compass}/copy.ts` — educational, non-promotional framing |
| C4 | Supporter ("Keep Psychage Free") | `apps/mobile/features/supporter/copy.ts` — calm/honest, no guilt/"unlock" |
| C5 | WebView chrome + tool titles | `apps/mobile/features/webview/copy.ts` |
| C6 | Article reader chrome, offline/empty states | `features/content/copy.ts`, `features/offline/copy.ts` |
| C7 | Home hero + onboarding sequence | `apps/mobile/components/home/*` |
| C8 | Error/system messaging (SR-2/3) | scattered, ~20–30 — consolidate + audit for diagnostic/shame language |
| C9 | Article bodies (when authored) | `features/content/fixtures/ct1-articles.ts` (placeholder) — each real article reviewed before ship |

---

*Compiled from a read-only sweep of the mobile copy surfaces. File paths point at where each string lives. Counts are approximate where a surface bundles many strings.*


---

## C. Audit addendum — PR #191 (2026-07-03 production-readiness run)

New or changed user-facing copy introduced by the audit's fixes. Each was flagged `NEEDS_CLINICAL_REVIEW` in AUDIT_LOG.md. All strings are exact quotes from the code; person-first framing checked mechanically (SR-3 hook passed), but tone/accuracy is this review's call.

| # | Surface | File | Exact copy | Why it exists |
|---|---------|------|-----------|---------------|
| C1 | **Isolation safety modal** (relationship results — fires when ONLY the social-isolation alert triggers; DV keeps precedence) | `features/relationship-health/copy.ts` | Title: "Connection can grow again" · Body: "Some of your responses suggest you may be feeling disconnected from the people around you. Feeling this way is more common than it seems, and support is available." · Resource: "988 Suicide & Crisis Lifeline" / "Call or text 988 — free, 24/7, confidential" | PR-029: the shared modal previously showed the **DV hotline** as the first resource to lonely, no-partner users. Is 988 the right primary resource for the isolation-only case, and is the "suggest you may be feeling" framing acceptable? |
| C2 | **Empty relationship run notice** (every question skipped) | `features/relationship-health/RelationshipFlow.tsx` | "Nothing to reflect on yet" / "Every question was skipped, so there are no responses to summarize. You can try again whenever it feels right." | PR-020: skip-all runs previously produced a fabricated score; now they land here instead of results. |
| C3 | **Clarity Score Guide dimension list** | `features/clarity/components/tabs/ScoreGuideTab.tsx` | Now names: "Emotional, Overall Wellbeing, Social, Stress Load, Daily Functioning" | PR-036: previous copy named a nonexistent set ("…cognitive, physical…"). Factual correction to match the actual instrument dimensions — verify naming matches how you want dimensions described to users. |
| C4 | **Clarity dimension tool-links** (5 tier blocks) | `features/clarity/results-content.ts` | "Capture a Moment when a feeling shows up" · "Capture Moments to notice recurring thought patterns" · "Capture Moments to notice your social patterns" · "Capture Moments when stress spikes to see what drives it" · "Capture Moments to track how days are going" | PR-023: previous labels advertised a "Clarity Journal" tool that doesn't exist on mobile and linked to a 404. Relabeled to Moments (the real capture surface). |
| C5 | **Article next-step CTA** (depression-mood + emotional-regulation categories) | `features/content/related-tools.ts` | Label unchanged ("Notice what comes up"); sub-label "Mood Journal" → "Moments"; now routes to Today. | Same PR-023 rename. |
| C6 | **WebView gated surfaces** (Library, Library search, Med Tracker) | `features/webview/copy.ts` | "Not available here yet" / "This section is coming to the app soon. For now, you can find it on psychage.com." | PR-057: replaces a sign-in bounce loop. |
| C7 | **Sleep log validation error** (equal bed / out-of-bed times) | `features/sleep-architect/copy.ts` | "Getting into bed and out of bed show the same time — please set two different times." | PR-027: such entries previously became a phantom 24-hour night. |
| C8 | **Export/share failure alerts** (all PDF + record-export surfaces) | `features/therapist/pdf/printer.ts`, `app/settings/privacy.tsx` | "Couldn't create the PDF right now" / "Please try again in a moment." · "Couldn't export your record right now" | PR-025/067: failures were silent no-ops. |
| C9 | **Hotline fallback alerts** (devices with no phone/SMS handler, e.g. Wi-Fi iPads) | `features/relationship-health/components/SafetyAlert.tsx`, `features/clarity/components/open-action.ts` | "Calling isn't available on this device. From any phone: <number line>" / "Texting isn't available on this device. From any phone: <text line>" / "You can still reach it at <target> from another phone or device." | PR-026: crisis buttons previously did nothing on such devices. Safety-surface copy — priority review. |
| C10 | **MindMate status strip** | `features/mindmate/components/MindMateView.tsx` | "Online" ↔ "Offline" (was hardcoded "Online" even when disconnected) | PR-070: honesty fix on a mental-health chat surface. |
| C11 | **Legacy tool-link shim** (old /tool/* deep links, unknown id) | `app/tool/[id].tsx` | "Tool Not Found" / "This link doesn't match a tool in this version of the app. You can find every tool on the Compass tab." | PR-008: replaces the placeholder screen. |
| C12 | **Account-migration screen** (deep-link-only surface) | `app/(auth)/migrate.tsx` | Intro + explicit "Start" button (CT4-marked inline placeholder) | PR-058: migration previously auto-ran on a bare deep link with no consent step or exit. |
| C13 | **Therapist PDF meta row** | `features/therapist/pdf/build-html.ts` | "Prepared for: <provider name · contact>" | PR-090: wires the S39 add-provider form's collected data into the export it was collected for. |

**Also for the SR-12 pass (behavior, not copy):** crisis screen exits are now cold-start-safe (`goBackOr`), the Find tab's crisis "Help" pill navigates to the standalone /crisis route instead of an in-screen sheet, and Navigator/MindMate crisis surfaces now resolve region via expo-localization (same chain as /crisis). Diffs in PR #191, commits bae3730 / 7e980f9 / c134a81.

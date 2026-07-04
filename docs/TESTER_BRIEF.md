# Psychage Mobile — Tester Brief (first feedback round)

Audience: internal testers on the first feedback round. Build: EAS `preview` profile off `main` @ 59e26e5 (post UI/UX audit, PR #193). Android APK via internal distribution link; iOS pending credential setup.

## What this app is

Psychage is a mental-health **education** platform — the "what is this thing I'm experiencing" layer before crisis care or therapy. It does not diagnose, treat, or replace care. Please judge it against that framing: calm, educational, person-first.

## Install

- **Android:** open the EAS build link on the device, download the APK, allow install-from-browser when prompted. Installs over a previous preview build with no data loss.
- **iOS:** not yet available — TestFlight/ad-hoc setup pending.

## Known-inert items — please DON'T file these

1. **No reminders / push notifications.** The reminders screen saves settings but nothing fires — push is deliberately deferred. Feedback on the *screens* is welcome; "reminder never arrived" is expected.
2. **Nothing syncs between devices / to the cloud.** Moments and tool data are on-device by design for this round. The sync consent toggle exists but the pipe is dormant.
3. **Sign-up email may not arrive.** A server-side email issue is being fixed in parallel. If sign-up wedges on "verify your email," use the app anonymously (everything works without an account) and note the date/time so we can correlate.
4. **Therapist link doesn't persist server-side.** You can add a provider and share a session-prep PDF; the saved link may not survive reinstall.
5. **English only** in this round.
6. **Copy is not final** on some clinical surfaces — wording is under clinical review. Tone impressions welcome; typo-level copy nits will likely be overtaken.

## Where feedback helps most

- **First run:** welcome → onboarding → first moment capture. Anything confusing, jumpy, or slow?
- **Daily loop:** capturing a Moment (from Today and from Compass), reading the reflection, browsing Learn articles, saving/unsaving.
- **Assessments:** Clarity Score end-to-end; Symptom Navigator end-to-end. Did any step feel abrupt, unclear, or alarming in tone?
- **Find care:** search with filters, provider detail, compare. Real-world data is messy — screenshots of any broken-looking provider card are gold.
- **Dark mode + large text:** if you use dark mode or enlarged system text, everything you see is high-value — screenshot anything clipped, invisible, or overlapping.
- **Keyboard:** any screen where the keyboard covers what you're typing.
- **Crisis affordance:** the "Help now" pill should be visible or one tap away on every screen. If you ever can't find it, that's a top-priority report.

## How to report

For each issue: screen name (or screenshot), what you did, what you expected, what happened. Device model + OS version once per batch. Screenshots > descriptions, screen recordings > screenshots.

## Safety note

This is a mental-health app being tested, not a source of care. If anything in the app is useful to you personally, good — but for real support, the in-app crisis resources (Help now) list real, staffed lines.

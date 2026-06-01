# Release checklist (~15 min)

Run before tagging a release or running `push-updates.bat`.

## Prep

- [ ] Bump `version.json` (`app`, and `cache` if JS/CSS changed)
- [ ] Run `node scripts/sync-version.mjs` (updates `index.html` `?v=` tokens)
- [ ] Confirm `js/core/version.js` matches `version.json`

## Auth & boot

- [ ] Sign out → login screen shows
- [ ] Google sign-in completes without console errors
- [ ] Email sign-in works (or skip if disabled)
- [ ] First-run rank setup modal appears for a fresh account; saving persists after refresh
- [ ] Sign-out clears dock and returns to login

## Rocket League

- [ ] Switch to RL — dashboard, charts, and dock show RL copy
- [ ] Manual log from dock saves and appears in match log
- [ ] Edit match → change End MMR → **Save Changes** persists
- [ ] Session start/end and post-match card behave normally

## Valorant

- [ ] Switch to Val — Competitive queue shows RR fields (not Swiftplay)
- [ ] Manual log saves K/D/A and RR
- [ ] Edit match saves correctly

## Auto-log (optional, gaming PC)

- [ ] `start-grind.bat` or **Twans Auto-Log** starts without `SyntaxError` in bridge
- [ ] RL match end triggers auto-log + post-match card
- [ ] Val auto-log works with Henrik key configured (or skip if no key)

## Deploy

- [ ] Run `push-updates.bat` (or copy + commit manually)
- [ ] GitHub Pages live URL loads after hard refresh
- [ ] Friend with old ZIP knows to re-download only if they use auto-log

## Database (new Supabase projects only)

- [ ] `docs/supabase/v1-full-setup.sql` runs without errors
- [ ] Squads page loads (no infinite recursion policy error)

# V1.0 Verification Log

**Sprint date:** 2026-06-03  
**Version under test:** `1.0.0-rc1`  
**Mode:** Stabilization — verify fixes already implemented; no new code in this sprint  
**Tester:** _Product Owner (fill Actual Result)_  
**Environment:** _localhost:8080 / GitHub Pages / bridge running Y/N_

---

## Static pre-check (agent, not a substitute for manual test)

| Fix | File | Code present? |
|-----|------|:-------------:|
| Val auto-log `priorEnd` → `priorState.hasPrior` | `js/auto-log-handlers.js:158` | Yes |
| Edit Save button `finally` reset | `js/app.js:858` | Yes |
| `clearSessionTimer()` on sign-out | `js/app.js:266`, `js/sessions.js:88-95` | Yes |
| Val live listener removal | `js/valorant-live.js:163-167` | Yes |
| Long-note scroll wrap | `css/styles.css` `.log-table-cell-notes` | Yes |

**All sprint sections below remain NOT TESTED until Product Owner runs them.**

---

## 1. Val auto-log retest

**Status:** NOT TESTED

**Reproduction steps:**
1. Run `Valorant Tracker.bat`; open `http://localhost:8080`; sign in.
2. Complete setup: Riot ID + Henrik API key applied via bridge (setup wizard → Apply & Go).
3. Confirm bridge status online and auto-log enabled on dock.
4. Play and finish one Valorant **Competitive** match.
5. Wait 1–3 minutes after scoreboard (Henrik lag).
6. Open DevTools → Console; filter for `ReferenceError` or `priorEnd`.
7. Confirm match appears in Match Logs with K/D/A and RR; note includes `id:` if Henrik match id present.

**Expected result:**
- Match auto-logged once; toast shows win/loss + K/D/A.
- No repeating `ReferenceError: priorEnd is not defined` every ~5s.
- Bridge consume called; same match not re-logged on next poll.

**Actual result:** _[ PO fills ]_

**Notes:**
- Prior blocker: undeclared `priorEnd` in `handleValorantAutoLog` (fixed in dev tree).
- If fail: check `valorant-live.js` outer catch swallowing errors (L-1 in RELEASE-RISKS).

---

## 2. Sign-out / sign-in cycle

**Status:** NOT TESTED

**Reproduction steps:**
1. Sign in; switch to Valorant; ensure bridge polling active (tab focused once).
2. Open DevTools → Console; run: `getEventListeners(document).visibilitychange?.length` (Chrome) or note poll frequency.
3. Sign out (profile → Sign out).
4. Sign in again **without** hard refresh.
5. Repeat steps 2–4 for **3 cycles**.
6. Focus/blur browser tab; count how many simultaneous `/valorant/last-match` requests fire (Network tab).

**Expected result:**
- After each re-login, exactly one visibility listener and one poll interval (no doubling).
- No runaway parallel polls after 3 cycles.

**Actual result:** _[ PO fills ]_

**Notes:**
- Fix: named handlers removed in `stopValorantLive()` (`valorant-live.js`).
- `stopBridgeServices` resets `bridgeServicesStarted`; re-init must not stack listeners.

---

## 3. Session timer cleanup

**Status:** NOT TESTED

**Reproduction steps:**
1. Sign in; start a grind block / session from dock.
2. Confirm live timer counting in session bar.
3. Sign out while session is **active** (do not end session first).
4. DevTools → Console: run `setInterval` leak check or leave tab open 60s watching for unexpected timer ticks / DOM updates in hidden session elements.
5. Sign in again; confirm fresh session state (not stale timer).

**Expected result:**
- No orphaned 1s interval after sign-out.
- New login shows inactive session until user starts again.

**Actual result:** _[ PO fills ]_

**Notes:**
- Fix: `clearSessionTimer()` called in `handleSignOut` before `resetAppState()`.

---

## 4. Edit modal save flow

**Status:** NOT TESTED

**Reproduction steps:**
1. Sign in; log one RL and one Val match.
2. Match Logs → Edit (✏️) on Val row → change end RR → **Save Changes** → confirm persists after refresh.
3. Open edit modal again → **Cancel** — button state normal.
4. _(Edge case)_ Open edit modal → DevTools → Application → simulate expired session OR sign out in another tab while modal open → click **Save Changes**.

**Expected result:**
- Normal save: modal closes, row updates, sync live.
- Edge case: Save fails gracefully; button returns to **Save Changes** (enabled), not stuck on **Saving…**.

**Actual result:** _[ PO fills ]_

**Notes:**
- Fix: `handleSaveEdit` uses `finally { btn.disabled = false; btn.textContent = 'Save Changes' }`.

---

## 5. Fresh account onboarding

**Status:** NOT TESTED

**Reproduction steps:**
1. Use incognito or new email account.
2. Sign up (email or Google).
3. Complete first-run rank setup (RL MMR baselines and/or Val rank baselines as prompted).
4. Log first manual match from dock (RL and/or Val).
5. Refresh — data persists; sync dot live.
6. Skim setup wizard dismiss / “Apply & Go” for Val if using bridge.

**Expected result:**
- No boot failure toast; dashboard loads.
- Rank setup modal completes; first log saves to Supabase.
- No silent settings reset (goals/riot ID blank without user action).

**Actual result:** _[ PO fills ]_

**Notes:**
- Cross-ref `docs/RELEASE-CHECKLIST.md` Authentication + first-run sections.
- Warning: `loadSettings()` silent catch — watch for default goals after slow load.

---

## 6. Friend install test

**Status:** NOT TESTED

**Reproduction steps:**
1. Friend downloads/clones app (ZIP or GitHub Pages + local bat files as documented in `docs/SETUP.md`).
2. Fresh account sign-up.
3. RL: rank setup → manual log → edit → delete.
4. Val (if applicable): manual log only on GitHub Pages; full auto-log only if friend runs local bridge.
5. Optional: join Product Owner’s squad via invite code.

**Expected result:**
- Friend completes onboarding without blockers.
- Core CRUD works on fresh account.
- Squad join works if Supabase RPC schema applied.

**Actual result:** _[ PO fills ]_

**Notes:**
- Friend column in `docs/RELEASE-CHECKLIST.md` is authoritative extended matrix.
- Squads Val weekly snapshot may show 0 RR gain (known warning — see V1-ACCEPTED-RISKS).

---

## Failure template (use if any section → FAIL)

_Copy block below into Notes or new subsection._

```
Severity: Critical | High | Medium | Low
Release Blocker: Yes | No
Likely Cause:
Files Involved:
Verification Steps (to confirm fix):
Proposed Fix (do not implement until approved):
```

---

## Sprint summary

| Section | Status |
|---------|--------|
| Val auto-log retest | NOT TESTED |
| Sign-out / sign-in cycle | NOT TESTED |
| Session timer cleanup | NOT TESTED |
| Edit modal save flow | NOT TESTED |
| Fresh account onboarding | NOT TESTED |
| Friend install test | NOT TESTED |

**Sections passed:** 0 / 6  
**Sections failed:** 0 / 6  
**Sections not tested:** 6 / 6

---

## Sign-off

| Role | Name | Date | All sprint sections PASS? |
|------|------|------|:-------------------------:|
| Product Owner | | | ☐ |

_When all six sections are PASS and `docs/V1-ACCEPTED-RISKS.md` is signed, proceed to version bump + tag._

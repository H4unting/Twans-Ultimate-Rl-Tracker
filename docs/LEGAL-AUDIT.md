# Legal & Compliance Baseline Audit

**Product:** Twans Ultimate Tracker  
**Audit date:** June 7, 2026 (updated after contact + deletion flow)  
**Scope:** Indie SaaS legal baseline for public beta (not legal advice; no compliance certifications claimed)

---

## Summary

Baseline legal pages, footer links, avatar disclosures, real contact info, and in-app account deletion are in place. **Run `docs/supabase/delete-own-account.sql` in Supabase** before deletion works in production. Rank icons remain hotlinked from Fandom wikis — still a material IP risk before commercial launch.

| Deliverable | Status |
|-------------|--------|
| `legal/privacy.html` | Done — contact + deletion updated |
| `legal/terms.html` | Done — operator + governing law updated |
| `legal/disclaimer.html` | Done |
| Footer links (login + app shell) | Done |
| Profile avatar policy notice | Done |
| In-app account deletion | Done — requires SQL migration |
| `js/core/app-config.js` → `LEGAL_CONTACT` | Done |
| `css/legal.css` | Done |
| This audit document | Done |

**Contact (canonical):** `anthonyinf354332@gmail.com` — operator Anthony, independent developer.  
**Site:** https://h4unting.github.io/Twans-Ultimate-Rl-Tracker/

---

## Documents created

### Privacy Policy (`legal/privacy.html`)

Covers: data collected, Supabase storage, Google + email auth, user rights, in-app + email deletion requests, contact email, children, security, international transfers, no sale of personal data, optional local auto-log.

### Terms of Service (`legal/terms.html`)

Covers: acceptable use, account responsibility, user content license, squads, third-party services, as-is disclaimer, limitation of liability, indemnity, termination, US governing law, contact email.

### Disclaimer (`legal/disclaimer.html`)

Covers: independent project, no affiliation with Riot Games / Psyonix / Epic Games, trademark notice, wiki/CDN rank assets, no official API, not professional advice.

### In-app integration

- **Login screen** — links to all three pages; “By signing in, you agree…” notice.
- **App footer** — links on every authenticated view inside `#app-shell`.
- **Profile editor** — upload and URL hints linking to Privacy Policy.
- **Profile → Delete account** — type `DELETE`, confirm dialog, calls `deleteOwnAccount()` (`js/supabase.js`).

### Server requirement for deletion

Run once in Supabase SQL Editor:

```
docs/supabase/delete-own-account.sql
```

Creates `delete_own_account()` RPC (SECURITY DEFINER): leaves squads, deletes matches/settings/profile, removes auth user, clears `groups.created_by`.

---

## Profile / avatar upload audit

**Implementation:** `js/supabase.js` → `uploadProfileAvatar()`

| Control | Finding |
|---------|---------|
| Auth required | Upload requires signed-in user |
| MIME types | Client checks `image/*`; bucket allows jpeg, png, webp, gif (2 MB) |
| Storage path | `{user.id}/avatar.{ext}` — per-user folder |
| RLS | Own-folder upload/update/delete; public read on bucket (avatars visible to others in UI) |
| Fallback | Inline compressed data URL if bucket missing |
| XSS | `sanitizeImageUrl()` limits display to http(s) and `data:image/` (`js/core/dom-safe.js`) |
| Policy alignment | Terms §4 prohibits uploading content without rights; Privacy §5 describes storage; UI notice added |
| Deletion | Avatars best-effort deleted from Storage before account RPC |

**Gaps (non-blocking for beta):**

- No server-side image moderation or DMCA takedown workflow.
- Public-read avatar bucket — URLs fetchable if path is known; mitigated by UUID paths.
- External avatar URLs are user-supplied; no hotlinking enforcement beyond URL scheme check.

**Verdict:** Aligned with stated policies for indie beta.

---

## Account deletion audit

| Control | Finding |
|---------|---------|
| UI | Profile danger zone; must type `DELETE` + browser confirm |
| Client | `deleteOwnAccount()` → avatar cleanup + `rpc/delete_own_account` |
| Server | SQL migration required; graceful error if RPC missing |
| Post-delete | Local session cleared, app state reset, login screen shown |
| Email fallback | Privacy §10 still documents email request path |

**Gaps before commercial launch:**

- No data **export** flow (download my data) — common GDPR/CCPA expectation.
- No documented deletion SLA in Privacy Policy (e.g. 30 days for email requests).
- Backups / Supabase logs may retain data for provider retention periods — disclose if counsel advises.

---

## Copyright & asset audit

### Rank icons (HIGH attention for commercial use)

- **Rocket League:** `js/games/rocketleague/ranks.js` — PNGs from Fandom CDN
- **Valorant:** `js/games/valorant/ranks.js` — PNGs from Fandom CDN
- **Risk:** Trademark/copyright exposure; CDN dependency; not eliminated by Disclaimer

### Bundled / local assets

| Asset | Location | Notes |
|-------|----------|-------|
| App icons | `public/icon.svg`, `public/placeholder*.svg` | Generic placeholders |
| Setup screenshot | `assets/setup/profile-name-example.png` | **Missing** — broken ref in setup wizard |
| Rank PNGs in repo | Removed | Good — not redistributing in git |

---

## Remaining legal risks

| Risk | Severity | Notes |
|------|----------|-------|
| Personal Gmail as sole legal contact | **Medium** | OK for indie beta; use domain mail + entity name before scale |
| US governing law only (no specific state) | **Low–Medium** | Terms §14 updated; counsel may want home state + courts |
| Wiki hotlinked rank icons | **Medium–High** | Before commercial launch |
| No cookie/consent banner | **Medium** | If EU/UK users — auth storage + CDN scripts |
| No data export | **Medium** | Before commercial launch / EU scale |
| `delete-own-account.sql` not run in prod | **High (ops)** | In-app delete fails until migration applied |
| Public avatar bucket | **Low–Medium** | Documented in Privacy |
| Game publisher ToS | **Low–Medium** | Users responsible; we disclaim affiliation |

---

## Recommended actions before public beta

1. **Run `docs/supabase/delete-own-account.sql`** in Supabase and test Profile → Delete account on a throwaway account.
2. **Verify legal footers** on GitHub Pages after deploy (hard refresh).
3. **Monitor** `anthonyinf354332@gmail.com` for deletion / privacy requests.
4. **Optional:** add deletion SLA to Privacy §10 (e.g. email requests within 30 days).
5. **Fix or remove** broken setup screenshot reference.
6. **Review Supabase region / DPA** if expecting EU users.

---

## Recommended actions before commercial launch

1. **Custom domain + role-based emails** (`privacy@`, `support@`, `legal@`) and update `LEGAL_CONTACT` + legal HTML.
2. **Replace wiki rank icons** with licensed or original assets.
3. **Data export** — in-app “Download my data” (JSON).
4. **DMCA / abuse process** for user avatars and squad content.
5. **Cookie consent** if adding analytics or non-essential trackers.
6. **Payment terms** if monetizing.
7. **Professional legal review** for your jurisdiction and user base.
8. **Subprocessor appendix** in Privacy Policy.

---

## Verification checklist

- [ ] Legal pages load at `/legal/*.html` on production URL
- [ ] Login + app footers show Privacy / Terms / Disclaimer
- [ ] Profile avatar hints visible in Edit profile
- [ ] `delete-own-account.sql` applied in Supabase
- [ ] Test account deletion end-to-end on staging
- [ ] Legal review by qualified counsel (recommended)

---

## Disclaimer

This audit was prepared for internal product planning. It is **not legal advice**, does **not** certify compliance with GDPR, CCPA, COPPA, or any other regime, and does **not** guarantee fitness for public beta or commercial launch. Consult qualified legal counsel before shipping to production users.

# Plan: Site-wide UX Fixes + Pricing Page Polish

Six related fixes across the whole site. All scoped, no visual redesign.

---

## 1. No horizontal scroll on any page (mobile-first)

**Goal:** every page fits within the viewport width — no left/right scroll, ever.

**Approach (global, one place to fix all pages):**
- In `src/index.css`, add a global guard:
  ```css
  html, body, #root { overflow-x: hidden; max-width: 100vw; }
  img, video, svg { max-width: 100%; height: auto; }
  ```
- In `src/pages/PricingPage.tsx`, the root `<div className="min-h-screen ...">` gets `overflow-x-hidden w-full`, and the hero `<h2>` adjusts `clamp()` minimum so it never exceeds 360px viewport (reduce min from `2.25rem` to `1.85rem`, and add `break-words` / `px-2`).
- Audit known wide offenders by searching for `whitespace-nowrap`, fixed pixel widths, and marquees outside `overflow-hidden` containers — wrap any found culprits.

This is one CSS rule + a couple of targeted tweaks; it solves the issue globally without touching every page.

---

## 2. Back button returns to previous page (not home)

**Current state:** Most pages already use `navigate(-1)` (e.g. `PricingPage`, `DeleteAccountPage`). A few use hard-coded routes like `/settings/profile`.

**Approach:** Standardize back behavior — replace hard-coded back navigations with `navigate(-1)` with a safe fallback when there's no history (e.g. user landed via deep link):
```ts
const goBack = () => {
  if (window.history.length > 1) navigate(-1);
  else navigate("/"); // or contextual fallback
};
```
Apply to back buttons in: `DeleteAccountPage`, `ChangeEmailPage`, `ChangePasswordPage`, `ResetPasswordPage`, `BillingPage`, `BillingSuccessPage`, `WithdrawPage`, `NotificationsPage`, `NotificationSettingsPage`, `LanguagePage`, `IntegrationsPage`, settings sub-pages, and any tool page that hardcodes a parent route.

(Hub-return constraint from memory still applies for tool back buttons — for those pages, fallback stays `/images`, `/videos`, etc.)

---

## 3. Pages always open scrolled to the top

**Approach:** Add a `ScrollToTop` component mounted once inside `<BrowserRouter>` in `src/App.tsx`:
```tsx
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
```
Render `<ScrollToTop />` right after `<BrowserRouter>` opens. Single fix, applies to every route.

---

## 4. Page refresh stays on the current page (not redirected home)

**Investigation finding:** `BrowserRouter` already preserves the URL on refresh. The reported issue happens because:
- `LandingPage` (route `/`) auto-redirects authenticated users to `/chat` — fine.
- But some routes may redirect during loading flicker. The real concern: the user sees the landing page briefly because the `LazyFallback` is plain background while auth is checked.

**Approach:** No router change needed (Lovable hosting already has SPA fallback per docs). Verify by:
- Confirming `BrowserRouter` is used (it is, line 6 of App.tsx).
- Ensuring `ProtectedRoute` does not `Navigate` to `/` — it currently navigates to `/auth` for unauthenticated users, which is correct.
- Any page that currently does `navigate("/")` on mount/error gets reviewed and removed if unjustified.

If a specific page is found redirecting home on refresh, fix it in place. Currently no such offender is identified — the perceived behavior likely comes from the auth redirect on `/`. No code change unless we find a real culprit during implementation.

---

## 5. Pricing page background follows the theme

**Current state:** `PricingPage` is hard-coded to `bg-white text-neutral-900` (always light), regardless of the user's theme.

**Approach:**
- Replace `bg-white text-neutral-900` on the root `<div>` with `bg-background text-foreground`.
- Replace footer `bg-white border-neutral-200` with `bg-background border-border`.
- Replace `text-neutral-*` classes used for chrome (top bar, footer) with `text-muted-foreground` / `text-foreground` so they adapt.
- The colored plan cards (green/blue/purple/amber) and the Enterprise dark card stay as-is — those are intentional brand surfaces.
- Hero heading: keep gradient text, but base color uses `text-foreground` instead of `text-neutral-900`.

Result: light theme looks the same; dark/ocean/sunset themes get a matching background instead of jarring white.

---

## 6. "Start Your Empire Now" button signs the user out

**Root cause:** Line 564 of `PricingPage.tsx` — the button calls `navigate("/auth")` unconditionally. The `/auth` page on mount likely calls `supabase.auth.signOut()` for guests or has a side effect that clears the session for already-logged-in users.

**Fix:** Make the CTA context-aware:
```ts
const handleStart = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  navigate(session ? "/chat" : "/auth?redirect=/chat");
};
```
- Logged-in users go straight to `/chat` (no sign-out, no auth page).
- Guests go to `/auth` with redirect back to `/chat` after login.

Also briefly audit `AuthPage` to confirm whether it indeed signs users out on mount; if so, gate that behavior so it only runs when explicitly requested (e.g. `?logout=1`), not on every visit.

---

## Files to edit

- `src/index.css` — global `overflow-x` guard
- `src/App.tsx` — add `<ScrollToTop />` inside `<BrowserRouter>`
- `src/pages/PricingPage.tsx` — theme-aware background, fix Start Empire CTA, mobile clamp tweak
- `src/pages/AuthPage.tsx` — audit and conditionally gate any auto sign-out on mount
- Back-button standardization across ~10 settings/tool pages (small `navigate(-1)` swap with fallback)

## Out of scope

- Redesign of any page
- Changing colored plan cards or Enterprise card surfaces
- Touching tool back-button hub fallback rule (kept per memory)

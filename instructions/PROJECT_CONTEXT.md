# Hostel Expense Tracker — Project Context & Agent Instructions

Use this document as the source of truth for future work on this project. Do not ask the user to re-explain context that is already covered here unless something is missing or ambiguous.

---

## 1. Project goal

Build a **hostel expense tracker** web app so the hostel can:

- Track money collected from residents
- Track money spent on shared services and repairs
- Know **what is left (current balance)**
- Keep **monthly history** of payments and expenses
- See simple **statistics / dashboard** overview

This is a practical internal tool for a hostel, not a multi-tenant SaaS product (unless later requested).

---

## 2. Business rules (domain)

### Residents
- Hostel members/residents pay a **monthly service fee**.
- The fee is **dynamic per resident** (not a single global hardcoded amount).
- A default suggestion of **250 EGP** may be used as the initial form default when creating a resident, but each resident stores their own `monthlyFee`.
- Residents can be **active** or **inactive**.
- Active residents are included in monthly payment tracking for open/current months.
- **Inactive residents must not be counted** in paid / unpaid counts, unpaid lists, or the payments page tracking list. Their historical payment rows may still exist for all-time collected/balance, but they are excluded from month tracking UI and stats.
- Residents support: **add, edit, remove, activate/deactivate, list/filter**.

### Monthly payments
- Tracking is **per month** (e.g. `2026-07`).
- A **new month is created automatically** when needed (especially the current month).
- Users can also create/open a specific month manually.
- For each active resident in a month, there is a payment record with:
  - **paid / unpaid** status
  - **payment amount** (editable; seeded from resident monthly fee)
  - **payment date** (`paidAt`, set when marked paid)
  - optional notes
- When a resident’s monthly fee changes, **unpaid** payment amounts should stay in sync with the new fee.
- When a new active resident is added, seed payment rows for the current month (and already-created current/future months).

### Expenses
Every expense record must include:
- **title**
- **category** — built-in presets (Electricity, Water, Gas, Internet, Repairs, Cleaning, Supplies, Other) **plus user-defined categories** added while creating/editing an expense. Built-ins stored as English keys and shown via `categories.*` i18n; custom labels display as entered. Persisted in `AppData.customCategories`.
- **amount**
- **date**
- **description**
- **added by**
- **paid** (boolean) — whether the expense has actually been paid yet

**Paid vs unpaid expenses:**
- Expenses can be recorded before they are paid (e.g. a bill still outstanding).
- **Only paid expenses** reduce **balance left**.
- Unpaid expenses are still listed and summed for visibility, but do **not** subtract from balance.
- Users can toggle paid/unpaid from the expenses list or set status when adding/editing.
- Existing data without a `paid` field is treated as **paid** (migration default) so historical balance stays the same.

### Balance & dashboard
- **Collected** = sum of payment amounts marked paid
- **Paid expenses** = sum of expense amounts where `paid === true`
- **Unpaid expenses** = sum of expense amounts where `paid === false` (tracked only; not in balance)
- **Current balance** = total collected (all paid payments) − total **paid** expenses (all time)
- Dashboard (home page) should show at least:
  - Paid count (current month) — **active residents only**
  - Not paid count (current month) — **active residents only**
  - Collected (current month) — from active residents’ paid payments for that month
  - Paid expenses (current month) — with unpaid month total noted when &gt; 0
  - Current balance (overall) — collected − paid expenses only
  - Unpaid expenses total (all-time) when &gt; 0
  - Unpaid list — **active residents only**
- Dashboard is the **home page** (`/`).
- **Statistics** page (`/statistics`) holds Phase 3 charts + balance timeline (not on Dashboard). Link from nav + Dashboard “Statistics” CTA.

### Currency
- Primary currency is **EGP** (Egyptian Pound).

---

## 3. Tech stack & architecture decisions

| Decision | Choice | Notes |
|----------|--------|--------|
| Framework | **Angular 22** | Standalone components, signals |
| Styling | **Tailwind CSS 4** | Via `@import 'tailwindcss'` + PostCSS plugin |
| Forms | `@angular/forms` | Reactive forms for residents/expenses; template forms for quick payment edits |
| Modals / confirmations | **SweetAlert2** | Destructive confirms only (not success feedback) |
| Success / action toasts | **Custom ToastService** | Soft-ledger corner toasts (no third-party toast lib); one sentence per toast |
| Routing | `@angular/router` | SPA client routes |
| Rendering | **SPA only (no SSR)** | SSR was removed intentionally |
| Persistence | **Spring Boot + JPA/Hibernate + SQLite** | One JDBC driver (SQLite). Switch DB later by adding that driver and changing properties. Backend: `F:\grok\hostel-expense-tracker-BE`. |
| Auth | JWT + roles `USER` / `ADMIN` | Viewer sees all data; admin can create/edit/delete |
| State | **HostelStore** service + Angular signals | Loaded from `GET /api/bootstrap`; mutations go through HTTP |
| i18n | **@jsverse/transloco** (runtime) | EN + AR; runtime language switch; RTL for Arabic |
| Charts / statistics | **ApexCharts** via `ng-apexcharts` | Phase 3 **Statistics** page (`/statistics`) |
| Tests | Vitest (`ng test`) | |
| Package manager | npm | |

### Charts (ApexCharts) notes
- Packages: `apexcharts`, `ng-apexcharts` (standalone `ChartComponent` / `<apx-chart>`).
- Allowed as CommonJS in `angular.json` → `allowedCommonJsDependencies: ["sweetalert2", "apexcharts"]`.
- Dynamic import of `apexcharts/client` (no `scripts[]` entry required for modern Angular builds).
- **Route:** `/statistics` lazy-loaded via `loadComponent` so ApexCharts is not in the initial Dashboard bundle.
- Charts remount via `@for (mount of [chartMountKey()]; track mount)` so theme/lang/data changes rebuild the chart.
- Store aggregations: `getMonthlyChartSeries`, `getCategoryBreakdown`, `getBalanceTimeline`.
- UI copy under `statistics.*` (EN/AR); nav key `nav.statistics`.

### SweetAlert2 notes
- Package: `sweetalert2` (listed in `package.json`).
- Global CSS imported in `src/styles.css` via `@import 'sweetalert2/dist/sweetalert2.min.css'`.
- Allowed as CommonJS in `angular.json` (with ApexCharts): `allowedCommonJsDependencies: ["sweetalert2", "apexcharts"]`.
- Shared helpers: `src/app/core/utils/swal-dialog.ts`
  - `confirmDelete({ title, text?, html?, confirmButtonText?, cancelButtonText? })` → `Promise<boolean>`
- **Used for all destructive confirms:** delete month (Payments), remove resident (Residents), delete expense (Expenses).
- Dialog copy is translated via Transloco at call sites (pass already-translated strings).
- Do **not** use native `alert` / `confirm` / `prompt` in the app.
- Do **not** use SweetAlert2 for success feedback — use app `ToastService` instead.

### Toast notifications (custom) notes
- **No third-party toast library.** In-house stack:
  - `src/app/core/services/toast.service.ts` — signal queue, auto-dismiss (~2.8s), max 4, prevent exact duplicates
  - `src/app/shared/toast/toast-host.*` — host UI; mount once as `<app-toast-host />` in `app.html`
- API: `success(message)` / `info(message)` / `error(message)` — **single sentence only** (no title + body).
- Design matches the soft-ledger UI: rounded-2xl cards, brand/teal accents, emerald success / rose error, dark mode, RTL-aware corner (`ms-auto`), progress bar, dismiss control.
- **Show success toasts after:**
  - Residents: create, update, remove, activate, deactivate
  - Expenses: create, update, remove, mark paid, mark unpaid
  - Payments: create/open month, delete month, mark paid, mark unpaid
- **Do not toast** on every keystroke for inline payment amount/notes/date edits.
- Toast copy is translated via Transloco at call sites (`*Toast` keys).

### Localization (i18n) notes
- Library: **`@jsverse/transloco`** (runtime dictionaries, not Angular compile-time `@angular/localize`).
- Translation files: `public/i18n/en.json`, `public/i18n/ar.json` (served as `/i18n/*.json`).
- Loader: `src/app/core/i18n/transloco-loader.ts` (HttpClient → `./i18n/{lang}.json`).
- Language service: `src/app/core/i18n/language.service.ts`
  - Preference key: `hostel-expense-tracker-lang` in `localStorage`
  - Default: stored preference → browser `ar` → else `en`
  - Sets `document.documentElement.lang` / `dir` (`rtl` for Arabic, `ltr` for English)
  - Updates `document.title` from `app.documentTitle`
  - Helpers: `formatMonthLabel` / `formatMonthId` / `categoryLabel`
- Providers in `app.config.ts`: `provideHttpClient()`, `provideTransloco(...)`, app initializer loads active lang before first paint.
- UI strings use `TranslocoPipe` (`{{ 'key' | transloco }}`); TS strings use `TranslocoService.translate(...)`.
- **Do not translate user data** (resident names, expense titles/descriptions, payment notes, added-by free text).
- **Stored English keys stay English** in localStorage:
  - Expense categories: stored as English (`Electricity`, …); display via `categories.*` keys.
  - Month records keep English `label` for storage compatibility; **UI always formats labels** from `year`/`month` or `monthId` via `LanguageService`.
- Language toggle sits at the **end of the navbar** (after desktop nav links; before mobile burger). Label is short: **`ع`** when UI is English (switch to Arabic), **`EN`** when UI is Arabic (switch to English).
- Arabic copy uses **Egyptian dialect** (`public/i18n/ar.json`), not formal MSA.
- Prefer logical CSS where possible (`ms-*`, `text-start`, `text-end`) for RTL.

### Why SPA (no SSR)
- SSR/prerender complicates hydration and browser-only APIs.
- This is a private hostel tool; SEO/SSR is not needed.

### ⚠️ CRITICAL: Always work on the main repo — never the Grok worktree

**Canonical project path (user’s real IDE / `ng serve` folder):**

**`F:\grok\hostel-expense-tracker`**

Grok may open or create a **worktree copy** under something like:

`C:\Users\Qubit\.grok\worktrees\grok-hostel-expense-tracker\...`

That worktree is **not** where the user runs the app or edits in their IDE. Editing only the worktree makes changes **invisible** to the user (this has already caused real confusion).

**Mandatory rules for every agent:**

1. **Always apply code, style, and instruction changes directly in `F:\grok\hostel-expense-tracker`.**
2. **Do not treat the Grok worktree as the source of truth**, even if the session workspace path points there.
3. At the start of work, **verify you are writing under `F:\grok\hostel-expense-tracker`** (absolute paths preferred for edits).
4. If a Grok session workspace is a worktree, **still edit the main repo** — copy or write files there so `npm start` / the IDE pick them up immediately.
5. Only use another path if the user **explicitly** asks to work there.

---

## 4. How to run

```bash
cd F:\grok\hostel-expense-tracker-BE
mvn spring-boot:run   # API → http://localhost:8080

cd F:\grok\hostel-expense-tracker
npm install   # if needed
npm start     # ng serve + /api proxy → http://localhost:4200/
npm run build
npm test
```

Seeded users: `admin` / `admin123` (ADMIN), `viewer` / `viewer123` (USER, read-only).

On some Windows PowerShell setups, use `npm.cmd` instead of `npm` if script execution policy blocks `npm.ps1`.

---

## 5. App structure (Phase 1)

```text
src/app/
  app.ts                 # App shell + nav + language toggle
  app.html
  app.css
  app.config.ts          # SPA providers + Transloco + HttpClient
  app.routes.ts          # Routes
  app.spec.ts
  core/
    constants/
      app.constants.ts   # STORAGE_KEY, DEFAULT_MONTHLY_FEE, categories, month names
    i18n/
      language.service.ts    # Active lang, RTL, month/category labels
      transloco-loader.ts    # Loads public/i18n/{lang}.json
    services/
      storage.service.ts # localStorage load/save
      hostel.store.ts    # Domain operations + signals
      toast.service.ts   # custom toast queue (one-line messages)
      theme.service.ts   # light/dark/system theme
      user-journey.service.ts  # guided product tour open/step + completion
    utils/
      swal-dialog.ts     # Shared SweetAlert2 confirm helpers (destructive only)
  models/
    resident.model.ts
    payment.model.ts     # MonthRecord + Payment
    expense.model.ts
    app-data.model.ts    # AppData + DashboardStats
  pages/
    dashboard/           # Home overview (ops snapshot; no charts)
    statistics/          # Phase 3 charts + balance timeline (lazy route)
    residents/           # Resident CRUD + active/inactive
    payments/            # Monthly payment tracking
    expenses/            # Expense management
  shared/
    month-calendar-picker/  # Filter-style month calendar (icon → year grid)
    toast/               # Custom toast host (design-matched)
    user-journey/        # Multi-step "How it works" modal walkthrough
public/
  i18n/
    en.json              # English UI strings
    ar.json              # Arabic UI strings
```

### Routes

| Path | Page | Purpose |
|------|------|---------|
| `/login` | Login | Username/password (public) |
| `/` | Dashboard | Paid/unpaid, collected, expenses, balance |
| `/residents` | Residents | Manage residents (write = admin) |
| `/payments` | Payments | Monthly payment tracking (write = admin) |
| `/expenses` | Expenses | Expense CRUD (write = admin) |
| `/statistics` | Statistics | Charts + timeline |
| `**` | redirect to `/` | |

### Storage
- **Domain data:** Spring Boot API (`GET /api/bootstrap`). Do **not** write `hostel-expense-tracker-data-v1` anymore.
- JWT: `sessionStorage` key `hostel-expense-tracker-token`
- Theme preference: `hostel-expense-tracker-theme` (`light` | `dark` | `system`)
- Language: `hostel-expense-tracker-lang` (`en` | `ar`)
- User journey completed: `hostel-expense-tracker-journey-v1` (`done` when finished/skipped)
- Import old localStorage JSON: admin `POST /api/admin/import`

### User journey (guided tour)
- **Purpose:** Teach the real workflow so a new user knows what to do: residents → payments → expenses → dashboard balance.
- **Service:** `UserJourneyService` (`src/app/core/services/user-journey.service.ts`)
  - Signals: `isOpen`, `stepIndex`, `completed`
  - `open(fromStart?)`, `next` / `prev` / `goToStep`, `completeAndClose`, `maybeAutoOpen`
- **UI:** `UserJourneyComponent` (`src/app/shared/user-journey/`) — modal overlay, progress bar, step dots, Next/Back/Skip, optional “Open this page” deep link per feature step
- **Steps (6):** welcome → residents → payments → expenses → dashboard → ready (tips: language, theme, reopen)
- **Entry points:**
  1. Auto-open on first visit (~600ms after shell load) if journey not completed
  2. Header **?** button (always available)
  3. Mobile nav item “How it works”
  4. Dashboard banner when no active residents and tour not completed
- **i18n:** all copy under `journey.*` in `en.json` / `ar.json` (Egyptian dialect for AR)
- **Keyboard:** Escape skips/closes; arrow keys advance with RTL awareness
- Do **not** use SweetAlert2 for the tour; keep it as the dedicated overlay component

---

## 6. Domain models (summary)

### Resident
- `id`, `name`, `phone`, `room`
- `monthlyFee` (number, EGP, per resident)
- `active` (boolean)
- `notes`
- `createdAt`, `updatedAt`

### MonthRecord
- `id` format: `YYYY-MM` (example: `2026-07`)
- `year`, `month`, `label` (e.g. `July 2026`)
- `createdAt`

### Payment
- `id`, `monthId`, `residentId`
- `amount`
- `paid` (boolean)
- `paidAt` (date string `YYYY-MM-DD` or `null`)
- `notes`
- `createdAt`, `updatedAt`

### Expense
- `id`, `title`, `category` (`ExpenseCategory` preset), `amount`, `date`
- `description`, `addedBy`
- `paid` (boolean; unpaid does not reduce balance)
- `createdAt`, `updatedAt`

---

## 7. Features already implemented (Phase 1)

Treat these as **done** unless asked to change them:

1. **Residents management**
   - Add / edit / remove (SweetAlert2 confirm on remove)
   - Mark active / inactive
   - List + filter (all / active / inactive)
   - Per-resident monthly fee

2. **Monthly payment tracking**
   - **Auto-create current month** on app load (`ensureCurrentMonth`) only
   - **Calendar browse** does **not** create a month shell; past months need **Start tracking** on Payments (or become kept only after real activity)
   - **Prune empty months:** unused shells (no paid payments, no notes, no custom amounts, no expenses that month) are removed when switching months / on load — current calendar month is always kept
   - **Calendar month navigator** (same pattern as dashboard): prev/next + year grid; open months marked with a dot
   - **Delete month** (removes the month + all its payment rows; expenses unchanged; SweetAlert2 confirm)
   - Seed payments for active residents
   - Mark paid / unpaid
   - Store payment date and amount
   - Edit amount/notes inline

3. **Expense management**
   - Record title, category, amount, date, description, added by, **paid/unpaid**
   - Edit / delete (SweetAlert2 confirm)
   - Quick **Mark paid** / **Mark unpaid** on list rows
   - **Categories:** presets + **add custom** (+ button on expense form); stored in `customCategories`
   - **Expense history filters:** desktop shows an inline filter bar above the list; mobile uses filter icon → dialog → Apply, with removable chips; **month filter uses multi-select calendar picker** (shared `app-month-calendar-picker`) — activity months dotted; **All months** / **Clear months** reset selection
   - Filtered paid/unpaid sums in header
   - Only **paid** amounts reduce balance; unpaid totals shown separately

4. **Dashboard (home)**
   - **Month navigator** — prev / label / next in the header; click label opens a **year + 12-month calendar grid** (pick any month); stats / unpaid list / recent expenses follow selection
   - Paid / not paid (selected month)
   - Collected (selected month)
   - Paid expenses (selected month) + unpaid note when applicable
   - Current balance (all-time collected − all-time **paid** expenses) — **hero gradient card**
   - Month collection progress bar (% of active residents paid)
   - Unpaid list (with initials avatars) + recent expenses (for selected month) + all-time totals
   - Header context chips: solid brand **month** badge + soft **active residents** badge

4b. **Resident payment history**
   - From Residents list: **History** opens a panel for that resident
   - Filter: **All months** button, or a **year + 12-month calendar grid** with **multi-select** (tap to toggle months)
   - Empty selection = all months; one or more selected months filter the list
   - Months where the resident has payment activity are marked with a **dot** on the calendar
   - Shows payment rows (status, amount, paid date, notes) + summary counts/collected for the filter

5. **Setup**
   - SSR removed; client-only SPA
   - Tailwind 4 + design-system utilities in `src/styles.css`

6. **Localization (EN + AR)**
   - Runtime i18n via Transloco; header language toggle
   - Full UI translation: shell, all pages, filters, form labels/placeholders, empty states, SweetAlert confirms, toast messages
   - Arabic RTL (`dir="rtl"`) when AR is active
   - Localized month names and expense category display labels

7. **User journey / how-it-works tour**
   - First-visit multi-step modal: welcome → residents → payments → expenses → dashboard → ready
   - Reopen via header **?** (and mobile nav); empty dashboard banner when no active residents
   - Completion stored in localStorage (`hostel-expense-tracker-journey-v1`)

---

## 8. Working conventions for agents

1. **ALWAYS work on the main repo `F:\grok\hostel-expense-tracker` — never only on a Grok worktree.** See “CRITICAL: Always work on the main repo” above. The user runs `ng serve` from the main repo; worktree-only edits will not show up.
2. Prefer **small, focused changes** that match existing patterns (standalone components, signals, Tailwind utility classes, `HostelStore`).
3. Keep UI consistent with the current design system (`src/styles.css`):
   - Brand teal via Tailwind theme tokens (`brand-50`…`brand-900`, primary actions `brand-600`)
   - Soft mint canvas background + ambient gradient orbs on `body`
   - Shared utilities: `.ui-card`, `.ui-btn-primary`, `.ui-input`, `.ui-chip`, `.ui-badge-*`, `.ui-empty`, `.ui-avatar`, `.ui-progress`
   - Font: **Plus Jakarta Sans** (loaded in `index.html`)
   - **Mobile (< md):** burger nav + card lists; **Desktop (md+):** pill nav + data tables
4. Prefer **SweetAlert2** for destructive confirmations and custom **`ToastService`** for success/action feedback — never native `alert` / `confirm`. One short sentence per toast.
5. Do **not** reintroduce SSR unless the user asks.
6. Domain data must go through the Spring Boot API (`F:\grok\hostel-expense-tracker-BE`). Do not persist hostel data in localStorage. Theme, language, and tour completion may stay in localStorage.
7. Do **not** hardcode a single global fee of 250 as the only allowed amount; fee is per resident.
8. After non-trivial changes, run `npm run build` (or `npm.cmd run build`) **in the main repo** to verify.
9. Do not create unsolicited markdown docs; this `instructions/` folder is the exception requested by the user for agent handoff.
10. **Update this file** (in the main repo) after meaningful product/architecture/UI-library changes so future agents stay in sync.
11. Do not commit unless the user explicitly asks.
12. Implement **step by step** when the user requests phased work; confirm scope if unclear.

---

## 9. Suggested future phases (not implemented unless requested)

These are optional next steps, not commitments:

- Export / import JSON backup of localStorage data
- ~~Better statistics (charts by month/category)~~ — **done in Phase 3**
- Multi-month comparison reports
- Text search on expenses and residents
- Edit payment history validation rules
- Further mobile polish / offline PWA
- ~~Backend + multi-device sync + auth~~ — **done** (`F:\grok\hostel-expense-tracker-BE`, JWT, USER/ADMIN)
- Additional locales beyond EN/AR
- Locale-aware number/date formatting (`ar-EG` digits/calendars) if requested

---

## 10. Session history (high level)

1. User requested hostel expense tracker in Angular, step by step.
2. **Step 0:** Reviewed scaffold; recommended SPA over SSR for localStorage.
3. User confirmed deps already installed; asked to **disable SSR → SPA**.
4. SPA conversion applied (initially in Grok worktree, then re-applied to **`F:\grok\hostel-expense-tracker`** so IDE showed changes).
5. **Phase 1** implemented: residents, monthly payments, expenses, dashboard, Tailwind UI, localStorage store.
6. This instructions file was created so future agents can continue without re-briefing.
7. Added **delete month** on Payments page (`HostelStore.removeMonth`) for mistaken months.
8. Replaced native `confirm` for delete-month with **SweetAlert2** modal + success toast; styles wired in `src/styles.css`.
9. Migrated **all** remaining native `confirm` usages (residents remove, expenses delete) to SweetAlert2 via shared `swal-dialog.ts` helpers.
10. **Mobile responsive polish:**
    - App shell: sticky header, **burger menu** below `md` (desktop keeps horizontal nav); menu closes on route change
    - Residents / Payments / Expenses: **card layout on mobile**, table on `md+`
    - First applied only in Grok worktree (user could not see it); **re-applied to main repo** `F:\grok\hostel-expense-tracker`
11. User confirmed: **always edit the main repo directly, never rely on the Grok worktree alone.** Instructions strengthened accordingly.
12. **Inactive residents excluded from paid/unpaid tracking:** dashboard paid/unpaid counts, unpaid list, and payments page rows/summary only include active residents. All-time collected/balance still includes historical paid amounts.
13. **Dashboard header polish:** replaced muted “July 2026 · N active residents” subtitle with visible badges (solid teal month chip + soft teal active-residents chip) under the Dashboard title.
14. **Unpaid expenses:** expenses have a `paid` flag. Unpaid expenses are tracked but **do not** subtract from balance left. Form checkbox + mark paid/unpaid actions; storage migrates missing `paid` → `true`.
15. **i18n (Transloco):** English + Arabic runtime localization for the entire UI; language preference in localStorage; RTL for Arabic; month/category labels localized at display time.
16. **Toast notifications:** ngx-toastr → angular-toastify → **custom ToastService + toast-host** (soft-ledger UI, no toast library dependency); one-sentence messages only.
17. **UI/UX redesign (soft ledger):** Plus Jakarta Sans, brand teal tokens, ambient canvas, glass sticky header with pill nav, dashboard balance hero + collection progress, payment progress bar, resident initials avatars, refined empty states with CTAs, shared `.ui-*` component classes for consistency.
18. **Dark mode:** `ThemeService` (`light` | `dark` | `system`), preference key `hostel-expense-tracker-theme` in localStorage; FOUC-safe boot script in `index.html`; header icon cycles light → dark → system; Tailwind `@custom-variant dark` on `html.dark`; SweetAlert dark styles.
19. **User journey:** guided product tour so new users understand features and workflow (residents → payments → expenses → dashboard); EN/AR; first-visit auto-open + header help + empty dashboard banner.
20. **Phase 2 — organization & history:** expense categories (presets + custom); filter dialog on Expenses; dashboard compact month navigator; resident payment history panel on Residents.
21. **Resident history calendar filter:** replaced the month `<select>` in payment history with a year + 12-month calendar grid; multi-select months (toggle); activity months marked with a dot; **All months** / **Unselect all** clear selection.
22. **Custom toasts:** removed `angular-toastify`; in-house `ToastService` + `app-toast-host` matching soft-ledger design (success/info/error, dark mode, RTL).
23. **Shared month calendar picker** (`app-month-calendar-picker`): expenses month filter (desktop + mobile dialog) uses calendar icon → year/month grid with activity dots instead of `<select>`.
24. **Phase 3 — statistics & balance timeline:** ApexCharts (monthly expenses bar, collection rate line, category donut, balance area trend) + chronological balance timeline (paid payments in / paid expenses out with running balance). Store helpers and EN/AR copy. Issue #19.
25. **Statistics page split:** moved charts + timeline from Dashboard to dedicated lazy route `/statistics` (nav + Dashboard CTA); Dashboard stays operational snapshot only.

---

## 11. Quick “start working” checklist for a new agent

1. Open/read this file fully (from **`F:\grok\hostel-expense-tracker\instructions\PROJECT_CONTEXT.md`**).
2. **Confirm all edits go to `F:\grok\hostel-expense-tracker`** — ignore Grok worktree paths for writes unless the user explicitly asks.
3. Inspect `src/app/core/services/hostel.store.ts` and `src/app/pages/*` before changing behavior.
4. Implement the user’s next request against existing models/store/routes **in the main repo**.
5. Keep business rules in section 2 consistent unless the user changes them.
6. Verify with build (main repo) and a short manual smoke path: residents → payments → expenses → dashboard.

---

## 12. Key files to read first

- `src/app/core/services/hostel.store.ts` — all domain logic
- `src/app/core/constants/app.constants.ts` — defaults/categories/storage key
- `src/app/core/utils/swal-dialog.ts` — shared SweetAlert2 destructive confirm helpers
- `src/app/core/services/toast.service.ts` — custom toast queue (single-sentence success/info/error)
- `src/app/shared/toast/*` — toast host UI (design-matched)
- `src/app/core/services/theme.service.ts` — light/dark/system theme preference + `html.dark`
- `src/app/core/services/user-journey.service.ts` — guided tour open/step/completion state
- `src/app/shared/user-journey/*` — multi-step how-it-works modal
- `src/app/core/i18n/language.service.ts` — language preference, RTL, month/category formatting
- `src/app/core/i18n/transloco-loader.ts` — translation file loader
- `public/i18n/en.json`, `public/i18n/ar.json` — UI translation dictionaries (`journey.*` for tour)
- `src/app/models/*` — data shapes
- `src/app/app.routes.ts` — navigation (`/statistics` lazy-loaded)
- `src/app/pages/dashboard/*` — home ops snapshot
- `src/app/pages/statistics/*` — ApexCharts + balance timeline
- `src/app/pages/residents/*`
- `src/app/pages/payments/*`
- `src/app/pages/expenses/*`
- `package.json`, `angular.json` — SPA build (no SSR entries); SweetAlert2 + ApexCharts CommonJS allowlist
- `src/styles.css` — Tailwind 4 theme tokens, ambient canvas, shared `.ui-*` utilities, SweetAlert2 CSS

---

*Last updated: Backend uses JPA/Hibernate with a single SQLite JDBC driver (not a bundle of DBs). Properties + gitignored local file. Docker Compose Postgres kept optional. Auth + Spring Boot at `F:\grok\hostel-expense-tracker-BE`. Always work on main repo `F:\grok\hostel-expense-tracker` for the SPA.*

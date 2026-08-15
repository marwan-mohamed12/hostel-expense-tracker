# Hostel Expense Tracker

A client-side web app for running a hostel’s shared money: collect monthly fees from residents, log shared expenses, and always know **what balance is left**.

Built as a practical internal tool — not a multi-tenant SaaS. Domain data lives in the Spring Boot API at `F:\grok\hostel-expense-tracker-BE`. Staff sign in as **admin** (full edit) or **viewer** (see only).

---

## Overview

Hostel managers track:

- **Who lives there** and what each person pays monthly  
- **Who paid this month** and who still owes  
- **Shared costs** (utilities, repairs, supplies, custom categories)  
- **Current balance** — money collected minus money actually spent  

Currency is **EGP**. The UI is fully bilingual (**English** and **Arabic** with RTL), works on phone and desktop, and includes light / dark / system themes.

---

## Screenshots

> **TODO — add screenshots here.** Capture the app while it has a bit of sample data so the UI looks realistic. Suggested files under `docs/screenshots/` (or any path you prefer), then link them below.

| Screen | What to capture | Placeholder |
|--------|-----------------|-------------|
| Dashboard | Balance hero, month stats, unpaid list | `docs/screenshots/dashboard.png` |
| Residents | List + add/edit form (or history panel) | `docs/screenshots/residents.png` |
| Payments | Month view with paid/unpaid rows | `docs/screenshots/payments.png` |
| Expenses | Expense list with filters | `docs/screenshots/expenses.png` |
| Statistics | Charts + balance timeline | `docs/screenshots/statistics.png` |
| Dark mode / Arabic (optional) | Same page in dark theme or RTL | `docs/screenshots/dark-or-ar.png` |

Example markdown once files exist:

```markdown
![Dashboard](docs/screenshots/dashboard.png)
```

---

## Features

### Dashboard
Home overview for the selected month: paid vs unpaid resident counts, amount collected, paid expenses, collection progress, unpaid residents list, recent expenses, and the overall **current balance**. Browse any month with prev/next controls or a year calendar.

### Residents
Add, edit, and remove residents. Each resident has their own **monthly fee** (default suggestion 250 EGP), room, phone, notes, and **active / inactive** status. Inactive people are kept for history but excluded from month paid/unpaid tracking. Open a resident’s **payment history** with multi-month calendar filtering.

### Payments
Track fees **per calendar month**. The current month is created automatically; open other months when you need them. Seed rows for active residents, mark paid/unpaid, set amount and payment date, add notes. Delete a whole month (and its payment rows) when it was opened by mistake.

### Expenses
Log shared costs with title, category, amount, date, description, and who added it. Expenses can be **paid or unpaid** — unpaid ones stay visible for planning but **do not reduce balance**. Built-in categories (Electricity, Water, Gas, Internet, Repairs, Cleaning, Supplies, Other) plus **custom categories**. Filter the history by month, category, and paid status.

### Statistics
Charts and a balance story over time:

- Monthly expenses and collections  
- Collection rate trend  
- Spend by category  
- Balance over months  
- Chronological timeline of paid payments in and paid expenses out, with running balance  

### Experience
- **English & Arabic** (Egyptian dialect for AR), language toggle, full RTL support  
- **Light / dark / system** theme  
- Guided **“How it works”** tour on first visit (reopen anytime from **?**)  
- Responsive layout: card lists + burger menu on mobile; tables + pill nav on desktop  
- Soft-ledger teal UI with confirm dialogs for destructive actions and short success toasts  

---

## How balance works

| Concept | Rule |
|---------|------|
| **Collected** | Sum of payments marked **paid** |
| **Paid expenses** | Sum of expenses marked **paid** |
| **Unpaid expenses** | Tracked for visibility only — **not** subtracted |
| **Current balance** | All-time collected − all-time **paid** expenses |

Only **active** residents count toward month paid/unpaid UI and unpaid lists. Historical paid amounts from inactive residents still count toward all-time collected and balance.

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Angular 22 (standalone components, signals) |
| Styling | Tailwind CSS 4 |
| Charts | ApexCharts via `ng-apexcharts` |
| i18n | `@jsverse/transloco` (runtime EN/AR) |
| Dialogs | SweetAlert2 (destructive confirms) |
| Feedback | Custom toast service (no third-party toast lib) |
| State | `HostelStore` + Angular signals |
| Persistence | Spring Boot + Hibernate/JPA + SQLite (`F:\grok\hostel-expense-tracker-BE`) |
| Auth | JWT — `USER` (view) / `ADMIN` (edit) |
| Tests | Vitest (`ng test`) |
| Rendering | Client-only SPA (no SSR) |

---

## Getting started

**Requirements:** Node.js, npm, Java 21, Maven. Start the API first.

```bash
cd F:\grok\hostel-expense-tracker-BE
copy application-local.properties.example application-local.properties
mvn spring-boot:run
```

```bash
cd F:\grok\hostel-expense-tracker
npm install
npm start
```

Open [http://localhost:4200/](http://localhost:4200/). Sign in with `admin` / `admin123` or `viewer` / `viewer123`.

Other scripts:

```bash
npm run build   # production build → dist/
npm test        # unit tests (Vitest)
```

On some Windows PowerShell setups, use `npm.cmd` if script execution policy blocks `npm.ps1`.

---

## Project structure

```text
src/app/
  core/           # store, storage, theme, i18n, toasts, constants
  models/         # Resident, Payment, Expense, AppData
  pages/          # dashboard, statistics, residents, payments, expenses
  shared/         # toast host, user journey, month calendar picker
  app.ts          # shell + navigation
  app.routes.ts
public/i18n/      # en.json, ar.json
instructions/     # project domain notes for contributors / agents
```

### Routes

| Path | Page |
|------|------|
| `/` | Dashboard |
| `/statistics` | Statistics (lazy-loaded) |
| `/residents` | Residents |
| `/payments` | Monthly payments |
| `/expenses` | Expenses |

### Browser storage

| Key | Purpose |
|-----|---------|
| `hostel-expense-tracker-data-v1` | Residents, months, payments, expenses, custom categories |
| `hostel-expense-tracker-lang` | `en` / `ar` |
| `hostel-expense-tracker-theme` | `light` / `dark` / `system` |
| `hostel-expense-tracker-journey-v1` | Guided tour completion |

Clearing site data for this origin resets the app.

---

## Notes

- All data lives **in the browser**. There is no server sync or multi-device account yet.  
- Prefer a local backup strategy if the data matters (browser clear, another device, or private mode will lose it).  
- Deeper domain rules and contributor conventions live in [`instructions/PROJECT_CONTEXT.md`](instructions/PROJECT_CONTEXT.md).

---

## License

Private / internal use unless a license file is added later.

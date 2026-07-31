# Hostel Expense Tracker

Internal web app for a hostel to track **resident monthly fees**, **shared expenses**, and the **remaining balance**. Built as a client-only Angular SPA with localStorage persistence (no backend in Phase 1).

## Features (Phase 1)

### Dashboard (`/`)
- Current month paid / unpaid resident counts (**active residents only**)
- Month collected total and paid expenses total
- **Current balance** = all paid payments − all **paid** expenses
- Unpaid residents list and recent expenses
- All-time totals (collected, paid expenses, unpaid expenses when any)

### Residents (`/residents`)
- Add, edit, remove residents
- Per-resident **monthly fee** (EGP; default suggestion 250)
- Active / inactive status and filter
- Inactive residents are excluded from payment tracking counts and unpaid lists

### Payments (`/payments`)
- Auto-create current month; open months manually
- Seed payment rows for active residents
- Mark paid / unpaid, edit amount and notes, store payment date
- Delete a month (and its payment rows) with confirmation

### Expenses (`/expenses`)
- Record title, category, amount, date, description, added by
- **Paid / unpaid** expenses — unpaid are tracked but **do not** reduce balance
- Edit, delete, and quick mark paid / unpaid
- Category presets (Electricity, Water, Gas, Internet, Repairs, Cleaning, Supplies, Other)

### UX
- Responsive layout: burger nav + cards on mobile; horizontal nav + tables on desktop
- SweetAlert2 for destructive confirms; angular-toastify for one-line success toasts
- Teal / slate Tailwind UI

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Angular 22 (standalone components, signals) |
| Styling | Tailwind CSS 4 |
| Forms | Angular Reactive Forms (+ template forms for quick payment edits) |
| Dialogs | SweetAlert2 (confirms) + angular-toastify (toasts) |
| State | `HostelStore` + Angular signals |
| Persistence | `localStorage` (`hostel-expense-tracker-data-v1`) |
| Tests | Vitest (`ng test`) |
| Rendering | SPA only (SSR removed for localStorage simplicity) |

## Getting started

```bash
npm install
npm start
# → http://localhost:4200/
```

Other scripts:

```bash
npm run build   # production build → dist/
npm test        # unit tests (Vitest)
```

On some Windows PowerShell setups, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Project structure

```text
src/app/
  core/           # constants, HostelStore, storage, SweetAlert + angular-toastify helpers
  models/         # Resident, Payment, Expense, AppData
  pages/          # dashboard, residents, payments, expenses
  app.ts          # shell + navigation
  app.routes.ts
instructions/     # agent / project context notes (Phase 1 handoff)
```

## Business rules (short)

- Currency: **EGP**
- Balance uses **only paid payments** and **only paid expenses**
- Unpaid expenses stay visible for tracking but do not subtract from balance left
- Inactive residents keep history for all-time collected, but are out of month paid/unpaid UI

## Notes

- Data lives in the browser (`localStorage`). Clearing site data resets the app.
- No authentication or multi-device sync in Phase 1.
- See `instructions/PROJECT_CONTEXT.md` for full domain rules and agent handoff notes.

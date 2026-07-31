export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Water',
  'Gas',
  'Internet',
  'Repairs',
  'Cleaning',
  'Supplies',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);

/** Coerce free-text / legacy values to a known preset (case-insensitive). */
export function normalizeExpenseCategory(value: unknown): ExpenseCategory {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 'Other';
  }
  if (CATEGORY_SET.has(raw)) {
    return raw as ExpenseCategory;
  }
  const match = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match ?? 'Other';
}

export const DEFAULT_MONTHLY_FEE = 250;

export const STORAGE_KEY = 'hostel-expense-tracker-data-v1';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

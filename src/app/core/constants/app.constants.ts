/** Built-in presets always offered in the category picker. */
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

export type BuiltinExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** @deprecated Prefer string categories (presets + user-defined). Kept for call-site compatibility. */
export type ExpenseCategory = string;

/**
 * Normalize a category label:
 * - empty → Other
 * - match a built-in preset case-insensitively → canonical preset casing
 * - otherwise keep the trimmed custom name (user-defined categories allowed)
 */
export function normalizeExpenseCategory(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 'Other';
  }
  const match = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (match) {
    return match;
  }
  // Collapse internal whitespace for custom labels
  return raw.replace(/\s+/g, ' ');
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

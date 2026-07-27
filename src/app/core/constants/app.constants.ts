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

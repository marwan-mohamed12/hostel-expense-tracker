export interface AppData {
  residents: import('./resident.model').Resident[];
  months: import('./payment.model').MonthRecord[];
  payments: import('./payment.model').Payment[];
  expenses: import('./expense.model').Expense[];
  /** User-defined categories (beyond built-in presets). */
  customCategories: string[];
}

export interface DashboardStats {
  monthId: string;
  monthLabel: string;
  paidCount: number;
  unpaidCount: number;
  monthCollected: number;
  /** Paid expenses in the month only (count toward balance). */
  monthExpenses: number;
  /** Unpaid expenses in the month (tracked, do not reduce balance). */
  monthUnpaidExpenses: number;
  totalCollected: number;
  /** All-time paid expenses only (count toward balance). */
  totalExpenses: number;
  /** All-time unpaid expenses (tracked, do not reduce balance). */
  totalUnpaidExpenses: number;
  /** totalCollected − totalExpenses (paid expenses only). */
  currentBalance: number;
  activeResidents: number;
}

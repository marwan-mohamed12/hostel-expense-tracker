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

/** One month of series data for dashboard charts (oldest → newest). */
export interface MonthlyChartPoint {
  monthId: string;
  /** Storage English label; format for UI via LanguageService.formatMonthId. */
  monthLabel: string;
  /** Paid expenses in this month. */
  expenses: number;
  /** Paid payments collected in this month. */
  collected: number;
  /**
   * % of active-resident payment rows marked paid for this month.
   * Null when the month has no active-resident payment rows.
   */
  collectionRate: number | null;
  /** Running balance after this month (all paid payments − all paid expenses through month end). */
  balanceEnd: number;
}

/** Paid expense total for one category (for donut chart). */
export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percent: number;
}

/** One balance-affecting event for the timeline. */
export interface BalanceTimelineEvent {
  id: string;
  /** YYYY-MM-DD for sorting/display. */
  date: string;
  type: 'payment' | 'expense';
  title: string;
  /** Absolute amount (always ≥ 0). */
  amount: number;
  /** +payment / −expense. */
  signedAmount: number;
  /** Balance after applying this event (chronological order). */
  runningBalance: number;
  /** Optional secondary label (category, month id, etc.). */
  meta?: string;
}

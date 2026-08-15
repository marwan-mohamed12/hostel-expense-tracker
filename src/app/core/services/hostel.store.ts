import { computed, Injectable, signal } from '@angular/core';
import { EXPENSE_CATEGORIES, MONTH_NAMES, normalizeExpenseCategory } from '../constants/app.constants';
import {
  BalanceTimelineEvent,
  CategoryBreakdownItem,
  DashboardStats,
  MonthlyChartPoint,
} from '../../models/app-data.model';
import { Expense, ExpenseInput } from '../../models/expense.model';
import { MonthRecord, Payment, PaymentUpdate } from '../../models/payment.model';
import { Resident, ResidentInput } from '../../models/resident.model';
import { HostelApiService } from './hostel-api.service';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthIdFromDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

@Injectable({ providedIn: 'root' })
export class HostelStore {
  private readonly residentsSignal = signal<Resident[]>([]);
  private readonly monthsSignal = signal<MonthRecord[]>([]);
  private readonly paymentsSignal = signal<Payment[]>([]);
  private readonly expensesSignal = signal<Expense[]>([]);
  private readonly customCategoriesSignal = signal<string[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly loadedSignal = signal(false);
  private readonly loadErrorSignal = signal<string | null>(null);
  private readonly pendingWrites = signal(0);

  readonly residents = this.residentsSignal.asReadonly();
  readonly months = this.monthsSignal.asReadonly();
  readonly payments = this.paymentsSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();
  readonly customCategories = this.customCategoriesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly busy = computed(() => this.loadingSignal() || this.pendingWrites() > 0);
  readonly busyKind = computed<'load' | 'save' | null>(() => {
    if (this.pendingWrites() > 0) {
      return 'save';
    }
    if (this.loadingSignal()) {
      return 'load';
    }
    return null;
  });

  readonly activeResidents = computed(() =>
    this.residentsSignal().filter((resident) => resident.active),
  );

  readonly monthsNewestFirst = computed(() =>
    [...this.monthsSignal()].sort((a, b) => b.id.localeCompare(a.id)),
  );

  readonly expensesNewestFirst = computed(() =>
    [...this.expensesSignal()].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
  );

  /**
   * All categories for pickers: built-in presets first, then custom (A–Z).
   * Includes any category still referenced by an expense.
   */
  readonly allCategories = computed(() => {
    const custom = this.customCategoriesSignal();
    const fromExpenses = this.expensesSignal().map((e) => e.category);
    const seen = new Set<string>();
    const result: string[] = [];

    for (const name of [...EXPENSE_CATEGORIES, ...custom, ...fromExpenses]) {
      const normalized = normalizeExpenseCategory(name);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(normalized);
    }
    return result;
  });

  constructor(private readonly api: HostelApiService) {}

  private async withBusy<T>(work: () => Promise<T>): Promise<T> {
    this.pendingWrites.update((count) => count + 1);
    try {
      return await work();
    } finally {
      this.pendingWrites.update((count) => Math.max(0, count - 1));
    }
  }

  async loadFromApi(): Promise<void> {
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);
    try {
      const data = await this.api.bootstrap();
      this.residentsSignal.set(data.residents ?? []);
      this.monthsSignal.set(data.months ?? []);
      this.paymentsSignal.set(data.payments ?? []);
      this.expensesSignal.set(data.expenses ?? []);
      this.customCategoriesSignal.set(data.customCategories ?? []);
      this.loadedSignal.set(true);
    } catch (error) {
      this.loadErrorSignal.set(error instanceof Error ? error.message : 'Failed to load data');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  clear(): void {
    this.residentsSignal.set([]);
    this.monthsSignal.set([]);
    this.paymentsSignal.set([]);
    this.expensesSignal.set([]);
    this.customCategoriesSignal.set([]);
    this.loadErrorSignal.set(null);
    this.loadedSignal.set(false);
  }

  /**
   * Register a category (built-in or custom). Returns the canonical name.
   * Custom names are persisted for future expense forms.
   */
  async addCategory(name: string): Promise<string> {
    return this.withBusy(() => this.addCategoryInner(name));
  }

  private async addCategoryInner(name: string): Promise<string> {
    const saved = await this.api.addCategory(name);
    const normalized = normalizeExpenseCategory(saved || name);
    const isBuiltin = EXPENSE_CATEGORIES.some(
      (c) => c.toLowerCase() === normalized.toLowerCase(),
    );
    if (!isBuiltin) {
      const exists = this.customCategoriesSignal().some(
        (c) => c.toLowerCase() === normalized.toLowerCase(),
      );
      if (!exists) {
        this.customCategoriesSignal.update((list) =>
          [...list, normalized].sort((a, b) => a.localeCompare(b)),
        );
      }
    }
    return normalized;
  }

  // --- Residents ---

  async addResident(input: ResidentInput): Promise<Resident> {
    return this.withBusy(async () => {
      const created = await this.api.createResident(input);
      await this.loadFromApi();
      return created;
    });
  }

  async updateResident(id: string, input: ResidentInput): Promise<void> {
    await this.withBusy(async () => {
      await this.api.updateResident(id, input);
      await this.loadFromApi();
    });
  }

  async removeResident(id: string): Promise<void> {
    await this.withBusy(async () => {
      await this.api.deleteResident(id);
      await this.loadFromApi();
    });
  }

  async setResidentActive(id: string, active: boolean): Promise<void> {
    await this.withBusy(async () => {
      await this.api.setResidentActive(id, active);
      await this.loadFromApi();
    });
  }

  // --- Months & payments ---

  /** Whether a month shell exists in storage (was opened / tracked). */
  hasMonth(monthId: string): boolean {
    return this.monthsSignal().some((item) => item.id === monthId);
  }

  /** Synthetic current-month record for UI defaults. Does not write. */
  ensureCurrentMonth(): MonthRecord {
    const monthId = monthIdFromDate();
    const existing = this.monthsSignal().find((item) => item.id === monthId);
    if (existing) {
      return existing;
    }
    const [yearText, monthText] = monthId.split('-');
    return {
      id: monthId,
      year: Number(yearText),
      month: Number(monthText),
      label: monthLabel(Number(yearText), Number(monthText)),
      createdAt: '',
    };
  }

  /** Browse only — never creates or prunes months. */
  prepareMonthView(_monthId: string): void {
    // Intentionally empty: viewing a month must not write.
  }

  async startTrackingMonth(monthId: string): Promise<MonthRecord> {
    return this.withBusy(async () => {
      const record = await this.api.createMonth(monthId);
      await this.loadFromApi();
      return this.monthsSignal().find((item) => item.id === record.id) ?? record;
    });
  }

  /**
   * A month is “empty” when it has no meaningful activity:
   * no paid payments, no notes, no customized amounts, and no expenses in that month.
   * The current calendar month is never treated as empty (always kept).
   */
  isMonthEmpty(monthId: string): boolean {
    if (monthId === monthIdFromDate()) {
      return false;
    }

    const payments = this.paymentsSignal().filter((p) => p.monthId === monthId);
    for (const payment of payments) {
      if (payment.paid) {
        return false;
      }
      if (payment.notes.trim()) {
        return false;
      }
      const resident = this.residentsSignal().find((r) => r.id === payment.residentId);
      if (resident && payment.amount !== resident.monthlyFee) {
        return false;
      }
    }

    const hasExpenses = this.expensesSignal().some(
      (expense) => expense.date.length >= 7 && expense.date.startsWith(monthId),
    );
    if (hasExpenses) {
      return false;
    }

    return true;
  }

  /**
   * Remove month shells that were opened but never used (no real payments/expenses).
   * Current calendar month is always kept.
   */
  pruneEmptyMonths(_options?: { keepMonthIds?: string[] }): void {
    // Pruning is a write. The backend does not prune on GET; the UI does not prune on browse.
  }

  async removeMonth(monthId: string): Promise<MonthRecord | null> {
    return this.withBusy(async () => {
      const recreated = await this.api.deleteMonth(monthId);
      await this.loadFromApi();
      if (!recreated) {
        return null;
      }
      return this.monthsSignal().find((item) => item.id === recreated.id) ?? recreated;
    });
  }

  getPaymentsForMonth(monthId: string): Payment[] {
    return this.paymentsSignal().filter((payment) => payment.monthId === monthId);
  }

  async updatePayment(paymentId: string, update: PaymentUpdate): Promise<void> {
    await this.withBusy(async () => {
      const saved = await this.api.updatePayment(paymentId, update);
      this.paymentsSignal.update((list) =>
        list.map((payment) => (payment.id === paymentId ? saved : payment)),
      );
    });
  }

  async markPaymentPaid(
    paymentId: string,
    paid: boolean,
    amount?: number,
    paidAt?: string,
  ): Promise<void> {
    await this.withBusy(() =>
      this.updatePayment(paymentId, {
        paid,
        amount,
        paidAt: paid ? paidAt || todayDate() : null,
      }),
    );
  }

  // --- Expenses ---

  async addExpense(input: ExpenseInput): Promise<Expense> {
    return this.withBusy(() => this.addExpenseInner(input));
  }

  private async addExpenseInner(input: ExpenseInput): Promise<Expense> {
    const created = await this.api.createExpense(input);
    this.expensesSignal.update((list) => [...list, created]);
    if (created.category) {
      const normalized = normalizeExpenseCategory(created.category);
      const isBuiltin = EXPENSE_CATEGORIES.some(
        (c) => c.toLowerCase() === normalized.toLowerCase(),
      );
      if (!isBuiltin) {
        const exists = this.customCategoriesSignal().some(
          (c) => c.toLowerCase() === normalized.toLowerCase(),
        );
        if (!exists) {
          this.customCategoriesSignal.update((list) =>
            [...list, normalized].sort((a, b) => a.localeCompare(b)),
          );
        }
      }
    }
    return created;
  }

  async updateExpense(id: string, input: ExpenseInput): Promise<void> {
    await this.withBusy(async () => {
      const saved = await this.api.updateExpense(id, input);
      this.expensesSignal.update((list) =>
        list.map((expense) => (expense.id === id ? saved : expense)),
      );
    });
  }

  /** All payments for a resident, newest month first. */
  getPaymentsForResident(residentId: string): Payment[] {
    return this.paymentsSignal()
      .filter((payment) => payment.residentId === residentId)
      .sort((a, b) => b.monthId.localeCompare(a.monthId) || b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Unique YYYY-MM keys derived from expense dates (newest first). */
  expenseMonthIds(): string[] {
    const ids = new Set<string>();
    for (const expense of this.expensesSignal()) {
      if (expense.date.length >= 7) {
        ids.add(expense.date.slice(0, 7));
      }
    }
    return [...ids].sort((a, b) => b.localeCompare(a));
  }

  async markExpensePaid(id: string, paid: boolean): Promise<void> {
    await this.withBusy(async () => {
      const saved = await this.api.setExpensePaid(id, paid);
      this.expensesSignal.update((list) =>
        list.map((expense) => (expense.id === id ? saved : expense)),
      );
    });
  }

  async removeExpense(id: string): Promise<void> {
    await this.withBusy(async () => {
      await this.api.deleteExpense(id);
      this.expensesSignal.update((list) => list.filter((item) => item.id !== id));
    });
  }

  // --- Dashboard ---

  getDashboardStats(monthId?: string): DashboardStats {
    const targetId = monthId ?? monthIdFromDate();
    const found = this.monthsSignal().find((item) => item.id === targetId);
    const [yearText, monthText] = targetId.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    const month: MonthRecord = found ?? {
      id: targetId,
      year,
      month: monthNumber,
      label: monthLabel(year, monthNumber),
      createdAt: '',
    };

    // Only active residents count toward paid/unpaid tracking for the month.
    // Inactive residents keep historical payment rows for balance, but are not tracked.
    const activeIds = new Set(this.activeResidents().map((resident) => resident.id));
    const monthPayments = this.getPaymentsForMonth(month.id).filter((payment) =>
      activeIds.has(payment.residentId),
    );
    const paidPayments = monthPayments.filter((payment) => payment.paid);
    const unpaidPayments = monthPayments.filter((payment) => !payment.paid);
    // Month collected still reflects money actually received from active residents this month.
    const monthCollected = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const monthPrefix = month.id;
    const monthExpensesList = this.expensesSignal().filter((expense) =>
      expense.date.startsWith(monthPrefix),
    );
    // Only paid expenses reduce balance / count as spent.
    const monthExpenses = monthExpensesList
      .filter((expense) => expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const monthUnpaidExpenses = monthExpensesList
      .filter((expense) => !expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalCollected = this.paymentsSignal()
      .filter((payment) => payment.paid)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = this.expensesSignal()
      .filter((expense) => expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalUnpaidExpenses = this.expensesSignal()
      .filter((expense) => !expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      monthId: month.id,
      monthLabel: month.label,
      paidCount: paidPayments.length,
      unpaidCount: unpaidPayments.length,
      monthCollected,
      monthExpenses,
      monthUnpaidExpenses,
      totalCollected,
      totalExpenses,
      totalUnpaidExpenses,
      currentBalance: totalCollected - totalExpenses,
      activeResidents: this.activeResidents().length,
    };
  }

  getResidentName(residentId: string): string {
    return this.residentsSignal().find((resident) => resident.id === residentId)?.name ?? 'Unknown';
  }

  // --- Phase 3 analytics ---

  /**
   * Monthly series for dashboard charts (oldest → newest).
   * Includes months that have payments, paid expenses, or an open month record.
   */
  getMonthlyChartSeries(limit = 12): MonthlyChartPoint[] {
    const monthIds = this.collectActivityMonthIds();
    if (monthIds.length === 0) {
      return [];
    }

    const slice = monthIds.slice(-Math.max(1, limit));
    const activeIds = new Set(this.activeResidents().map((resident) => resident.id));
    const payments = this.paymentsSignal();
    const expenses = this.expensesSignal();

    // Precompute cumulative totals for months before the window so balanceEnd is correct.
    const firstId = slice[0]!;
    let runningCollected = 0;
    let runningExpenses = 0;
    for (const monthId of monthIds) {
      if (monthId >= firstId) {
        break;
      }
      runningCollected += this.sumPaidPaymentsForMonth(payments, monthId);
      runningExpenses += this.sumPaidExpensesForMonth(expenses, monthId);
    }

    return slice.map((monthId) => {
      const [yearText, monthText] = monthId.split('-');
      const year = Number(yearText);
      const monthNumber = Number(monthText);
      const monthCollected = this.sumPaidPaymentsForMonth(payments, monthId);
      const monthExpenses = this.sumPaidExpensesForMonth(expenses, monthId);
      runningCollected += monthCollected;
      runningExpenses += monthExpenses;

      const activeMonthPayments = payments.filter(
        (payment) => payment.monthId === monthId && activeIds.has(payment.residentId),
      );
      const paidActive = activeMonthPayments.filter((payment) => payment.paid).length;
      const totalActive = activeMonthPayments.length;
      const collectionRate =
        totalActive === 0 ? null : Math.round((paidActive / totalActive) * 1000) / 10;

      return {
        monthId,
        monthLabel: monthLabel(year, monthNumber),
        expenses: monthExpenses,
        collected: monthCollected,
        collectionRate,
        balanceEnd: runningCollected - runningExpenses,
      };
    });
  }

  /**
   * Biggest paid expense categories (all-time), sorted by amount desc.
   * @param limit max categories to return (remainder is not grouped — take top N only).
   */
  getCategoryBreakdown(limit = 8): CategoryBreakdownItem[] {
    const totals = new Map<string, number>();
    for (const expense of this.expensesSignal()) {
      if (!expense.paid) {
        continue;
      }
      const key = expense.category || 'Other';
      totals.set(key, (totals.get(key) ?? 0) + expense.amount);
    }

    const entries = [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

    const top = entries.slice(0, Math.max(1, limit));
    const sum = top.reduce((acc, item) => acc + item.amount, 0);
    return top.map((item) => ({
      category: item.category,
      amount: item.amount,
      percent: sum > 0 ? Math.round((item.amount / sum) * 1000) / 10 : 0,
    }));
  }

  /**
   * Chronological balance-affecting events (payments in, paid expenses out).
   * Returns newest first for timeline display; runningBalance is after each event.
   */
  getBalanceTimeline(limit = 50): BalanceTimelineEvent[] {
    type RawEvent = Omit<BalanceTimelineEvent, 'runningBalance'>;
    const raw: RawEvent[] = [];

    for (const payment of this.paymentsSignal()) {
      if (!payment.paid) {
        continue;
      }
      const date =
        payment.paidAt && payment.paidAt.length >= 10
          ? payment.paidAt.slice(0, 10)
          : `${payment.monthId}-01`;
      raw.push({
        id: `payment-${payment.id}`,
        date,
        type: 'payment',
        title: this.getResidentName(payment.residentId),
        amount: payment.amount,
        signedAmount: payment.amount,
        meta: payment.monthId,
      });
    }

    for (const expense of this.expensesSignal()) {
      if (!expense.paid) {
        continue;
      }
      const date = expense.date.length >= 10 ? expense.date.slice(0, 10) : expense.date;
      raw.push({
        id: `expense-${expense.id}`,
        date,
        type: 'expense',
        title: expense.title,
        amount: expense.amount,
        signedAmount: -expense.amount,
        meta: expense.category,
      });
    }

    raw.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) {
        return byDate;
      }
      // Stable tie-break: payments before expenses on same day, then id.
      if (a.type !== b.type) {
        return a.type === 'payment' ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

    let running = 0;
    const withBalance: BalanceTimelineEvent[] = raw.map((event) => {
      running += event.signedAmount;
      return { ...event, runningBalance: running };
    });

    // Newest first for the UI.
    return withBalance.reverse().slice(0, Math.max(1, limit));
  }

  /** Month ids that have payments, paid expenses, or an open month shell — ascending. */
  private collectActivityMonthIds(): string[] {
    const ids = new Set<string>();
    for (const month of this.monthsSignal()) {
      ids.add(month.id);
    }
    for (const payment of this.paymentsSignal()) {
      ids.add(payment.monthId);
    }
    for (const expense of this.expensesSignal()) {
      if (expense.date.length >= 7) {
        ids.add(expense.date.slice(0, 7));
      }
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
  }

  private sumPaidPaymentsForMonth(payments: Payment[], monthId: string): number {
    return payments
      .filter((payment) => payment.monthId === monthId && payment.paid)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  private sumPaidExpensesForMonth(expenses: Expense[], monthId: string): number {
    return expenses
      .filter((expense) => expense.paid && expense.date.startsWith(monthId))
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

}



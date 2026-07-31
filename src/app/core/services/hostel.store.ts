import { computed, Injectable, signal } from '@angular/core';
import {
  DEFAULT_MONTHLY_FEE,
  EXPENSE_CATEGORIES,
  MONTH_NAMES,
  normalizeExpenseCategory,
} from '../constants/app.constants';
import { DashboardStats } from '../../models/app-data.model';
import { Expense, ExpenseInput } from '../../models/expense.model';
import { MonthRecord, Payment, PaymentUpdate } from '../../models/payment.model';
import { Resident, ResidentInput } from '../../models/resident.model';
import { StorageService } from './storage.service';

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createId(): string {
  return crypto.randomUUID();
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

  readonly residents = this.residentsSignal.asReadonly();
  readonly months = this.monthsSignal.asReadonly();
  readonly payments = this.paymentsSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();
  readonly customCategories = this.customCategoriesSignal.asReadonly();

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

  constructor(private readonly storage: StorageService) {
    const data = this.storage.load();
    this.residentsSignal.set(data.residents);
    this.monthsSignal.set(data.months);
    this.paymentsSignal.set(data.payments);
    this.expensesSignal.set(data.expenses);
    this.customCategoriesSignal.set(data.customCategories ?? []);
    this.ensureCurrentMonth();
  }

  /**
   * Register a category (built-in or custom). Returns the canonical name.
   * Custom names are persisted for future expense forms.
   */
  addCategory(name: string): string {
    const normalized = normalizeExpenseCategory(name);
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
        this.persist();
      }
    }
    return normalized;
  }

  // --- Residents ---

  addResident(input: ResidentInput): Resident {
    const timestamp = nowIso();
    const resident: Resident = {
      id: createId(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      room: input.room.trim(),
      monthlyFee: Number(input.monthlyFee) || DEFAULT_MONTHLY_FEE,
      active: input.active,
      notes: input.notes.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.residentsSignal.update((list) => [...list, resident]);
    if (resident.active) {
      this.seedPaymentForResidentInOpenMonths(resident);
    }
    this.persist();
    return resident;
  }

  updateResident(id: string, input: ResidentInput): void {
    const existing = this.residentsSignal().find((item) => item.id === id);
    if (!existing) {
      return;
    }

    const updated: Resident = {
      ...existing,
      name: input.name.trim(),
      phone: input.phone.trim(),
      room: input.room.trim(),
      monthlyFee: Number(input.monthlyFee) || DEFAULT_MONTHLY_FEE,
      active: input.active,
      notes: input.notes.trim(),
      updatedAt: nowIso(),
    };

    this.residentsSignal.update((list) => list.map((item) => (item.id === id ? updated : item)));

    // Keep unpaid payment amounts in sync with the resident fee.
    this.paymentsSignal.update((list) =>
      list.map((payment) => {
        if (payment.residentId !== id || payment.paid) {
          return payment;
        }
        return { ...payment, amount: updated.monthlyFee, updatedAt: nowIso() };
      }),
    );

    if (updated.active) {
      this.seedPaymentForResidentInOpenMonths(updated);
    }

    this.persist();
  }

  removeResident(id: string): void {
    this.residentsSignal.update((list) => list.filter((item) => item.id !== id));
    this.paymentsSignal.update((list) => list.filter((item) => item.residentId !== id));
    this.persist();
  }

  setResidentActive(id: string, active: boolean): void {
    const existing = this.residentsSignal().find((item) => item.id === id);
    if (!existing) {
      return;
    }

    this.updateResident(id, {
      name: existing.name,
      phone: existing.phone,
      room: existing.room,
      monthlyFee: existing.monthlyFee,
      active,
      notes: existing.notes,
    });
  }

  // --- Months & payments ---

  ensureCurrentMonth(): MonthRecord {
    return this.ensureMonth(monthIdFromDate());
  }

  ensureMonth(monthId: string): MonthRecord {
    const existing = this.monthsSignal().find((item) => item.id === monthId);
    if (existing) {
      const beforeCount = this.paymentsSignal().length;
      this.seedMissingPayments(existing.id);
      if (this.paymentsSignal().length !== beforeCount) {
        this.persist();
      }
      return existing;
    }

    const [yearText, monthText] = monthId.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const record: MonthRecord = {
      id: monthId,
      year,
      month,
      label: monthLabel(year, month),
      createdAt: nowIso(),
    };

    this.monthsSignal.update((list) => [...list, record]);
    this.seedMissingPayments(record.id);
    this.persist();
    return record;
  }

  createMonth(year: number, month: number): MonthRecord {
    const monthId = `${year}-${String(month).padStart(2, '0')}`;
    return this.ensureMonth(monthId);
  }

  /**
   * Deletes a month and all of its payment records.
   * Expenses are left untouched (they are date-based, not tied to MonthRecord).
   * If the deleted month was the current calendar month, it is recreated empty
   * so the app always has a working current month.
   */
  removeMonth(monthId: string): MonthRecord | null {
    const exists = this.monthsSignal().some((item) => item.id === monthId);
    if (!exists) {
      return null;
    }

    this.monthsSignal.update((list) => list.filter((item) => item.id !== monthId));
    this.paymentsSignal.update((list) => list.filter((item) => item.monthId !== monthId));

    const currentId = monthIdFromDate();
    if (monthId === currentId) {
      // Always keep a current-month shell available.
      const recreated = this.ensureMonth(currentId);
      return recreated;
    }

    this.persist();
    return null;
  }

  getPaymentsForMonth(monthId: string): Payment[] {
    return this.paymentsSignal().filter((payment) => payment.monthId === monthId);
  }

  updatePayment(paymentId: string, update: PaymentUpdate): void {
    this.paymentsSignal.update((list) =>
      list.map((payment) => {
        if (payment.id !== paymentId) {
          return payment;
        }

        const paid = update.paid ?? payment.paid;
        let paidAt = update.paidAt !== undefined ? update.paidAt : payment.paidAt;

        if (paid && !paidAt) {
          paidAt = todayDate();
        }
        if (!paid) {
          paidAt = null;
        }

        return {
          ...payment,
          amount: update.amount !== undefined ? Number(update.amount) : payment.amount,
          paid,
          paidAt,
          notes: update.notes !== undefined ? update.notes : payment.notes,
          updatedAt: nowIso(),
        };
      }),
    );
    this.persist();
  }

  markPaymentPaid(paymentId: string, paid: boolean, amount?: number, paidAt?: string): void {
    this.updatePayment(paymentId, {
      paid,
      amount,
      paidAt: paid ? paidAt || todayDate() : null,
    });
  }

  // --- Expenses ---

  addExpense(input: ExpenseInput): Expense {
    const timestamp = nowIso();
    const category = this.addCategory(String(input.category ?? ''));
    const expense: Expense = {
      id: createId(),
      title: String(input.title ?? '').trim(),
      category,
      amount: Number(input.amount) || 0,
      date: input.date || todayDate(),
      description: String(input.description ?? '').trim(),
      addedBy: String(input.addedBy ?? '').trim(),
      paid: input.paid !== false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.expensesSignal.update((list) => [...list, expense]);
    this.persist();
    return expense;
  }

  updateExpense(id: string, input: ExpenseInput): void {
    const category = this.addCategory(String(input.category ?? ''));
    this.expensesSignal.update((list) =>
      list.map((expense) => {
        if (expense.id !== id) {
          return expense;
        }
        return {
          ...expense,
          title: String(input.title ?? '').trim(),
          category,
          amount: Number(input.amount) || 0,
          date: input.date,
          description: String(input.description ?? '').trim(),
          addedBy: String(input.addedBy ?? '').trim(),
          paid: input.paid !== false,
          updatedAt: nowIso(),
        };
      }),
    );
    this.persist();
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

  markExpensePaid(id: string, paid: boolean): void {
    this.expensesSignal.update((list) =>
      list.map((expense) => {
        if (expense.id !== id) {
          return expense;
        }
        return { ...expense, paid, updatedAt: nowIso() };
      }),
    );
    this.persist();
  }

  removeExpense(id: string): void {
    this.expensesSignal.update((list) => list.filter((item) => item.id !== id));
    this.persist();
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

  private seedMissingPayments(monthId: string): void {
    const existingByResident = new Set(
      this.paymentsSignal()
        .filter((payment) => payment.monthId === monthId)
        .map((payment) => payment.residentId),
    );

    const timestamp = nowIso();
    const missing: Payment[] = this.activeResidents()
      .filter((resident) => !existingByResident.has(resident.id))
      .map((resident) => ({
        id: createId(),
        monthId,
        residentId: resident.id,
        amount: resident.monthlyFee,
        paid: false,
        paidAt: null,
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

    if (missing.length > 0) {
      this.paymentsSignal.update((list) => [...list, ...missing]);
    }
  }

  private seedPaymentForResidentInOpenMonths(resident: Resident): void {
    // Seed for current month and any already-created months that are current or future.
    const currentId = monthIdFromDate();
    const targets = this.monthsSignal().filter((month) => month.id >= currentId);
    if (!targets.some((month) => month.id === currentId)) {
      this.ensureMonth(currentId);
      return;
    }

    const timestamp = nowIso();
    const additions: Payment[] = [];

    for (const month of targets) {
      const hasPayment = this.paymentsSignal().some(
        (payment) => payment.monthId === month.id && payment.residentId === resident.id,
      );
      if (!hasPayment) {
        additions.push({
          id: createId(),
          monthId: month.id,
          residentId: resident.id,
          amount: resident.monthlyFee,
          paid: false,
          paidAt: null,
          notes: '',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    if (additions.length > 0) {
      this.paymentsSignal.update((list) => [...list, ...additions]);
    }
  }

  private persist(): void {
    this.storage.save({
      residents: this.residentsSignal(),
      months: this.monthsSignal(),
      payments: this.paymentsSignal(),
      expenses: this.expensesSignal(),
      customCategories: this.customCategoriesSignal(),
    });
  }
}


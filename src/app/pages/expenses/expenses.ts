import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../core/constants/app.constants';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { ToastService } from '../../core/services/toast.service';
import { confirmDelete } from '../../core/utils/swal-dialog';
import { Expense } from '../../models/expense.model';

export type ExpenseStatusFilter = 'all' | 'paid' | 'unpaid';
export type ExpenseCategoryFilter = 'all' | ExpenseCategory;
export type ExpenseMonthFilter = 'all' | string;

@Component({
  selector: 'app-expenses',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, TranslocoPipe],
  templateUrl: './expenses.html',
})
export class ExpensesPage {
  private readonly store = inject(HostelStore);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly categories = EXPENSE_CATEGORIES;
  readonly expenses = this.store.expensesNewestFirst;
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

  readonly categoryFilter = signal<ExpenseCategoryFilter>('all');
  readonly monthFilter = signal<ExpenseMonthFilter>('all');
  readonly statusFilter = signal<ExpenseStatusFilter>('all');

  readonly statusOptions = [
    { id: 'all' as const, labelKey: 'common.all' },
    { id: 'paid' as const, labelKey: 'common.paid' },
    { id: 'unpaid' as const, labelKey: 'common.unpaid' },
  ];

  /** Month chips from expense dates + open payment months (newest first). */
  readonly monthOptions = computed(() => {
    this.language.lang();
    const fromExpenses = this.store.expenseMonthIds();
    const fromMonths = this.store.monthsNewestFirst().map((m) => m.id);
    const ids = [...new Set([...fromExpenses, ...fromMonths])].sort((a, b) =>
      b.localeCompare(a),
    );
    return ids.map((id) => ({
      id,
      label: this.language.formatMonthId(id),
    }));
  });

  readonly filteredExpenses = computed(() => {
    const category = this.categoryFilter();
    const month = this.monthFilter();
    const status = this.statusFilter();

    return this.expenses().filter((expense) => {
      if (category !== 'all' && expense.category !== category) {
        return false;
      }
      if (month !== 'all' && !expense.date.startsWith(month)) {
        return false;
      }
      if (status === 'paid' && !expense.paid) {
        return false;
      }
      if (status === 'unpaid' && expense.paid) {
        return false;
      }
      return true;
    });
  });

  readonly paidTotal = computed(() =>
    this.filteredExpenses()
      .filter((expense) => expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  readonly unpaidTotal = computed(() =>
    this.filteredExpenses()
      .filter((expense) => !expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  readonly hasActiveFilters = computed(
    () =>
      this.categoryFilter() !== 'all' ||
      this.monthFilter() !== 'all' ||
      this.statusFilter() !== 'all',
  );

  /** Per-category totals for quick history glance (respects month/status filters). */
  readonly categoryBreakdown = computed(() => {
    this.language.lang();
    const month = this.monthFilter();
    const status = this.statusFilter();

    const base = this.expenses().filter((expense) => {
      if (month !== 'all' && !expense.date.startsWith(month)) {
        return false;
      }
      if (status === 'paid' && !expense.paid) {
        return false;
      }
      if (status === 'unpaid' && expense.paid) {
        return false;
      }
      return true;
    });

    return EXPENSE_CATEGORIES.map((cat) => {
      const items = base.filter((e) => e.category === cat);
      const total = items.reduce((sum, e) => sum + e.amount, 0);
      return { category: cat, count: items.length, total };
    }).filter((row) => row.count > 0);
  });

  readonly form = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    category: this.fb.nonNullable.control(EXPENSE_CATEGORIES[0] as ExpenseCategory, Validators.required),
    // null (empty) by default — 0 fails min(0.01) and previously blocked save with no feedback
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), Validators.required),
    description: this.fb.nonNullable.control(''),
    addedBy: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    paid: this.fb.nonNullable.control(true),
  });

  /** True when a control is invalid and the user has interacted with it (or submit was attempted). */
  fieldInvalid(name: 'title' | 'category' | 'amount' | 'date' | 'addedBy'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  setCategoryFilter(value: ExpenseCategoryFilter): void {
    this.categoryFilter.set(value);
  }

  setMonthFilter(value: ExpenseMonthFilter): void {
    this.monthFilter.set(value);
  }

  setStatusFilter(value: ExpenseStatusFilter): void {
    this.statusFilter.set(value);
  }

  clearFilters(): void {
    this.categoryFilter.set('all');
    this.monthFilter.set('all');
    this.statusFilter.set('all');
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      title: '',
      category: EXPENSE_CATEGORIES[0],
      amount: null,
      date: new Date().toISOString().slice(0, 10),
      description: '',
      addedBy: '',
      paid: true,
    });
    this.showForm.set(true);
  }

  openEdit(expense: Expense): void {
    this.editingId.set(expense.id);
    this.form.setValue({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      description: expense.description,
      addedBy: expense.addedBy,
      paid: expense.paid,
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.transloco.translate('expenses.formInvalidToast'));
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      title: value.title.trim(),
      category: value.category,
      amount: Number(value.amount),
      date: value.date,
      description: (value.description ?? '').trim(),
      addedBy: value.addedBy.trim(),
      paid: value.paid !== false,
    };

    const editingId = this.editingId();
    if (editingId) {
      this.store.updateExpense(editingId, payload);
      this.toast.success(
        this.transloco.translate('expenses.updatedToast', { title: payload.title }),
      );
    } else {
      this.store.addExpense(payload);
      this.toast.success(
        this.transloco.translate('expenses.createdToast', { title: payload.title }),
      );
    }

    this.cancelForm();
  }

  setPaid(expense: Expense, paid: boolean): void {
    this.store.markExpensePaid(expense.id, paid);
    this.toast.success(
      this.transloco.translate(
        paid ? 'expenses.markedPaidToast' : 'expenses.markedUnpaidToast',
        { title: expense.title },
      ),
    );
  }

  async remove(expense: Expense): Promise<void> {
    const confirmed = await confirmDelete({
      title: this.transloco.translate('expenses.deleteTitle'),
      text: this.transloco.translate('expenses.deleteText', { title: expense.title }),
      confirmButtonText: this.transloco.translate('expenses.deleteConfirm'),
      cancelButtonText: this.transloco.translate('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    this.store.removeExpense(expense.id);
    if (this.editingId() === expense.id) {
      this.cancelForm();
    }

    this.toast.success(
      this.transloco.translate('expenses.deletedToast', { title: expense.title }),
    );
  }
}

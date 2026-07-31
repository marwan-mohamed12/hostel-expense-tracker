import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EXPENSE_CATEGORIES } from '../../core/constants/app.constants';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { ToastService } from '../../core/services/toast.service';
import { confirmDelete } from '../../core/utils/swal-dialog';
import { Expense } from '../../models/expense.model';
import { MonthCalendarPickerComponent } from '../../shared/month-calendar-picker/month-calendar-picker';

export type ExpenseStatusFilter = 'all' | 'paid' | 'unpaid';
export type ExpenseCategoryFilter = 'all' | string;

@Component({
  selector: 'app-expenses',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    TranslocoPipe,
    MonthCalendarPickerComponent,
  ],
  templateUrl: './expenses.html',
})
export class ExpensesPage {
  private readonly store = inject(HostelStore);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(ToastService);
  readonly language = inject(LanguageService);

  readonly categories = this.store.allCategories;
  readonly expenses = this.store.expensesNewestFirst;
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

  /** Applied filters (list). Empty month array = all months. */
  readonly categoryFilter = signal<ExpenseCategoryFilter>('all');
  readonly monthFilter = signal<string[]>([]);
  readonly statusFilter = signal<ExpenseStatusFilter>('all');

  /** Filter dialog open + drafts (committed only on Apply). */
  readonly filterOpen = signal(false);
  readonly draftCategory = signal<ExpenseCategoryFilter>('all');
  readonly draftMonth = signal<string[]>([]);
  readonly draftStatus = signal<ExpenseStatusFilter>('all');

  /** Inline “add category” while composing an expense. */
  readonly showNewCategory = signal(false);
  readonly newCategoryName = signal('');

  readonly statusOptions = [
    { id: 'all' as const, labelKey: 'common.all' },
    { id: 'paid' as const, labelKey: 'common.paid' },
    { id: 'unpaid' as const, labelKey: 'common.unpaid' },
  ];

  /** Months that have expenses (activity dots on the filter calendar). */
  readonly expenseActivityMonthIds = computed(() => this.store.expenseMonthIds());

  /** Label for the active month filter chip / summary. */
  readonly monthFilterLabel = computed(() => {
    this.language.lang();
    const selected = [...this.monthFilter()].sort((a, b) => b.localeCompare(a));
    if (selected.length === 0) {
      return this.transloco.translate('expenses.allMonths');
    }
    if (selected.length === 1) {
      return this.language.formatMonthId(selected[0]);
    }
    if (selected.length <= 3) {
      return selected.map((id) => this.language.formatMonthId(id)).join(' · ');
    }
    return this.transloco.translate('expenses.monthsSelected', { count: selected.length });
  });

  readonly filteredExpenses = computed(() => {
    const category = this.categoryFilter();
    const months = this.monthFilter();
    const status = this.statusFilter();
    const monthSet = months.length > 0 ? new Set(months) : null;

    return this.expenses().filter((expense) => {
      if (category !== 'all' && expense.category !== category) {
        return false;
      }
      if (monthSet) {
        const expenseMonth = expense.date.slice(0, 7);
        if (!monthSet.has(expenseMonth)) {
          return false;
        }
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
      this.monthFilter().length > 0 ||
      this.statusFilter() !== 'all',
  );

  readonly activeFilterCount = computed(() => {
    let n = 0;
    if (this.categoryFilter() !== 'all') n++;
    if (this.monthFilter().length > 0) n++;
    if (this.statusFilter() !== 'all') n++;
    return n;
  });

  readonly form = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    category: this.fb.nonNullable.control<string>(EXPENSE_CATEGORIES[0], Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), Validators.required),
    description: this.fb.nonNullable.control(''),
    addedBy: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    paid: this.fb.nonNullable.control(true),
  });

  fieldInvalid(name: 'title' | 'category' | 'amount' | 'date' | 'addedBy'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  categoryLabel(category: string): string {
    this.language.lang();
    return this.language.categoryLabel(category);
  }

  openFilter(): void {
    this.draftCategory.set(this.categoryFilter());
    this.draftMonth.set([...this.monthFilter()]);
    this.draftStatus.set(this.statusFilter());
    this.filterOpen.set(true);
  }

  closeFilter(): void {
    this.filterOpen.set(false);
  }

  applyFilter(): void {
    this.categoryFilter.set(this.draftCategory());
    this.monthFilter.set([...this.draftMonth()]);
    this.statusFilter.set(this.draftStatus());
    this.filterOpen.set(false);
  }

  clearFiltersInDialog(): void {
    this.draftCategory.set('all');
    this.draftMonth.set([]);
    this.draftStatus.set('all');
  }

  clearFilters(): void {
    this.categoryFilter.set('all');
    this.monthFilter.set([]);
    this.statusFilter.set('all');
    this.draftCategory.set('all');
    this.draftMonth.set([]);
    this.draftStatus.set('all');
  }

  /** Desktop inline filters apply immediately. */
  setCategoryFilter(value: ExpenseCategoryFilter): void {
    this.categoryFilter.set(value);
  }

  setMonthFilter(values: string[]): void {
    this.monthFilter.set(values);
  }

  setDraftMonth(values: string[]): void {
    this.draftMonth.set(values);
  }

  setStatusFilter(value: ExpenseStatusFilter): void {
    this.statusFilter.set(value);
  }

  removeCategoryFilter(): void {
    this.categoryFilter.set('all');
  }

  removeMonthFilter(): void {
    this.monthFilter.set([]);
  }

  removeStatusFilter(): void {
    this.statusFilter.set('all');
  }

  toggleNewCategory(): void {
    this.showNewCategory.update((v) => !v);
    if (!this.showNewCategory()) {
      this.newCategoryName.set('');
    }
  }

  addNewCategory(): void {
    const name = this.newCategoryName().trim();
    if (name.length < 2) {
      this.toast.error(this.transloco.translate('expenses.categoryNameError'));
      return;
    }
    const created = this.store.addCategory(name);
    this.form.controls.category.setValue(created);
    this.newCategoryName.set('');
    this.showNewCategory.set(false);
    this.toast.success(
      this.transloco.translate('expenses.categoryAddedToast', {
        name: this.categoryLabel(created),
      }),
    );
  }

  openCreate(): void {
    this.editingId.set(null);
    this.showNewCategory.set(false);
    this.newCategoryName.set('');
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
    this.showNewCategory.set(false);
    this.newCategoryName.set('');
    // Ensure category is in the picker list (e.g. custom from older data).
    this.store.addCategory(expense.category);
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
    this.showNewCategory.set(false);
    this.newCategoryName.set('');
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

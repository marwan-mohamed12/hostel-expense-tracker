import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EXPENSE_CATEGORIES } from '../../core/constants/app.constants';
import { HostelStore } from '../../core/services/hostel.store';
import { confirmDelete, showSuccessToast } from '../../core/utils/swal-dialog';
import { Expense } from '../../models/expense.model';

@Component({
  selector: 'app-expenses',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './expenses.html',
})
export class ExpensesPage {
  private readonly store = inject(HostelStore);
  private readonly fb = inject(FormBuilder);

  readonly categories = EXPENSE_CATEGORIES;
  readonly expenses = this.store.expensesNewestFirst;
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

  /** Amounts already paid (reduce balance). */
  readonly paidTotal = computed(() =>
    this.expenses()
      .filter((expense) => expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  /** Recorded but not paid yet (do not reduce balance). */
  readonly unpaidTotal = computed(() =>
    this.expenses()
      .filter((expense) => !expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    category: [EXPENSE_CATEGORIES[0] as string, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    description: [''],
    addedBy: ['', [Validators.required, Validators.minLength(2)]],
    paid: [true],
  });

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      title: '',
      category: EXPENSE_CATEGORIES[0],
      amount: 0,
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
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      title: value.title,
      category: value.category,
      amount: value.amount,
      date: value.date,
      description: value.description,
      addedBy: value.addedBy,
      paid: value.paid,
    };

    const editingId = this.editingId();
    if (editingId) {
      this.store.updateExpense(editingId, payload);
    } else {
      this.store.addExpense(payload);
    }

    this.cancelForm();
  }

  setPaid(expense: Expense, paid: boolean): void {
    this.store.markExpensePaid(expense.id, paid);
  }

  async remove(expense: Expense): Promise<void> {
    const confirmed = await confirmDelete({
      title: `Delete expense?`,
      text: `"${expense.title}" will be permanently removed.`,
      confirmButtonText: 'Yes, delete expense',
    });

    if (!confirmed) {
      return;
    }

    this.store.removeExpense(expense.id);
    if (this.editingId() === expense.id) {
      this.cancelForm();
    }

    await showSuccessToast('Expense deleted', `"${expense.title}" was removed.`);
  }
}

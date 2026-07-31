import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EXPENSE_CATEGORIES } from '../../core/constants/app.constants';
import { HostelStore } from '../../core/services/hostel.store';
import { ToastService } from '../../core/services/toast.service';
import { confirmDelete } from '../../core/utils/swal-dialog';
import { Expense } from '../../models/expense.model';

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

  readonly categories = EXPENSE_CATEGORIES;
  readonly expenses = this.store.expensesNewestFirst;
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

  readonly paidTotal = computed(() =>
    this.expenses()
      .filter((expense) => expense.paid)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

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

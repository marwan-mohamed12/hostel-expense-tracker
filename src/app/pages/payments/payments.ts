import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MONTH_NAMES } from '../../core/constants/app.constants';
import { HostelStore } from '../../core/services/hostel.store';
import { confirmDelete, showSuccessToast } from '../../core/utils/swal-dialog';
import { Payment } from '../../models/payment.model';

@Component({
  selector: 'app-payments',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './payments.html',
})
export class PaymentsPage {
  private readonly store = inject(HostelStore);

  readonly monthNames = MONTH_NAMES;
  readonly months = this.store.monthsNewestFirst;
  readonly payments = this.store.payments;
  readonly residents = this.store.residents;

  readonly selectedMonthId = signal(this.store.ensureCurrentMonth().id);
  readonly newYear = signal(new Date().getFullYear());
  readonly newMonth = signal(new Date().getMonth() + 1);

  readonly selectedMonth = computed(() => {
    const id = this.selectedMonthId();
    return (
      this.months().find((month) => month.id === id) ?? {
        id,
        year: Number(id.slice(0, 4)),
        month: Number(id.slice(5, 7)),
        label: id,
        createdAt: '',
      }
    );
  });

  readonly rows = computed(() => {
    const monthId = this.selectedMonthId();
    // Depend on payments + residents so list refreshes after store updates.
    this.payments();
    this.residents();

    // Only active residents are tracked for monthly paid/unpaid.
    const activeIds = new Set(this.store.activeResidents().map((resident) => resident.id));

    return this.store
      .getPaymentsForMonth(monthId)
      .filter((payment) => activeIds.has(payment.residentId))
      .map((payment) => ({
        ...payment,
        residentName: this.store.getResidentName(payment.residentId),
      }))
      .sort((a, b) => a.residentName.localeCompare(b.residentName));
  });

  readonly summary = computed(() => {
    const list = this.rows();
    const paid = list.filter((row) => row.paid);
    const unpaid = list.filter((row) => !row.paid);
    return {
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      collected: paid.reduce((sum, row) => sum + row.amount, 0),
      expected: list.reduce((sum, row) => sum + row.amount, 0),
    };
  });

  selectMonth(monthId: string): void {
    this.store.ensureMonth(monthId);
    this.selectedMonthId.set(monthId);
  }

  createMonth(): void {
    const record = this.store.createMonth(this.newYear(), this.newMonth());
    this.selectedMonthId.set(record.id);
  }

  async deleteMonth(): Promise<void> {
    const month = this.selectedMonth();
    const paymentCount = this.rows().length;
    const paidCount = this.summary().paidCount;
    const paidNote =
      paidCount > 0
        ? ` <strong>(including ${paidCount} marked paid)</strong>`
        : '';

    const confirmed = await confirmDelete({
      title: `Delete ${month.label}?`,
      html:
        `This will permanently remove the month and all <strong>${paymentCount}</strong> payment record(s)` +
        paidNote +
        `.<br><br>Expenses are not affected.`,
      confirmButtonText: 'Yes, delete month',
    });

    if (!confirmed) {
      return;
    }

    const recreated = this.store.removeMonth(month.id);
    if (recreated) {
      // Current month was recreated empty after delete.
      this.selectedMonthId.set(recreated.id);
    } else {
      const remaining = this.store.monthsNewestFirst();
      if (remaining.length > 0) {
        this.selectedMonthId.set(remaining[0].id);
      } else {
        this.selectedMonthId.set(this.store.ensureCurrentMonth().id);
      }
    }

    await showSuccessToast(
      'Month deleted',
      `${month.label} and its payment records were removed.`,
    );
  }

  togglePaid(payment: Payment): void {
    const nextPaid = !payment.paid;
    this.store.markPaymentPaid(
      payment.id,
      nextPaid,
      payment.amount,
      nextPaid ? payment.paidAt || new Date().toISOString().slice(0, 10) : undefined,
    );
  }

  onAmountChange(payment: Payment, value: string | number): void {
    const amount = Number(value);
    if (Number.isNaN(amount) || amount < 0) {
      return;
    }
    this.store.updatePayment(payment.id, { amount });
  }

  onPaidAtChange(payment: Payment, value: string): void {
    if (!payment.paid) {
      return;
    }
    this.store.updatePayment(payment.id, { paidAt: value || null });
  }

  onNotesChange(payment: Payment, value: string): void {
    this.store.updatePayment(payment.id, { notes: value });
  }
}

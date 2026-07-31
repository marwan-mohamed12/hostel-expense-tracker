import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { confirmDelete, showSuccessToast } from '../../core/utils/swal-dialog';
import { Payment } from '../../models/payment.model';

@Component({
  selector: 'app-payments',
  imports: [FormsModule, CurrencyPipe, TranslocoPipe],
  templateUrl: './payments.html',
})
export class PaymentsPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  readonly monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
  readonly months = this.store.monthsNewestFirst;
  readonly payments = this.store.payments;
  readonly residents = this.store.residents;

  readonly selectedMonthId = signal(this.store.ensureCurrentMonth().id);
  readonly newYear = signal(new Date().getFullYear());
  readonly newMonth = signal(new Date().getMonth() + 1);

  readonly selectedMonth = computed(() => {
    this.language.lang();
    const id = this.selectedMonthId();
    const found = this.months().find((month) => month.id === id);
    const year = found?.year ?? Number(id.slice(0, 4));
    const month = found?.month ?? Number(id.slice(5, 7));
    return {
      id,
      year,
      month,
      label: this.language.formatMonthLabel(year, month),
      createdAt: found?.createdAt ?? '',
    };
  });

  readonly monthButtons = computed(() => {
    this.language.lang();
    return this.months().map((month) => ({
      ...month,
      displayLabel: this.language.formatMonthLabel(month.year, month.month),
    }));
  });

  readonly rows = computed(() => {
    const monthId = this.selectedMonthId();
    this.payments();
    this.residents();

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
        ? this.transloco.translate('payments.deletePaidNote', { paidCount })
        : '';

    const confirmed = await confirmDelete({
      title: this.transloco.translate('payments.deleteTitle', { month: month.label }),
      html: this.transloco.translate('payments.deleteHtml', {
        count: paymentCount,
        paidNote,
      }),
      confirmButtonText: this.transloco.translate('payments.deleteConfirm'),
      cancelButtonText: this.transloco.translate('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    const recreated = this.store.removeMonth(month.id);
    if (recreated) {
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
      this.transloco.translate('payments.deletedTitle'),
      this.transloco.translate('payments.deletedText', { month: month.label }),
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

import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { ToastService } from '../../core/services/toast.service';
import { confirmDelete } from '../../core/utils/swal-dialog';
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
  private readonly toast = inject(ToastService);

  readonly monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
  readonly months = this.store.monthsNewestFirst;
  readonly payments = this.store.payments;
  readonly residents = this.store.residents;

  /** Current month is ensured on store boot; open it by default. */
  readonly selectedMonthId = signal(this.store.ensureCurrentMonth().id);
  readonly monthPickerOpen = signal(false);
  readonly calendarYear = signal(Number(this.selectedMonthId().slice(0, 4)));

  /** Optional panel for opening a past month to enter old data. */
  readonly showManualCreate = signal(false);
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

  readonly calendarMonths = computed(() => {
    this.language.lang();
    const year = this.calendarYear();
    const selected = this.selectedMonthId();
    const now = new Date();
    const currentId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const openIds = new Set(this.months().map((m) => m.id));

    return this.monthNumbers.map((month) => {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      return {
        id,
        month,
        shortLabel: this.transloco.translate(`months.${month}`),
        selected: selected === id,
        isCurrent: currentId === id,
        isOpen: openIds.has(id),
      };
    });
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
    const collected = paid.reduce((sum, row) => sum + row.amount, 0);
    const expected = list.reduce((sum, row) => sum + row.amount, 0);
    const total = paid.length + unpaid.length;
    return {
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      collected,
      expected,
      progressPercent: total === 0 ? 0 : Math.round((paid.length / total) * 100),
      amountProgressPercent:
        expected === 0 ? 0 : Math.min(100, Math.round((collected / expected) * 100)),
    };
  });

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Open / select a month — creates it automatically if needed. */
  selectMonth(monthId: string): void {
    this.store.ensureMonth(monthId);
    this.selectedMonthId.set(monthId);
    this.calendarYear.set(Number(monthId.slice(0, 4)));
    this.monthPickerOpen.set(false);
  }

  pickCalendarMonth(month: number): void {
    const year = this.calendarYear();
    this.selectMonth(`${year}-${String(month).padStart(2, '0')}`);
  }

  shiftCalendarYear(delta: number): void {
    this.calendarYear.update((y) => y + delta);
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.selectMonth(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    );
  }

  shiftMonth(delta: number): void {
    const id = this.selectedMonthId();
    let year = Number(id.slice(0, 4));
    let month = Number(id.slice(5, 7)) + delta;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    this.selectMonth(`${year}-${String(month).padStart(2, '0')}`);
  }

  toggleMonthPicker(): void {
    if (!this.monthPickerOpen()) {
      this.calendarYear.set(Number(this.selectedMonthId().slice(0, 4)));
    }
    this.monthPickerOpen.update((open) => !open);
  }

  closeMonthPicker(): void {
    this.monthPickerOpen.set(false);
  }

  toggleManualCreate(): void {
    this.showManualCreate.update((v) => !v);
  }

  /** Explicitly open a past (or any) month for entering old data. */
  createMonth(): void {
    const record = this.store.createMonth(this.newYear(), this.newMonth());
    this.selectedMonthId.set(record.id);
    this.calendarYear.set(record.year);
    this.showManualCreate.set(false);
    this.toast.success(
      this.transloco.translate('payments.monthOpenedToast', {
        month: this.language.formatMonthLabel(record.year, record.month),
      }),
    );
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

    this.toast.success(
      this.transloco.translate('payments.deletedToast', { month: month.label }),
    );
  }

  togglePaid(payment: Payment): void {
    const nextPaid = !payment.paid;
    const residentName = this.store.getResidentName(payment.residentId);
    this.store.markPaymentPaid(
      payment.id,
      nextPaid,
      payment.amount,
      nextPaid ? payment.paidAt || new Date().toISOString().slice(0, 10) : undefined,
    );
    this.toast.success(
      this.transloco.translate(
        nextPaid ? 'payments.markedPaidToast' : 'payments.markedUnpaidToast',
        { name: residentName },
      ),
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

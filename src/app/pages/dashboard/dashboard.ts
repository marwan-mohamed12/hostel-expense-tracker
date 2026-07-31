import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  readonly stats = computed(() => {
    // Recompute labels when language changes.
    this.language.lang();
    this.transloco.getActiveLang();
    const base = this.store.getDashboardStats();
    return {
      ...base,
      monthLabel: this.language.formatMonthId(base.monthId),
    };
  });

  readonly months = this.store.monthsNewestFirst;
  readonly recentExpenses = computed(() => this.store.expensesNewestFirst().slice(0, 5));

  readonly unpaidPayments = computed(() => {
    const monthId = this.stats().monthId;
    const activeIds = new Set(this.store.activeResidents().map((resident) => resident.id));
    return this.store
      .getPaymentsForMonth(monthId)
      .filter((payment) => !payment.paid && activeIds.has(payment.residentId))
      .map((payment) => ({
        ...payment,
        residentName: this.store.getResidentName(payment.residentId),
      }));
  });

  /** Share of active residents paid this month (0–100). */
  readonly paidProgress = computed(() => {
    const s = this.stats();
    const total = s.paidCount + s.unpaidCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((s.paidCount / total) * 100);
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
}

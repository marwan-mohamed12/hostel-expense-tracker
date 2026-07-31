import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { LoadingSpinner } from '../../shared/ui/loading-spinner';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoPipe, LoadingSpinner],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** True while dashboard data is loading (wired for future API). */
  readonly listLoading = this.store.dashboardLoading;

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

  constructor() {
    void this.store.loadDashboard();
  }
}

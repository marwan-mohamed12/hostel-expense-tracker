import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { UserJourneyService } from '../../core/services/user-journey.service';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly journey = inject(UserJourneyService);

  /** Session-only hide of the soft banner (full skip uses journey.complete). */
  readonly bannerDismissed = signal(false);

  /** Selected month for monthly history (defaults to current). */
  readonly selectedMonthId = signal(this.store.ensureCurrentMonth().id);

  readonly months = this.store.monthsNewestFirst;

  readonly monthButtons = computed(() => {
    this.language.lang();
    return this.months().map((month) => ({
      ...month,
      displayLabel: this.language.formatMonthLabel(month.year, month.month),
    }));
  });

  readonly stats = computed(() => {
    // Recompute labels when language changes.
    this.language.lang();
    this.transloco.getActiveLang();
    const base = this.store.getDashboardStats(this.selectedMonthId());
    return {
      ...base,
      monthLabel: this.language.formatMonthId(base.monthId),
    };
  });

  readonly recentExpenses = computed(() => {
    const monthId = this.selectedMonthId();
    return this.store
      .expensesNewestFirst()
      .filter((expense) => expense.date.startsWith(monthId))
      .slice(0, 5);
  });

  /** Show soft CTA when tour not completed and user has little data yet. */
  readonly showJourneyBanner = computed(() => {
    if (this.journey.completed() || this.bannerDismissed() || this.journey.isOpen()) {
      return false;
    }
    return this.store.activeResidents().length === 0;
  });

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

  selectMonth(monthId: string): void {
    this.store.ensureMonth(monthId);
    this.selectedMonthId.set(monthId);
  }

  openJourney(): void {
    this.journey.open(true);
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
    // Remember skip so first-visit auto-open does not nag on reload.
    this.journey.completeAndClose();
  }

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

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

  /** Calendar popover open state. */
  readonly monthPickerOpen = signal(false);

  /** Year shown in the month-grid calendar (independent of selection until a month is picked). */
  readonly calendarYear = signal(Number(this.selectedMonthId().slice(0, 4)));

  readonly monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

  readonly stats = computed(() => {
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

  readonly paidProgress = computed(() => {
    const s = this.stats();
    const total = s.paidCount + s.unpaidCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((s.paidCount / total) * 100);
  });

  /** Months in the calendar year for the grid. */
  readonly calendarMonths = computed(() => {
    this.language.lang();
    const year = this.calendarYear();
    const selected = this.selectedMonthId();
    const now = new Date();
    const currentId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.monthNumbers.map((month) => {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      return {
        id,
        month,
        shortLabel: this.transloco.translate(`months.${month}`),
        selected: selected === id,
        isCurrent: currentId === id,
      };
    });
  });

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

  /** Move selected month by one calendar month. */
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

  categoryLabel(category: string): string {
    this.language.lang();
    return this.language.categoryLabel(category);
  }

  openJourney(): void {
    this.journey.open(true);
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
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

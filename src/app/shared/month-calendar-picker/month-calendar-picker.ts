import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Filter-style multi-select month picker: calendar icon opens a year grid.
 * Empty selection = all months (when allowAll). Tap months to toggle.
 * Months listed in `activityMonthIds` show a highlight dot.
 */
@Component({
  selector: 'app-month-calendar-picker',
  imports: [TranslocoPipe],
  templateUrl: './month-calendar-picker.html',
  styleUrl: './month-calendar-picker.css',
})
export class MonthCalendarPickerComponent {
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /**
   * Selected month ids (`YYYY-MM`). Empty array = show all months
   * (when `allowAll` is true).
   */
  readonly values = input<readonly string[]>([]);
  /** When true, empty selection means “all months” and a clear control is shown. */
  readonly allowAll = input(true);
  /** i18n key for the empty / all-months label. */
  readonly allLabelKey = input('expenses.allMonths');
  /** Month ids that should show an activity dot (e.g. months with expenses). */
  readonly activityMonthIds = input<readonly string[]>([]);
  /** Accessible name for the trigger. */
  readonly ariaLabelKey = input('dashboard.pickMonth');

  readonly valuesChange = output<string[]>();

  readonly open = signal(false);
  readonly calendarYear = signal(new Date().getFullYear());

  readonly selectedSet = computed(() => new Set(this.values()));

  readonly hasSelection = computed(() => this.values().length > 0);

  readonly displayLabel = computed(() => {
    this.language.lang();
    const selected = [...this.values()].sort((a, b) => b.localeCompare(a));
    if (selected.length === 0) {
      return this.transloco.translate(this.allLabelKey());
    }
    if (selected.length === 1) {
      return this.language.formatMonthId(selected[0]);
    }
    if (selected.length <= 3) {
      return selected.map((id) => this.language.formatMonthId(id)).join(' · ');
    }
    return this.transloco.translate('expenses.monthsSelected', { count: selected.length });
  });

  readonly calendarMonths = computed(() => {
    this.language.lang();
    const year = this.calendarYear();
    const selected = this.selectedSet();
    const activity = new Set(this.activityMonthIds());
    const now = new Date();
    const currentId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return MONTH_NUMBERS.map((month) => {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      return {
        id,
        month,
        shortLabel: this.transloco.translate(`months.${month}`),
        selected: selected.has(id),
        isCurrent: currentId === id,
        hasActivity: activity.has(id),
      };
    });
  });

  toggle(): void {
    if (!this.open()) {
      this.syncYearFromValues();
    }
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  shiftYear(delta: number): void {
    this.calendarYear.update((y) => y + delta);
  }

  /** Toggle a month in the multi-select (popover stays open). */
  toggleMonth(month: number): void {
    const year = this.calendarYear();
    const id = `${year}-${String(month).padStart(2, '0')}`;
    const current = [...this.values()];
    if (current.includes(id)) {
      this.valuesChange.emit(current.filter((m) => m !== id));
    } else {
      this.valuesChange.emit([...current, id]);
    }
  }

  /** Clear selection → all months (empty array). */
  clearSelection(): void {
    this.valuesChange.emit([]);
  }

  /** Open grid on newest selected year, else current year. */
  private syncYearFromValues(): void {
    const selected = [...this.values()].sort((a, b) => b.localeCompare(a));
    if (selected.length > 0 && selected[0].length >= 4) {
      const y = Number(selected[0].slice(0, 4));
      if (y) {
        this.calendarYear.set(y);
        return;
      }
    }
    this.calendarYear.set(new Date().getFullYear());
  }
}

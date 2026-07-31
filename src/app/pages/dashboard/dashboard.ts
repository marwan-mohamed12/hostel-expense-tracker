import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ChartComponent,
} from 'ng-apexcharts';
import { LanguageService } from '../../core/i18n/language.service';
import { HostelStore } from '../../core/services/hostel.store';
import { ThemeService } from '../../core/services/theme.service';
import { UserJourneyService } from '../../core/services/user-journey.service';

const CATEGORY_COLORS = [
  '#0d9488',
  '#0ea5e9',
  '#f43f5e',
  '#f59e0b',
  '#8b5cf6',
  '#14b8a6',
  '#6366f1',
  '#ec4899',
];

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoPipe, ChartComponent],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly journey = inject(UserJourneyService);
  private readonly theme = inject(ThemeService);

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

  // --- Phase 3: analytics data ---

  /** Reactive monthly series (depends on store signals via method reads). */
  readonly monthlySeries = computed(() => {
    // Touch store signals so charts refresh when data changes.
    this.store.payments();
    this.store.expenses();
    this.store.months();
    this.store.residents();
    this.language.lang();
    return this.store.getMonthlyChartSeries(12);
  });

  readonly categoryBreakdown = computed(() => {
    this.store.expenses();
    this.language.lang();
    return this.store.getCategoryBreakdown(8);
  });

  readonly balanceTimeline = computed(() => {
    this.store.payments();
    this.store.expenses();
    this.store.residents();
    this.language.lang();
    return this.store.getBalanceTimeline(40);
  });

  readonly hasMonthlyCharts = computed(() => this.monthlySeries().length > 0);
  readonly hasCategoryChart = computed(() => this.categoryBreakdown().length > 0);
  readonly hasTimeline = computed(() => this.balanceTimeline().length > 0);

  /**
   * Remount key so ApexCharts fully rebuilds on data/theme/lang change
   * (signal inputs do not always drive ngOnChanges updates).
   */
  readonly chartMountKey = computed(() => {
    const months = this.monthlySeries()
      .map((m) => `${m.monthId}:${m.expenses}:${m.collectionRate}:${m.balanceEnd}`)
      .join('|');
    const cats = this.categoryBreakdown()
      .map((c) => `${c.category}:${c.amount}`)
      .join('|');
    return `${months}#${cats}#${this.theme.isDark()}#${this.language.lang()}`;
  });

  readonly monthLabels = computed(() =>
    this.monthlySeries().map((point) => this.language.formatMonthId(point.monthId)),
  );

  readonly expensesSeries = computed((): ApexAxisChartSeries => [
    {
      name: this.transloco.translate('dashboard.chartExpensesSeries'),
      data: this.monthlySeries().map((point) => Math.round(point.expenses * 100) / 100),
    },
  ]);

  readonly collectionSeries = computed((): ApexAxisChartSeries => [
    {
      name: this.transloco.translate('dashboard.chartCollectionSeries'),
      data: this.monthlySeries().map((point) =>
        point.collectionRate === null ? 0 : point.collectionRate,
      ),
    },
  ]);

  readonly balanceSeries = computed((): ApexAxisChartSeries => [
    {
      name: this.transloco.translate('dashboard.chartBalanceSeries'),
      data: this.monthlySeries().map((point) => Math.round(point.balanceEnd * 100) / 100),
    },
  ]);

  readonly categorySeries = computed((): ApexNonAxisChartSeries =>
    this.categoryBreakdown().map((item) => Math.round(item.amount * 100) / 100),
  );

  readonly categoryLabels = computed(() =>
    this.categoryBreakdown().map((item) => this.language.categoryLabel(item.category)),
  );

  readonly expensesChart = computed((): ApexChart => this.baseAxisChart('bar'));
  readonly collectionChart = computed((): ApexChart => this.baseAxisChart('line'));
  readonly balanceChart = computed((): ApexChart => this.baseAxisChart('area'));
  readonly categoryChart = computed((): ApexChart => ({
    ...this.baseChartShell('donut'),
    height: 280,
  }));

  readonly expensesXaxis = computed((): ApexXAxis => this.categoryXaxis(this.monthLabels()));
  readonly collectionXaxis = computed((): ApexXAxis => this.categoryXaxis(this.monthLabels()));
  readonly balanceXaxis = computed((): ApexXAxis => this.categoryXaxis(this.monthLabels()));

  readonly moneyYaxis = computed((): ApexYAxis => ({
    labels: {
      formatter: (value: number) => this.formatCompactMoney(value),
      style: { colors: this.axisColor() },
    },
  }));

  readonly percentYaxis = computed((): ApexYAxis => ({
    min: 0,
    max: 100,
    tickAmount: 4,
    labels: {
      formatter: (value: number) => `${Math.round(value)}%`,
      style: { colors: this.axisColor() },
    },
  }));

  readonly moneyTooltip = computed((): ApexTooltip => ({
    theme: this.theme.isDark() ? 'dark' : 'light',
    y: {
      formatter: (value: number) => this.formatMoney(value),
    },
  }));

  readonly percentTooltip = computed((): ApexTooltip => ({
    theme: this.theme.isDark() ? 'dark' : 'light',
    y: {
      formatter: (value: number) => `${value}%`,
    },
  }));

  readonly expensesStroke = computed((): ApexStroke => ({
    show: true,
    width: 2,
    colors: ['transparent'],
  }));

  readonly collectionStroke = computed((): ApexStroke => ({
    curve: 'smooth',
    width: 3,
  }));

  readonly balanceStroke = computed((): ApexStroke => ({
    curve: 'smooth',
    width: 2,
  }));

  readonly balanceFill = computed((): ApexFill => ({
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0.05,
      stops: [0, 90, 100],
    },
  }));

  readonly barPlotOptions = computed((): ApexPlotOptions => ({
    bar: {
      borderRadius: 6,
      columnWidth: '55%',
    },
  }));

  readonly donutPlotOptions = computed((): ApexPlotOptions => ({
    pie: {
      donut: {
        size: '68%',
        labels: {
          show: true,
          name: {
            show: true,
            fontSize: '12px',
            color: this.axisColor(),
          },
          value: {
            show: true,
            fontSize: '16px',
            fontWeight: 700,
            color: this.axisColor(),
            formatter: (value: string) => this.formatCompactMoney(Number(value)),
          },
          total: {
            show: true,
            label: this.transloco.translate('dashboard.chartCategoriesTotal'),
            color: this.mutedColor(),
            formatter: (w: { globals: { seriesTotals: number[] } }) => {
              const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
              return this.formatCompactMoney(total);
            },
          },
        },
      },
    },
  }));

  readonly dataLabelsOff = computed((): ApexDataLabels => ({ enabled: false }));

  readonly chartGrid = computed((): ApexGrid => ({
    borderColor: this.theme.isDark() ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    strokeDashArray: 4,
    padding: { left: 8, right: 8 },
  }));

  readonly chartLegend = computed((): ApexLegend => ({
    labels: { colors: this.axisColor() },
    fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif',
  }));

  readonly expensesColors = ['#f43f5e'];
  readonly collectionColors = ['#0ea5e9'];
  readonly balanceColors = ['#0d9488'];
  readonly categoryColors = CATEGORY_COLORS;

  /**
   * Browse a month from the calendar without creating an empty shell.
   * Current / already-open months stay available; unused browsed months are pruned.
   */
  selectMonth(monthId: string): void {
    this.store.prepareMonthView(monthId);
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

  formatMonthId(monthId: string): string {
    this.language.lang();
    return this.language.formatMonthId(monthId);
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

  private baseAxisChart(type: 'bar' | 'line' | 'area'): ApexChart {
    return {
      ...this.baseChartShell(type),
      height: 260,
      toolbar: { show: false },
      zoom: { enabled: false },
    };
  }

  private baseChartShell(type: ApexChart['type']): ApexChart {
    return {
      type,
      fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif',
      foreColor: this.axisColor(),
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
    };
  }

  private categoryXaxis(categories: string[]): ApexXAxis {
    return {
      categories,
      labels: {
        style: {
          colors: categories.map(() => this.axisColor()),
          fontSize: '11px',
        },
        rotate: categories.length > 6 ? -35 : 0,
        hideOverlappingLabels: true,
      },
      axisBorder: { color: this.theme.isDark() ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
      axisTicks: { color: this.theme.isDark() ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
    };
  }

  private axisColor(): string {
    return this.theme.isDark() ? '#cbd5e1' : '#475569';
  }

  private mutedColor(): string {
    return this.theme.isDark() ? '#94a3b8' : '#64748b';
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language.lang() === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  private formatCompactMoney(value: number): string {
    const n = value || 0;
    if (Math.abs(n) >= 1000) {
      return `${Math.round(n / 100) / 10}k`;
    }
    return String(Math.round(n));
  }
}

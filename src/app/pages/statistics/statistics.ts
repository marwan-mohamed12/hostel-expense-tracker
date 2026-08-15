import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
import { AuthService } from '../../core/services/auth.service';
import { HostelStore } from '../../core/services/hostel.store';
import { ThemeService } from '../../core/services/theme.service';

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
  selector: 'app-statistics',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoPipe, ChartComponent],
  templateUrl: './statistics.html',
})
export class StatisticsPage {
  private readonly store = inject(HostelStore);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);

  readonly monthlySeries = computed(() => {
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
      name: this.transloco.translate('statistics.chartExpensesSeries'),
      data: this.monthlySeries().map((point) => Math.round(point.expenses * 100) / 100),
    },
  ]);

  readonly collectionSeries = computed((): ApexAxisChartSeries => [
    {
      name: this.transloco.translate('statistics.chartCollectionSeries'),
      data: this.monthlySeries().map((point) =>
        point.collectionRate === null ? 0 : point.collectionRate,
      ),
    },
  ]);

  readonly balanceSeries = computed((): ApexAxisChartSeries => [
    {
      name: this.transloco.translate('statistics.chartBalanceSeries'),
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
            label: this.transloco.translate('statistics.chartCategoriesTotal'),
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

  categoryLabel(category: string): string {
    this.language.lang();
    return this.language.categoryLabel(category);
  }

  formatMonthId(monthId: string): string {
    this.language.lang();
    return this.language.formatMonthId(monthId);
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

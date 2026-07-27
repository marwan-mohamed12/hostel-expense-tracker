import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HostelStore } from '../../core/services/hostel.store';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly store = inject(HostelStore);

  readonly stats = computed(() => this.store.getDashboardStats());
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
}

import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard';
import { ExpensesPage } from './pages/expenses/expenses';
import { PaymentsPage } from './pages/payments/payments';
import { ResidentsPage } from './pages/residents/residents';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DashboardPage },
  { path: 'residents', component: ResidentsPage },
  { path: 'payments', component: PaymentsPage },
  { path: 'expenses', component: ExpensesPage },
  { path: '**', redirectTo: '' },
];

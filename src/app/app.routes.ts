import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { DashboardPage } from './pages/dashboard/dashboard';
import { ExpensesPage } from './pages/expenses/expenses';
import { LoginPage } from './pages/login/login';
import { PaymentsPage } from './pages/payments/payments';
import { ResidentsPage } from './pages/residents/residents';

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: DashboardPage },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./pages/statistics/statistics').then((m) => m.StatisticsPage),
      },
      { path: 'residents', component: ResidentsPage },
      { path: 'payments', component: PaymentsPage },
      { path: 'expenses', component: ExpensesPage },
    ],
  },
  { path: '**', redirectTo: '' },
];

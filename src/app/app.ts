import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { LanguageService } from './core/i18n/language.service';
import { LoadingSpinner } from './shared/ui/loading-spinner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, LoadingSpinner],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  readonly language = inject(LanguageService);

  readonly menuOpen = signal(false);

  readonly navItems = [
    { path: '/', labelKey: 'nav.dashboard', exact: true },
    { path: '/residents', labelKey: 'nav.residents', exact: false },
    { path: '/payments', labelKey: 'nav.payments', exact: false },
    { path: '/expenses', labelKey: 'nav.expenses', exact: false },
  ] as const;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  switchLanguage(): void {
    this.language.toggle();
  }
}

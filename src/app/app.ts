import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/services/theme.service';
import { UserJourneyService } from './core/services/user-journey.service';
import { ToastHostComponent } from './shared/toast/toast-host';
import { UserJourneyComponent } from './shared/user-journey/user-journey';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    ToastHostComponent,
    UserJourneyComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  readonly language = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly journey = inject(UserJourneyService);

  readonly menuOpen = signal(false);

  readonly themeAriaKey = computed(() => {
    const pref = this.theme.preference();
    if (pref === 'dark') {
      return 'theme.ariaDark';
    }
    if (pref === 'system') {
      return 'theme.ariaSystem';
    }
    return 'theme.ariaLight';
  });

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

    // First visit: open guided tour after shell paints.
    this.journey.maybeAutoOpen();
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

  cycleTheme(): void {
    this.theme.cycle();
  }

  openJourney(): void {
    this.journey.open(true);
    this.menuOpen.set(false);
  }
}

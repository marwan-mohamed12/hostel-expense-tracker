import { Injectable, computed, signal } from '@angular/core';

/** Stored user preference. `system` follows OS color scheme. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Effective theme applied to the document. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hostel-expense-tracker-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mediaQuery =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  private readonly systemDark = signal(this.mediaQuery?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.readStoredOrDefault());

  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return pref;
  });

  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    this.apply(this.resolved());
    this.mediaQuery?.addEventListener('change', (event) => {
      this.systemDark.set(event.matches);
      if (this.preference() === 'system') {
        this.apply(event.matches ? 'dark' : 'light');
      }
    });
  }

  /** Re-apply current resolved theme (e.g. after bootstrap). */
  init(): void {
    this.apply(this.resolved());
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // ignore quota / private mode
    }
    this.apply(this.resolved());
  }

  /** Cycle: light → dark → system → light */
  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const current = this.preference();
    const next = order[(order.indexOf(current) + 1) % order.length]!;
    this.setPreference(next);
  }

  private apply(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    root.dataset['theme'] = this.preference();
  }

  private readStoredOrDefault(): ThemePreference {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'system';
  }
}

import { inject, Injectable, signal } from '@angular/core';
import { getBrowserLang, TranslocoService } from '@jsverse/transloco';

export type AppLang = 'en' | 'ar';

const LANG_STORAGE_KEY = 'hostel-expense-tracker-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly lang = signal<AppLang>(this.readStoredOrDefault());

  /** Apply dir/lang/title after translations for the active lang are available. */
  init(): void {
    this.applyDocument(this.lang());
  }

  setLanguage(lang: AppLang): void {
    this.lang.set(lang);
    this.transloco.setActiveLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore quota / private mode
    }

    this.transloco.load(lang).subscribe({
      next: () => this.applyDocument(lang),
      error: () => this.applyDocument(lang),
    });
  }

  toggle(): void {
    this.setLanguage(this.lang() === 'ar' ? 'en' : 'ar');
  }

  /** Localized month label from year + month number (1–12). */
  formatMonthLabel(year: number, month: number): string {
    const name = this.transloco.translate(`months.${month}`);
    return this.transloco.translate('months.label', { name, year });
  }

  formatMonthId(monthId: string): string {
    const year = Number(monthId.slice(0, 4));
    const month = Number(monthId.slice(5, 7));
    if (!year || !month) {
      return monthId;
    }
    return this.formatMonthLabel(year, month);
  }

  categoryLabel(category: string): string {
    const key = `categories.${category}`;
    const translated = this.transloco.translate(key);
    return translated === key ? category : translated;
  }

  private applyDocument(lang: AppLang): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const title = this.transloco.translate('app.documentTitle');
    if (title && title !== 'app.documentTitle') {
      document.title = title;
    }
  }

  private readStoredOrDefault(): AppLang {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'en' || stored === 'ar') {
        return stored;
      }
    } catch {
      // ignore
    }
    const browser = getBrowserLang();
    return browser === 'ar' ? 'ar' : 'en';
  }
}

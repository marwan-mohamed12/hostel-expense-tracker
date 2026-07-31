import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { App } from './app';
import { LanguageService } from './core/i18n/language.service';

const en = {
  app: { brand: 'Hostel', title: 'Expense Tracker', documentTitle: 'Hostel Expense Tracker' },
  nav: {
    dashboard: 'Dashboard',
    residents: 'Residents',
    payments: 'Payments',
    expenses: 'Expenses',
    mainAria: 'Main',
    mobileAria: 'Mobile',
    toggleMenu: 'Toggle navigation menu',
  },
  lang: { switchTo: 'العربية', switchToEn: 'English', aria: 'Switch language' },
  theme: {
    ariaLight: 'Theme: light',
    ariaDark: 'Theme: dark',
    ariaSystem: 'Theme: system',
  },
  journey: {
    openAria: 'Open guided tour',
    navLabel: 'How it works',
  },
};

describe('App', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
          },
          loader: class {
            getTranslation() {
              return of(en);
            }
          },
        }),
        LanguageService,
      ],
    }).compileComponents();

    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(en, 'en');
    transloco.setActiveLang('en');
    TestBed.inject(LanguageService).init();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app shell title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Expense Tracker');
  });
});

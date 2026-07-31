import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideToastr } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideToastr({
      timeOut: 2800,
      extendedTimeOut: 1200,
      progressBar: true,
      closeButton: true,
      newestOnTop: true,
      preventDuplicates: true,
      positionClass: 'toast-top-right',
    }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: true,
        fallbackLang: 'en',
        missingHandler: {
          useFallbackTranslation: true,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const language = inject(LanguageService);
      const transloco = inject(TranslocoService);
      const lang = language.lang();
      const fallbackLang = 'en' as const;
      transloco.setActiveLang(lang);

      // Never let a missing/failed i18n asset block SPA bootstrap.
      return firstValueFrom(transloco.load(lang))
        .catch(async (err) => {
          console.error(`[i18n] Failed to load language "${lang}"`, err);
          if (lang !== fallbackLang) {
            transloco.setActiveLang(fallbackLang);
            try {
              await firstValueFrom(transloco.load(fallbackLang));
            } catch (fallbackErr) {
              console.error(`[i18n] Failed to load fallback language "${fallbackLang}"`, fallbackErr);
            }
          }
        })
        .then(() => {
          language.init();
        });
    }),
  ],
};

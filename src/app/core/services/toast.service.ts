import { inject, Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { LanguageService } from '../i18n/language.service';

/**
 * Thin wrapper around ngx-toastr with RTL-aware corner placement.
 * Use for non-blocking success feedback after mutations.
 * Keep SweetAlert2 for destructive confirms only.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastr = inject(ToastrService);
  private readonly language = inject(LanguageService);

  success(title: string, message?: string): void {
    this.toastr.success(message ?? '', title, {
      positionClass: this.positionClass(),
    });
  }

  info(title: string, message?: string): void {
    this.toastr.info(message ?? '', title, {
      positionClass: this.positionClass(),
    });
  }

  error(title: string, message?: string): void {
    this.toastr.error(message ?? '', title, {
      positionClass: this.positionClass(),
    });
  }

  private positionClass(): string {
    // Arabic (RTL): toast on the start edge (visually left).
    return this.language.lang() === 'ar' ? 'toast-top-left' : 'toast-top-right';
  }
}

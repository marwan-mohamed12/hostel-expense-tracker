import { inject, Injectable } from '@angular/core';
import { ToastService as AngularToastifyService } from 'angular-toastify';

/**
 * App-facing toast API (single sentence).
 * Wraps angular-toastify. Keep SweetAlert2 for destructive confirms only.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastify = inject(AngularToastifyService);

  success(message: string): void {
    this.toastify.success(message);
  }

  info(message: string): void {
    this.toastify.info(message);
  }

  error(message: string): void {
    this.toastify.error(message);
  }
}

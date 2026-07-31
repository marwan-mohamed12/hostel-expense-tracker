import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Shared loading indicator.
 * - Inline (default): block content while a list/page loads.
 * - Overlay: full-screen dimmed card while language (or global work) loads.
 *
 * Ready for backend: pages flip loading flags around async API calls.
 */
@Component({
  selector: 'app-loading-spinner',
  imports: [TranslocoPipe],
  template: `
    @if (overlay()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          class="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-lg"
        >
          <span
            class="inline-block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600"
            aria-hidden="true"
          ></span>
          <p class="text-sm font-medium text-slate-700">{{ labelKey() | transloco }}</p>
        </div>
      </div>
    } @else {
      <div
        class="flex flex-col items-center justify-center gap-3 px-4 py-12"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span
          class="inline-block animate-spin rounded-full border-4 border-slate-200 border-t-teal-600"
          [class.size-8]="size() === 'sm'"
          [class.size-10]="size() === 'md'"
          [class.size-12]="size() === 'lg'"
          aria-hidden="true"
        ></span>
        <p class="text-sm font-medium text-slate-600">{{ labelKey() | transloco }}</p>
      </div>
    }
  `,
})
export class LoadingSpinner {
  /** Full-viewport overlay (language switch, global work). */
  readonly overlay = input(false);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Transloco key for the status label. */
  readonly labelKey = input('common.loading');
}

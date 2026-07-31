import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss duration in ms. */
  duration: number;
  createdAt: number;
}

const DEFAULT_DURATION = 2800;
const MAX_VISIBLE = 4;

/**
 * App-facing toast API (single sentence).
 * Custom in-app toasts — keep SweetAlert2 for destructive confirms only.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Active toasts (newest first). */
  readonly toasts = signal<ToastItem[]>([]);

  success(message: string, duration = DEFAULT_DURATION): void {
    this.push('success', message, duration);
  }

  info(message: string, duration = DEFAULT_DURATION): void {
    this.push('info', message, duration);
  }

  error(message: string, duration = DEFAULT_DURATION): void {
    this.push('error', message, duration);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }
    this.toasts.set([]);
  }

  private push(kind: ToastKind, message: string, duration: number): void {
    const text = message.trim();
    if (!text) {
      return;
    }

    // Prevent exact duplicates that are still visible.
    const existing = this.toasts().find((t) => t.kind === kind && t.message === text);
    if (existing) {
      this.restartTimer(existing.id, existing.duration);
      // Bump to top so the user sees the refresh.
      this.toasts.update((list) => [
        existing,
        ...list.filter((t) => t.id !== existing.id),
      ]);
      return;
    }

    const item: ToastItem = {
      id: this.nextId++,
      kind,
      message: text,
      duration,
      createdAt: Date.now(),
    };

    this.toasts.update((list) => {
      const next = [item, ...list];
      // Drop oldest beyond cap (and clear their timers).
      if (next.length > MAX_VISIBLE) {
        for (const dropped of next.slice(MAX_VISIBLE)) {
          this.clearTimer(dropped.id);
        }
        return next.slice(0, MAX_VISIBLE);
      }
      return next;
    });

    this.scheduleDismiss(item.id, duration);
  }

  private scheduleDismiss(id: number, duration: number): void {
    this.clearTimer(id);
    if (duration <= 0) {
      return;
    }
    const handle = setTimeout(() => this.dismiss(id), duration);
    this.timers.set(id, handle);
  }

  private restartTimer(id: number, duration: number): void {
    this.scheduleDismiss(id, duration);
  }

  private clearTimer(id: number): void {
    const handle = this.timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.timers.delete(id);
    }
  }
}

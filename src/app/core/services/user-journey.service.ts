import { Injectable, signal } from '@angular/core';

/** localStorage key: whether the guided tour was finished or skipped. */
export const USER_JOURNEY_STORAGE_KEY = 'hostel-expense-tracker-journey-v1';

export type JourneyStepId =
  | 'welcome'
  | 'residents'
  | 'payments'
  | 'expenses'
  | 'dashboard'
  | 'ready';

export interface JourneyStepDef {
  id: JourneyStepId;
  /** Optional in-app route to open when the user picks "Open page". */
  route?: string;
}

/** Ordered product tour — matches the real hostel workflow. */
export const JOURNEY_STEPS: readonly JourneyStepDef[] = [
  { id: 'welcome' },
  { id: 'residents', route: '/residents' },
  { id: 'payments', route: '/payments' },
  { id: 'expenses', route: '/expenses' },
  { id: 'dashboard', route: '/' },
  { id: 'ready' },
] as const;

@Injectable({ providedIn: 'root' })
export class UserJourneyService {
  readonly isOpen = signal(false);
  readonly stepIndex = signal(0);
  /** True once the user finished or skipped (persisted). */
  readonly completed = signal(this.readCompleted());

  readonly totalSteps = JOURNEY_STEPS.length;

  get currentStep(): JourneyStepDef {
    return JOURNEY_STEPS[this.stepIndex()] ?? JOURNEY_STEPS[0]!;
  }

  /** Open the tour at step 0 (or keep current if reopening mid-flow is desired). */
  open(fromStart = true): void {
    if (fromStart) {
      this.stepIndex.set(0);
    }
    this.isOpen.set(true);
  }

  /** First-visit auto open only when the tour has never been completed. */
  maybeAutoOpen(): void {
    if (!this.completed()) {
      // Brief delay so the shell paints first.
      setTimeout(() => {
        if (!this.completed() && !this.isOpen()) {
          this.open(true);
        }
      }, 600);
    }
  }

  closeWithoutCompleting(): void {
    this.isOpen.set(false);
  }

  /** Skip or finish — remember so we don't auto-show again. */
  completeAndClose(): void {
    this.completed.set(true);
    this.persistCompleted(true);
    this.isOpen.set(false);
  }

  next(): void {
    const i = this.stepIndex();
    if (i >= this.totalSteps - 1) {
      this.completeAndClose();
      return;
    }
    this.stepIndex.set(i + 1);
  }

  prev(): void {
    const i = this.stepIndex();
    if (i > 0) {
      this.stepIndex.set(i - 1);
    }
  }

  goToStep(index: number): void {
    if (index >= 0 && index < this.totalSteps) {
      this.stepIndex.set(index);
    }
  }

  resetCompletion(): void {
    this.completed.set(false);
    this.persistCompleted(false);
  }

  private readCompleted(): boolean {
    try {
      return localStorage.getItem(USER_JOURNEY_STORAGE_KEY) === 'done';
    } catch {
      return false;
    }
  }

  private persistCompleted(done: boolean): void {
    try {
      if (done) {
        localStorage.setItem(USER_JOURNEY_STORAGE_KEY, 'done');
      } else {
        localStorage.removeItem(USER_JOURNEY_STORAGE_KEY);
      }
    } catch {
      // ignore quota / private mode
    }
  }
}

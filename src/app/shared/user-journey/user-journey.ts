import { Component, HostListener, OnDestroy, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  JOURNEY_STEPS,
  JourneyStepId,
  UserJourneyService,
} from '../../core/services/user-journey.service';

@Component({
  selector: 'app-user-journey',
  imports: [TranslocoPipe],
  templateUrl: './user-journey.html',
  styleUrl: './user-journey.css',
})
export class UserJourneyComponent implements OnDestroy {
  readonly journey = inject(UserJourneyService);
  private readonly router = inject(Router);

  readonly steps = JOURNEY_STEPS;

  readonly stepId = computed<JourneyStepId>(() => {
    const idx = this.journey.stepIndex();
    return this.steps[idx]?.id ?? 'welcome';
  });

  readonly isFirst = computed(() => this.journey.stepIndex() === 0);
  readonly isLast = computed(() => this.journey.stepIndex() === this.journey.totalSteps - 1);

  readonly progressPercent = computed(() => {
    const total = this.journey.totalSteps;
    if (total <= 1) {
      return 100;
    }
    return Math.round((this.journey.stepIndex() / (total - 1)) * 100);
  });

  readonly routeForStep = computed(() => this.steps[this.journey.stepIndex()]?.route ?? null);

  /** Bullet list keys for the active step (empty array when none). */
  readonly bulletKeys = computed(() => {
    const id = this.stepId();
    const counts: Record<JourneyStepId, number> = {
      welcome: 3,
      residents: 3,
      payments: 3,
      expenses: 3,
      dashboard: 3,
      ready: 3,
    };
    const n = counts[id] ?? 0;
    return Array.from({ length: n }, (_, i) => `journey.steps.${id}.bullets.${i}`);
  });

  private previousBodyOverflow = '';

  constructor() {
    effect(() => {
      const open = this.journey.isOpen();
      if (typeof document === 'undefined') {
        return;
      }
      if (open) {
        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this.previousBodyOverflow;
      }
    });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.previousBodyOverflow || '';
    }
  }

  /** i18n key for the active step field. */
  stepKey(part: 'title' | 'body'): string {
    return `journey.steps.${this.stepId()}.${part}`;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.journey.isOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.skip();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      // Respect document direction: in RTL, "forward" is ArrowLeft visually.
      const rtl = document.documentElement.dir === 'rtl';
      const forward = event.key === 'ArrowRight' ? !rtl : rtl;
      event.preventDefault();
      if (forward) {
        this.journey.next();
      } else {
        this.journey.prev();
      }
    }
  }

  skip(): void {
    this.journey.completeAndClose();
  }

  next(): void {
    this.journey.next();
  }

  prev(): void {
    this.journey.prev();
  }

  finish(): void {
    this.journey.completeAndClose();
  }

  openPage(): void {
    const route = this.routeForStep();
    if (!route) {
      return;
    }
    void this.router.navigateByUrl(route);
    // Keep tour open so the user can continue reading after landing.
  }

  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.skip();
    }
  }
}

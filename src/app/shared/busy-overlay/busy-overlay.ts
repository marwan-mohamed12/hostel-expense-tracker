import { Component, effect, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HostelStore } from '../../core/services/hostel.store';

@Component({
  selector: 'app-busy-overlay',
  imports: [TranslocoPipe],
  templateUrl: './busy-overlay.html',
  styleUrl: './busy-overlay.css',
})
export class BusyOverlayComponent {
  readonly store = inject(HostelStore);
  readonly visible = signal(false);

  constructor() {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    effect((onCleanup) => {
      const busy = this.store.busy();
      if (busy) {
        showTimer = setTimeout(() => this.visible.set(true), 120);
      } else {
        this.visible.set(false);
      }
      onCleanup(() => {
        if (showTimer) {
          clearTimeout(showTimer);
        }
      });
    });
  }
}

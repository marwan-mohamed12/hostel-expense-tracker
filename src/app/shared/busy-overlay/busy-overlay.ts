import { Component, inject } from '@angular/core';
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
}

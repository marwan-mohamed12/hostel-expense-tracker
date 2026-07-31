import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DEFAULT_MONTHLY_FEE } from '../../core/constants/app.constants';
import { HostelStore } from '../../core/services/hostel.store';
import { ToastService } from '../../core/services/toast.service';
import { confirmDelete } from '../../core/utils/swal-dialog';
import { Resident } from '../../models/resident.model';

@Component({
  selector: 'app-residents',
  imports: [ReactiveFormsModule, CurrencyPipe, TranslocoPipe],
  templateUrl: './residents.html',
})
export class ResidentsPage {
  private readonly store = inject(HostelStore);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(ToastService);

  readonly residents = this.store.residents;
  readonly filter = signal<'all' | 'active' | 'inactive'>('all');
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

  readonly filterOptions = [
    { id: 'all' as const, labelKey: 'common.all' },
    { id: 'active' as const, labelKey: 'common.active' },
    { id: 'inactive' as const, labelKey: 'common.inactive' },
  ];

  readonly filteredResidents = computed(() => {
    const list = [...this.residents()].sort((a, b) => a.name.localeCompare(b.name));
    const filter = this.filter();
    if (filter === 'active') {
      return list.filter((resident) => resident.active);
    }
    if (filter === 'inactive') {
      return list.filter((resident) => !resident.active);
    }
    return list;
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    room: [''],
    monthlyFee: [DEFAULT_MONTHLY_FEE, [Validators.required, Validators.min(0)]],
    active: [true],
    notes: [''],
  });

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      phone: '',
      room: '',
      monthlyFee: DEFAULT_MONTHLY_FEE,
      active: true,
      notes: '',
    });
    this.showForm.set(true);
  }

  openEdit(resident: Resident): void {
    this.editingId.set(resident.id);
    this.form.setValue({
      name: resident.name,
      phone: resident.phone,
      room: resident.room,
      monthlyFee: resident.monthlyFee,
      active: resident.active,
      notes: resident.notes,
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      phone: value.phone,
      room: value.room,
      monthlyFee: value.monthlyFee,
      active: value.active,
      notes: value.notes,
    };

    const editingId = this.editingId();
    if (editingId) {
      this.store.updateResident(editingId, payload);
      this.toast.success(
        this.transloco.translate('residents.updatedToast', { name: payload.name }),
      );
    } else {
      this.store.addResident(payload);
      this.toast.success(
        this.transloco.translate('residents.createdToast', { name: payload.name }),
      );
    }

    this.cancelForm();
  }

  toggleActive(resident: Resident): void {
    const nextActive = !resident.active;
    this.store.setResidentActive(resident.id, nextActive);
    this.toast.success(
      this.transloco.translate(
        nextActive ? 'residents.activatedToast' : 'residents.deactivatedToast',
        { name: resident.name },
      ),
    );
  }

  async remove(resident: Resident): Promise<void> {
    const confirmed = await confirmDelete({
      title: this.transloco.translate('residents.removeTitle', { name: resident.name }),
      text: this.transloco.translate('residents.removeText'),
      confirmButtonText: this.transloco.translate('residents.removeConfirm'),
      cancelButtonText: this.transloco.translate('common.cancel'),
    });

    if (!confirmed) {
      return;
    }

    this.store.removeResident(resident.id);
    if (this.editingId() === resident.id) {
      this.cancelForm();
    }

    this.toast.success(
      this.transloco.translate('residents.removedToast', { name: resident.name }),
    );
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}

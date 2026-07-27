import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DEFAULT_MONTHLY_FEE } from '../../core/constants/app.constants';
import { HostelStore } from '../../core/services/hostel.store';
import { confirmDelete, showSuccessToast } from '../../core/utils/swal-dialog';
import { Resident } from '../../models/resident.model';

@Component({
  selector: 'app-residents',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './residents.html',
})
export class ResidentsPage {
  private readonly store = inject(HostelStore);
  private readonly fb = inject(FormBuilder);

  readonly residents = this.store.residents;
  readonly filter = signal<'all' | 'active' | 'inactive'>('all');
  readonly editingId = signal<string | null>(null);
  readonly showForm = signal(false);

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
    } else {
      this.store.addResident(payload);
    }

    this.cancelForm();
  }

  toggleActive(resident: Resident): void {
    this.store.setResidentActive(resident.id, !resident.active);
  }

  async remove(resident: Resident): Promise<void> {
    const confirmed = await confirmDelete({
      title: `Remove ${resident.name}?`,
      text: 'Their payment history for this resident will also be removed.',
      confirmButtonText: 'Yes, remove resident',
    });

    if (!confirmed) {
      return;
    }

    this.store.removeResident(resident.id);
    if (this.editingId() === resident.id) {
      this.cancelForm();
    }

    await showSuccessToast('Resident removed', `${resident.name} was deleted.`);
  }
}

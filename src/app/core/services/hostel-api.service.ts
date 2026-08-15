import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppData } from '../../models/app-data.model';
import { Expense, ExpenseInput } from '../../models/expense.model';
import { MonthRecord, Payment, PaymentUpdate } from '../../models/payment.model';
import { Resident, ResidentInput } from '../../models/resident.model';

@Injectable({ providedIn: 'root' })
export class HostelApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  bootstrap(): Promise<AppData> {
    return firstValueFrom(this.http.get<AppData>(`${this.base}/bootstrap`));
  }

  createResident(input: ResidentInput): Promise<Resident> {
    return firstValueFrom(this.http.post<Resident>(`${this.base}/residents`, input));
  }

  updateResident(id: string, input: ResidentInput): Promise<Resident> {
    return firstValueFrom(this.http.patch<Resident>(`${this.base}/residents/${id}`, input));
  }

  setResidentActive(id: string, active: boolean): Promise<Resident> {
    return firstValueFrom(this.http.patch<Resident>(`${this.base}/residents/${id}/active`, { active }));
  }

  deleteResident(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/residents/${id}`));
  }

  createMonth(monthId: string): Promise<MonthRecord> {
    return firstValueFrom(this.http.post<MonthRecord>(`${this.base}/months`, { monthId }));
  }

  deleteMonth(monthId: string): Promise<MonthRecord | null> {
    return firstValueFrom(
      this.http.delete<MonthRecord>(`${this.base}/months/${monthId}`, { observe: 'response' }),
    ).then((response) => response.body ?? null);
  }

  updatePayment(id: string, update: PaymentUpdate): Promise<Payment> {
    return firstValueFrom(this.http.patch<Payment>(`${this.base}/payments/${id}`, update));
  }

  createExpense(input: ExpenseInput): Promise<Expense> {
    return firstValueFrom(this.http.post<Expense>(`${this.base}/expenses`, input));
  }

  updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
    return firstValueFrom(this.http.patch<Expense>(`${this.base}/expenses/${id}`, input));
  }

  setExpensePaid(id: string, paid: boolean): Promise<Expense> {
    return firstValueFrom(this.http.patch<Expense>(`${this.base}/expenses/${id}/paid`, { paid }));
  }

  deleteExpense(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/expenses/${id}`));
  }

  addCategory(name: string): Promise<string> {
    return firstValueFrom(this.http.post<{ name: string }>(`${this.base}/categories`, { name })).then(
      (response) => response.name,
    );
  }
}

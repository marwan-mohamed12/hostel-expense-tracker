import { Injectable } from '@angular/core';
import { AppData } from '../../models/app-data.model';
import { Expense } from '../../models/expense.model';
import { normalizeExpenseCategory, STORAGE_KEY } from '../constants/app.constants';

const EMPTY_DATA: AppData = {
  residents: [],
  months: [],
  payments: [],
  expenses: [],
};

/**
 * Normalize legacy expense rows:
 * - missing `paid` → true (keep historical balance)
 * - free-text / unknown category → known preset or Other
 */
function normalizeExpense(raw: Partial<Expense>): Expense {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    category: normalizeExpenseCategory(raw.category),
    amount: Number(raw.amount) || 0,
    date: String(raw.date ?? ''),
    description: String(raw.description ?? ''),
    addedBy: String(raw.addedBy ?? ''),
    paid: raw.paid !== false,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return structuredClone(EMPTY_DATA);
      }

      const parsed = JSON.parse(raw) as Partial<AppData>;
      const expenses = Array.isArray(parsed.expenses)
        ? parsed.expenses.map((item) => normalizeExpense(item as Partial<Expense>))
        : [];
      return {
        residents: Array.isArray(parsed.residents) ? parsed.residents : [],
        months: Array.isArray(parsed.months) ? parsed.months : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        expenses,
      };
    } catch {
      return structuredClone(EMPTY_DATA);
    }
  }

  save(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

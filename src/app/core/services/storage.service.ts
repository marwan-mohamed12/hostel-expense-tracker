import { Injectable } from '@angular/core';
import { AppData } from '../../models/app-data.model';
import { Expense } from '../../models/expense.model';
import {
  EXPENSE_CATEGORIES,
  normalizeExpenseCategory,
  STORAGE_KEY,
} from '../constants/app.constants';

const EMPTY_DATA: AppData = {
  residents: [],
  months: [],
  payments: [],
  expenses: [],
  customCategories: [],
};

const BUILTIN_LOWER = new Set(EXPENSE_CATEGORIES.map((c) => c.toLowerCase()));

/**
 * Normalize legacy expense rows:
 * - missing `paid` → true (keep historical balance)
 * - category: empty → Other; known preset casing; custom labels kept
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

function normalizeCustomCategories(
  stored: unknown,
  expenses: Expense[],
): string[] {
  const fromStorage = Array.isArray(stored)
    ? stored.map((item) => normalizeExpenseCategory(item)).filter(Boolean)
    : [];
  const fromExpenses = expenses
    .map((e) => e.category)
    .filter((c) => c && !BUILTIN_LOWER.has(c.toLowerCase()));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...fromStorage, ...fromExpenses]) {
    const key = name.toLowerCase();
    if (BUILTIN_LOWER.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(name);
  }
  return result.sort((a, b) => a.localeCompare(b));
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
        customCategories: normalizeCustomCategories(parsed.customCategories, expenses),
      };
    } catch {
      return structuredClone(EMPTY_DATA);
    }
  }

  save(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

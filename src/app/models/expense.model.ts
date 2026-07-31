import { ExpenseCategory } from '../core/constants/app.constants';

export interface Expense {
  id: string;
  title: string;
  /** Structured preset only (Electricity, Water, Gas, …). */
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  addedBy: string;
  /** When false, the expense is recorded but not yet paid — excluded from balance. */
  paid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

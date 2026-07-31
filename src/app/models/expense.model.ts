export interface Expense {
  id: string;
  title: string;
  /** Built-in preset or user-defined category label. */
  category: string;
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

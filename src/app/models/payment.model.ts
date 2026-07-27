export interface MonthRecord {
  id: string;
  year: number;
  month: number;
  label: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  monthId: string;
  residentId: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentUpdate = Partial<Pick<Payment, 'amount' | 'paid' | 'paidAt' | 'notes'>>;

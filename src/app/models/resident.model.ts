export interface Resident {
  id: string;
  name: string;
  phone: string;
  room: string;
  monthlyFee: number;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ResidentInput = Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>;

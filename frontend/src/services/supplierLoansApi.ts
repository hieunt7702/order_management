import { api, buildQuery } from './apiClient';

export interface SupplierLoanRepaymentModel {
  id: string;
  tenantId: string;
  loanId: string;
  repaymentCode: string;
  amount: number;
  repaymentDate: string;
  payerName?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  paymentMethod: string;
  referenceCode?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface SupplierLoanModel {
  id: string;
  tenantId: string;
  supplierId: string;
  loanCode: string;
  type: 'BORROWED_FROM_SUPPLIER' | 'LENT_TO_SUPPLIER';
  amount: number;
  repaidAmount: number;
  remainingAmount: number;
  interestRate: number;
  loanDate: string;
  dueDate?: string | null;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'SETTLED' | 'CANCELLED';
  fundAccountId?: string | null;
  paymentMethod: string;
  referenceCode?: string | null;
  note?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  };
  repayments?: SupplierLoanRepaymentModel[];
}

export interface CreateSupplierLoanPayload {
  supplierId: string;
  loanCode?: string;
  type?: 'BORROWED_FROM_SUPPLIER' | 'LENT_TO_SUPPLIER';
  amount: number;
  interestRate?: number;
  loanDate?: string;
  dueDate?: string;
  fundSource?: 'CASH_FUND' | 'BANK_ACCOUNT';
  fundAccountId?: string;
  paymentMethod?: string;
  referenceCode?: string;
  note?: string;
}

export interface CreateSupplierLoanRepaymentPayload {
  loanId: string;
  repaymentCode?: string;
  amount: number;
  repaymentDate?: string;
  payerName?: string;
  fundSource?: 'CASH_FUND' | 'BANK_ACCOUNT';
  accountId?: string;
  paymentMethod?: string;
  referenceCode?: string;
  note?: string;
}

export interface SupplierLoanFilterParams {
  supplierId?: string;
  type?: 'BORROWED_FROM_SUPPLIER' | 'LENT_TO_SUPPLIER';
  status?: 'ACTIVE' | 'PARTIALLY_REPAID' | 'SETTLED' | 'CANCELLED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface SupplierLoansResponse {
  items: SupplierLoanModel[];
  data?: SupplierLoanModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalBorrowed: number;
    totalRemainingDebt: number;
    totalLent: number;
    totalRemainingReceivable: number;
  };
}

export const supplierLoansApi = {
  findAll: async (params?: SupplierLoanFilterParams): Promise<SupplierLoansResponse> => {
    const q = buildQuery(params);
    return api.get<SupplierLoansResponse>(`/supplier-loans${q}`);
  },

  findOne: async (id: string): Promise<SupplierLoanModel> => {
    return api.get<SupplierLoanModel>(`/supplier-loans/${id}`);
  },

  create: async (payload: CreateSupplierLoanPayload): Promise<SupplierLoanModel> => {
    return api.post<SupplierLoanModel>('/supplier-loans', payload);
  },

  repay: async (payload: CreateSupplierLoanRepaymentPayload): Promise<SupplierLoanRepaymentModel> => {
    return api.post<SupplierLoanRepaymentModel>('/supplier-loans/repay', payload);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/supplier-loans/${id}`);
  },

  deleteRepayment: async (repaymentId: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/supplier-loans/repayments/${repaymentId}`);
  },
};

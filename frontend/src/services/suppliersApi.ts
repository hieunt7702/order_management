import { api, buildQuery } from './apiClient';

export interface SupplierItem {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankBeneficiary?: string | null;
  openingDebt: number;
  status: string;
  note?: string | null;
  totalPurchases: number;
  totalReturns: number;
  totalPaid: number;
  totalRefunded: number;
  totalTransferredOut?: number;
  totalTransferredIn?: number;
  advanceAmountHeld: number;
  totalReceiptsRemaining: number;
  closingDebt: number; // > 0: Shop nợ NCC; < 0: NCC giữ tiền ứng trước; = 0: Cân bằng
  totalLoanDebt?: number;
  totalLoanReceivable?: number;
  totalBorrowedProducts?: number;
  totalLentProducts?: number;
  receiptCount?: number;
  createdAt?: string;
}

export interface StatementTransaction {
  date: string;
  type:
    | 'OPENING'
    | 'RECEIPT'
    | 'PAYMENT'
    | 'RETURN'
    | 'REFUND'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
    | 'LOAN_BORROW'
    | 'LOAN_REPAY'
    | 'LOAN_LEND'
    | 'LOAN_COLLECT';
  code: string;
  description: string;
  increaseDebt: number;
  decreaseDebt: number;
  payerOrCreator?: string;
  fundSource?: string;
  referenceId: string;
  balanceBefore?: number;
  runningBalance: number;
}

export interface SupplierStatement {
  supplier: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    closingDebt: number;
    advanceAmountHeld: number;
  };
  transactions: StatementTransaction[];
}

export interface DebtReportsResponse {
  summary: {
    totalSuppliers: number;
    totalDebtPayable: number;
    totalAdvanceHeld: number;
    totalOverdueDebt: number;
    totalDueSoonDebt: number;
    pendingReimbursementCount: number;
    totalPendingReimbursement: number;
  };
  overdueList: Array<{
    receiptId: string;
    receiptCode: string;
    supplierId: string;
    supplierName: string;
    payableAmount: number;
    remainingAmount: number;
    paymentDueDate: string;
    overdueDays: number;
  }>;
  dueSoonList: Array<{
    receiptId: string;
    receiptCode: string;
    supplierId: string;
    supplierName: string;
    remainingAmount: number;
    paymentDueDate: string;
  }>;
  reimbursementNeeds: Array<{
    paymentId: string;
    paymentCode: string;
    payerName: string;
    fundSource: string;
    amount: number;
    paymentDate: string;
    supplierName: string;
  }>;
}

export const suppliersApi = {
  findAll: (params?: { search?: string; status?: string; shopId?: string; limit?: number; page?: number }) =>
    api.get<SupplierItem[]>(`/suppliers${buildQuery(params)}`),

  findOne: (id: string) => api.get<SupplierItem>(`/suppliers/${id}`),

  getStatement: (id: string, params?: { startDate?: string; endDate?: string }) =>
    api.get<SupplierStatement>(`/suppliers/${id}/statement${buildQuery(params)}`),

  getDebtReports: () => api.get<DebtReportsResponse>('/suppliers/debt-reports'),

  getNextCode: () => api.get<{ code: string }>('/suppliers/next-code'),

  create: (data: {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    bankName?: string;
    bankAccount?: string;
    bankBeneficiary?: string;
    openingDebt?: number;
    status?: string;
    note?: string;
  }) => api.post('/suppliers', data),

  update: (id: string, data: Partial<{
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    bankName?: string;
    bankAccount?: string;
    bankBeneficiary?: string;
    openingDebt?: number;
    status?: string;
    note?: string;
  }>) => api.patch(`/suppliers/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean; message: string }>(`/suppliers/${id}`),
};

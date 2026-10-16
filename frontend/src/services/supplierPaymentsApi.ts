import { api, buildQuery } from './apiClient';

export interface PaymentAllocationItem {
  receiptId: string;
  amount: number;
  note?: string;
}

export interface SupplierPaymentModel {
  id: string;
  tenantId: string;
  supplierId: string;
  paymentCode: string;
  amount: number;
  allocatedAmount: number;
  advanceAmount: number;
  paymentDate: string;
  payerName: string;
  payerUserId?: string | null;
  fundSource: 'CASH_FUND' | 'BANK_ACCOUNT' | 'PERSONAL_FUND';
  paymentMethod: string;
  referenceCode?: string | null;
  voucherImage?: string | null;
  isReimbursementNeeded: boolean;
  reimbursementStatus: 'NOT_APPLICABLE' | 'PENDING_REIMBURSEMENT' | 'REIMBURSED';
  paymentType: 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'REFUND_RECEIVED';
  note?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
  };
  allocations?: Array<{
    id: string;
    allocatedAmount: number;
    note?: string | null;
    receipt: {
      id: string;
      receiptCode: string;
      payableAmount: number;
      paidAmount: number;
      remainingAmount: number;
      paymentStatus: string;
    };
  }>;
}

export interface CreateSupplierPaymentPayload {
  supplierId: string;
  paymentCode?: string;
  amount: number;
  paymentDate?: string;
  payerName: string;
  fundSource: 'CASH_FUND' | 'BANK_ACCOUNT' | 'PERSONAL_FUND';
  paymentMethod?: string;
  referenceCode?: string;
  voucherImage?: string;
  paymentType?: 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'REFUND_RECEIVED';
  isReimbursementNeeded?: boolean;
  allocations?: PaymentAllocationItem[];
  note?: string;
}

export interface SupplierPaymentsResponse {
  data: SupplierPaymentModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const supplierPaymentsApi = {
  findAll: (params?: {
    supplierId?: string;
    fundSource?: string;
    payerName?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<SupplierPaymentsResponse>(`/supplier-payments${buildQuery(params)}`),

  findOne: (id: string) => api.get<SupplierPaymentModel>(`/supplier-payments/${id}`),

  create: (data: CreateSupplierPaymentPayload) =>
    api.post<SupplierPaymentModel>('/supplier-payments', data),

  markReimbursed: (id: string, note?: string) =>
    api.patch<SupplierPaymentModel>(`/supplier-payments/${id}/reimburse`, { note }),

  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/supplier-payments/${id}`),
};

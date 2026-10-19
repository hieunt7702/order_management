import { api, buildQuery } from './apiClient';

export interface SupplierTransferAllocationItem {
  id?: string;
  receiptId: string;
  allocatedAmount: number;
  note?: string | null;
  receipt?: {
    id: string;
    receiptCode: string;
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: string;
  };
}

export interface SupplierTransferModel {
  id: string;
  tenantId: string;
  transferCode: string;
  fromSupplierId: string;
  toSupplierId: string;
  amount: number;
  transferDate: string;
  payerName: string;
  referenceCode?: string | null;
  voucherImage?: string | null;
  note?: string | null;
  createdById?: string | null;
  createdAt: string;
  fromSupplier?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  };
  toSupplier?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  };
  allocations?: SupplierTransferAllocationItem[];
}

export interface CreateSupplierTransferPayload {
  fromSupplierId: string;
  toSupplierId: string;
  transferCode?: string;
  amount: number;
  transferDate?: string;
  payerName: string;
  referenceCode?: string;
  voucherImage?: string;
  note?: string;
  allocations?: Array<{
    receiptId: string;
    amount: number;
    note?: string;
  }>;
}

export interface SupplierTransfersResponse {
  data: SupplierTransferModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const supplierTransfersApi = {
  findAll: (params?: {
    fromSupplierId?: string;
    toSupplierId?: string;
    supplierId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get<SupplierTransfersResponse>(`/supplier-transfers${buildQuery(params)}`),

  findOne: (id: string) => api.get<SupplierTransferModel>(`/supplier-transfers/${id}`),

  create: (data: CreateSupplierTransferPayload) =>
    api.post<SupplierTransferModel>('/supplier-transfers', data),

  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/supplier-transfers/${id}`),
};

import { api, buildQuery } from './apiClient';

export interface PurchaseReceiptItemModel {
  id: string;
  variantId: string;
  productName: string;
  variationName?: string | null;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  disputedQuantity: number;
  unitPrice: number;
  subtotal: number;
  note?: string | null;
}

export interface PurchaseReceiptModel {
  id: string;
  tenantId: string;
  shopId?: string | null;
  warehouseId: string;
  supplierId: string;
  receiptCode: string;
  receiptDate: string;
  paymentDueDate?: string | null;
  totalItemsAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingFee: number;
  shippingFeePayerType: 'PAID_TO_SUPPLIER' | 'PAID_TO_CARRIER';
  payableAmount: number;
  paidAmount: number;
  returnDeductionAmount: number;
  remainingAmount: number;
  receivingStatus: 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'PENDING_RECEIVE';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  dueStatus: 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE';
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
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
  shop?: {
    id: string;
    code: string;
    name: string;
  } | null;
  items?: PurchaseReceiptItemModel[];
  paymentAllocations?: Array<{
    id: string;
    allocatedAmount: number;
    payment: {
      id: string;
      paymentCode: string;
      paymentDate: string;
      payerName: string;
      fundSource: string;
      paymentMethod: string;
    };
  }>;
  purchaseReturns?: Array<{
    id: string;
    returnCode: string;
    returnDate: string;
    debtOffsetAmount: number;
    reason?: string;
  }>;
}

export interface CreatePurchaseReceiptPayload {
  supplierId: string;
  shopId?: string;
  warehouseId: string;
  receiptCode?: string;
  receiptDate?: string;
  paymentDueDate?: string;
  discountAmount?: number;
  taxAmount?: number;
  shippingFee?: number;
  shippingFeePayerType?: 'PAID_TO_SUPPLIER' | 'PAID_TO_CARRIER';
  note?: string;
  items: Array<{
    variantId: string;
    productName: string;
    variationName?: string;
    sku: string;
    orderedQuantity: number;
    receivedQuantity: number;
    disputedQuantity?: number;
    unitPrice: number;
    note?: string;
  }>;
  immediatePayment?: boolean;
  immediatePaymentAmount?: number;
  immediatePayerName?: string;
  immediateFundSource?: 'CASH_FUND' | 'BANK_ACCOUNT' | 'PERSONAL_FUND';
  immediatePaymentMethod?: string;
}

export interface PurchaseReceiptsSummary {
  totalItemsAmount: number;
  payableAmount: number;
  paidAmount: number;
  returnDeductionAmount: number;
  totalPaidAndOffsetAmount: number;
  remainingAmount: number;
}

export interface PurchaseReceiptsResponse {
  data: PurchaseReceiptModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: PurchaseReceiptsSummary;
}

export const purchaseReceiptsApi = {
  findAll: (params?: {
    supplierId?: string;
    shopId?: string;
    warehouseId?: string;
    paymentStatus?: string;
    receivingStatus?: string;
    dueStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<PurchaseReceiptsResponse>(`/purchase-receipts${buildQuery(params)}`),

  findOne: (id: string) => api.get<PurchaseReceiptModel>(`/purchase-receipts/${id}`),

  getNextCode: () => api.get<{ code: string }>('/purchase-receipts/next-code'),

  create: (data: CreatePurchaseReceiptPayload) =>
    api.post<PurchaseReceiptModel>('/purchase-receipts', data),

  update: (
    id: string,
    data: Partial<{
      paymentDueDate?: string;
      discountAmount?: number;
      taxAmount?: number;
      shippingFee?: number;
      shippingFeePayerType?: 'PAID_TO_SUPPLIER' | 'PAID_TO_CARRIER';
      note?: string;
    }>,
  ) => api.patch<PurchaseReceiptModel>(`/purchase-receipts/${id}`, data),

  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/purchase-receipts/${id}`),

  autoOffset: (supplierId?: string) =>
    api.post<{ success: boolean; message: string; totalAllocated: number }>(
      `/purchase-receipts/auto-offset${supplierId ? `?supplierId=${supplierId}` : ''}`,
      null,
    ),
};

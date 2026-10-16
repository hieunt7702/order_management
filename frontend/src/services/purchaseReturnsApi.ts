import { api, buildQuery } from './apiClient';

export interface PurchaseReturnItemModel {
  id: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  variant?: {
    id: string;
    sku: string;
    name: string;
    product: {
      id: string;
      name: string;
    };
  };
}

export interface PurchaseReturnModel {
  id: string;
  tenantId: string;
  supplierId: string;
  receiptId?: string | null;
  returnCode: string;
  returnDate: string;
  totalReturnAmount: number;
  debtOffsetAmount: number;
  status: string;
  reason?: string | null;
  note?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };
  receipt?: {
    id: string;
    receiptCode: string;
    payableAmount: number;
    paidAmount: number;
    returnDeductionAmount: number;
  } | null;
  items?: PurchaseReturnItemModel[];
}

export interface CreatePurchaseReturnPayload {
  supplierId: string;
  receiptId?: string;
  warehouseId: string;
  returnCode?: string;
  returnDate?: string;
  debtOffsetAmount?: number;
  reason?: string;
  note?: string;
  items: Array<{
    variantId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface PurchaseReturnsResponse {
  data: PurchaseReturnModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const purchaseReturnsApi = {
  findAll: (params?: {
    supplierId?: string;
    receiptId?: string;
    page?: number;
    limit?: number;
  }) => api.get<PurchaseReturnsResponse>(`/purchase-returns${buildQuery(params)}`),

  findOne: (id: string) => api.get<PurchaseReturnModel>(`/purchase-returns/${id}`),

  create: (data: CreatePurchaseReturnPayload) =>
    api.post<PurchaseReturnModel>('/purchase-returns', data),

  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/purchase-returns/${id}`),
};
